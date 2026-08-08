import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Vue d'ensemble en lecture seule pour la section Rustique (app Aide) :
// apiculture, distillation/ambulant (state.params du hub) + avancement
// BPREA/bibliothèque (learn_decks/learn_cards/learn_review_state).
// Même pont que hub-recipes/hub-notes : clé de service du hub uniquement dans
// les secrets HUB_URL/HUB_SERVICE_KEY, jamais côté navigateur.
// verify_jwt=true => seules les personnes connectées à Aide peuvent appeler.

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

const PAUSE_KEYS = ["pause_apiculture", "pause_dist_fixe", "pause_ambulant"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const hubUrl = Deno.env.get("HUB_URL");
    const hubKey = Deno.env.get("HUB_SERVICE_KEY");
    if (!hubUrl || !hubKey) return json({ error: "hub_not_configured" }, 503);

    const hub = createClient(hubUrl, hubKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [stateRes, decksRes, cardsRes, reviewRes] = await Promise.all([
      hub.from("hub_state").select("state, updated_at").eq("id", "main").maybeSingle(),
      hub.from("learn_decks").select("id, scope"),
      hub.from("learn_cards").select("id, deck_id"),
      hub.from("learn_review_state").select("due"),
    ]);
    if (stateRes.error) return json({ error: "hub_error", detail: stateRes.error.message }, 502);
    if (decksRes.error) return json({ error: "hub_error", detail: decksRes.error.message }, 502);
    if (cardsRes.error) return json({ error: "hub_error", detail: cardsRes.error.message }, 502);
    if (reviewRes.error) return json({ error: "hub_error", detail: reviewRes.error.message }, 502);

    // state.params est la source de vérité unique du hub (voir son CLAUDE.md) :
    // chaque clé porte un préfixe de domaine (api_*, dist_*, amb_*, glob_*…).
    const params = (stateRes.data?.state?.params ?? {}) as Record<string, unknown>;
    const apiculture: Record<string, unknown> = {};
    const distillation: Record<string, unknown> = {};
    const ambulant: Record<string, unknown> = {};
    const pauses: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith("api_")) apiculture[k] = v;
      else if (k.startsWith("dist_")) distillation[k] = v;
      else if (k.startsWith("amb_")) ambulant[k] = v;
      else if (PAUSE_KEYS.includes(k)) pauses[k] = v;
    }

    // BPREA : les decks de révision espacée portent un `scope` — "generale"
    // pour les modules du référentiel BPREA (M-*), "biblio" pour les fiches de
    // bibliographie associées. Pas de scope "bprea" dédié : on regroupe les deux.
    type Deck = { id: string; scope: string | null };
    type Card = { id: string; deck_id: string };
    const decks = (decksRes.data ?? []) as Deck[];
    const cards = (cardsRes.data ?? []) as Card[];
    const scopeOf = new Map(decks.map((d) => [d.id, d.scope]));
    let modulesDecks = 0;
    let biblioDecks = 0;
    for (const d of decks) if (d.scope === "generale") modulesDecks++; else biblioDecks++;
    let modulesCards = 0;
    let biblioCards = 0;
    for (const c of cards) if (scopeOf.get(c.deck_id) === "generale") modulesCards++; else biblioCards++;

    const dueToday = ((reviewRes.data ?? []) as { due: string }[]).filter(
      (r) => new Date(r.due).getTime() <= Date.now(),
    ).length;

    return json({
      updatedAt: stateRes.data?.updated_at ?? null,
      params: { apiculture, distillation, ambulant, pauses },
      apiProducts: stateRes.data?.state?.apiProducts ?? {},
      bprea: { modulesDecks, modulesCards, biblioDecks, biblioCards, dueToday },
    });
  } catch (e) {
    return json({ error: "exception", detail: String(e) }, 500);
  }
});
