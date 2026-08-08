import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32";

// Assistant « deuxième cerveau » de la section Rustique : répond à partir d'un
// instantané du hub (apiculture, distillation ambulante, BPREA/bibliothèque,
// extrait des recettes). v1 = une seule requête, contexte injecté, pas
// d'outils ni de mémoire — cohérent avec le pont hub-recipes/hub-notes déjà en
// place (clé de service du hub uniquement dans les secrets, jamais côté navigateur).
// verify_jwt=true => réservé aux personnes connectées à Aide.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const hubUrl = Deno.env.get("HUB_URL");
    const hubKey = Deno.env.get("HUB_SERVICE_KEY");
    if (!hubUrl || !hubKey) return json({ error: "hub_not_configured" }, 503);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "assistant_not_configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return json({ error: "bad_request" }, 400);

    const hub = createClient(hubUrl, hubKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [stateRes, recipesRes, decksRes, cardsRes, reviewRes] = await Promise.all([
      hub.from("hub_state").select("state, updated_at").eq("id", "main").maybeSingle(),
      hub
        .from("hub_recipes_unified")
        .select("name,type,style,favorite,tried,rating")
        .order("favorite", { ascending: false })
        .limit(30),
      hub.from("learn_decks").select("id, scope"),
      hub.from("learn_cards").select("id, deck_id"),
      hub.from("learn_review_state").select("due"),
    ]);
    if (stateRes.error) return json({ error: "hub_error", detail: stateRes.error.message }, 502);

    const params = (stateRes.data?.state?.params ?? {}) as Record<string, unknown>;
    const domaine: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (
        k.startsWith("api_") ||
        k.startsWith("dist_") ||
        k.startsWith("amb_") ||
        k === "pause_apiculture" ||
        k === "pause_dist_fixe" ||
        k === "pause_ambulant"
      ) {
        domaine[k] = v;
      }
    }

    type Deck = { id: string; scope: string | null };
    const decks = (decksRes.data ?? []) as Deck[];
    const scopeOf = new Map(decks.map((d) => [d.id, d.scope]));
    let modulesDecks = 0;
    let biblioDecks = 0;
    for (const d of decks) if (d.scope === "generale") modulesDecks++; else biblioDecks++;
    let modulesCards = 0;
    let biblioCards = 0;
    for (const c of (cardsRes.data ?? []) as { deck_id: string }[]) {
      if (scopeOf.get(c.deck_id) === "generale") modulesCards++; else biblioCards++;
    }
    const dueToday = ((reviewRes.data ?? []) as { due: string }[]).filter(
      (r) => new Date(r.due).getTime() <= Date.now(),
    ).length;

    const contexte = {
      apiculture_distillation_ambulant: domaine,
      apiProducts: stateRes.data?.state?.apiProducts ?? {},
      bprea: { modulesDecks, modulesCards, biblioDecks, biblioCards, cartesDuesAujourdhui: dueToday },
      recettes_extrait: (recipesRes.data ?? []).map((r: Record<string, unknown>) => ({
        nom: r.name,
        type: r.type,
        style: r.style,
        favori: r.favorite,
        testee: r.tried,
        note: r.rating,
      })),
      derniere_maj_hub: stateRes.data?.updated_at ?? null,
    };

    const system = [
      "Tu es le second cerveau de Maximilien à l'intérieur de Couanac Aides (section Rustique).",
      "Réponds en français, de façon concise, à partir UNIQUEMENT des données ci-dessous,",
      "extraites du Hub Prométhée (apiculture, distillation ambulante, BPREA, recettes de brassage/spiritueux).",
      "Si l'information demandée n'est pas dans ce contexte, dis-le clairement plutôt que d'inventer.",
      "",
      "Contexte (JSON) :",
      JSON.stringify(contexte),
    ].join("\n");

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: question }],
    });

    if (msg.stop_reason === "refusal") {
      return json({ answer: "Je ne peux pas répondre à cette question." });
    }
    const block = msg.content.find((b) => b.type === "text");
    const answer = block && "text" in block ? block.text : "";
    return json({ answer });
  } catch (e) {
    return json({ error: "exception", detail: String(e) }, 500);
  }
});
