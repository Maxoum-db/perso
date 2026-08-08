import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fsrs, generatorParameters, createEmptyCard, State } from "npm:ts-fsrs@5.4.1";

// Quiz Rustique : consultation ET révision RÉELLE des cartes d'apprentissage
// du hub (learn_decks/learn_cards). Une révision faite ici avance le MÊME
// planning FSRS que dans l'app Hub (learn_review_state/learn_review_log) —
// même moteur ts-fsrs, mêmes paramètres (enable_fuzz) que src/utils/fsrs.js
// côté hub, pour rester compatible avec les lignes que le Hub lira/écrira.
// Même pont que hub-recipes/hub-notes/hub-rustique : clé de service du hub
// uniquement dans les secrets HUB_URL/HUB_SERVICE_KEY.
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

// Mêmes paramètres que src/utils/fsrs.js côté hub (rétention cible 90 %,
// fuzz activé) : deux moteurs différemment paramétrés produiraient des
// échéances incohérentes sur la même carte selon l'app utilisée pour réviser.
const engine = fsrs(generatorParameters({ enable_fuzz: true }));

// ── Thèmes ───────────────────────────────────────────────────────────────
// Reprend les 8 phases du programme d'auto-formation du hub
// (FORMGEN_PHASES_SEED, src/constants/formation_generale.js) plutôt que
// d'inventer une taxonomie séparée : les modules BPREA (scope="generale")
// s'y rattachent déjà via leur phase_id. La bibliothèque (scope="biblio")
// n'a pas de rattachement explicite en base (biblio_docs est vide côté hub)
// — on la répartit sur les mêmes thèmes par préfixe de source, pour que
// modules ET fiches d'un même sujet se retrouvent regroupés.
type Theme = { id: string; title: string; color: string; order: number };

const THEMES: Record<string, Theme> = {
  P0: { id: "P0", title: "Posture & pilotage", color: "#6366F1", order: 0 },
  P1: { id: "P1", title: "Socle gestion & juridique", color: "#0EA5E9", order: 1 },
  P2: { id: "P2", title: "Cœur apicole", color: "#F59E0B", order: 2 },
  P3: { id: "P3", title: "Productions végétales", color: "#22C55E", order: 3 },
  P4: { id: "P4", title: "Transformation & énergie", color: "#EF4444", order: 4 },
  P5: { id: "P5", title: "Valorisation", color: "#A855F7", order: 5 },
  P6: { id: "P6", title: "Synthèse & jury", color: "#0F766E", order: 6 },
  PT: { id: "PT", title: "Transversal — Métabolisme Prométhée", color: "#64748B", order: 7 },
};
const AUTRE: Theme = { id: "AUTRE", title: "Autres", color: "#6B7280", order: 8 };

// Code de module (deck.id = "deck-mod-<code>") → phase — miroir exact de
// FORMGEN_MODULES_SEED côté hub. Si le hub ajoute un module, il tombera dans
// "Autres" ici jusqu'à mise à jour de cette table.
const MODULE_PHASE: Record<string, string> = {
  "M-UC1": "P0", "M-UC2": "P0", "M-CHARGE": "P0", "M-PROJ": "P0",
  "M-UC4": "P1", "M-JURI": "P1", "M-FISC": "P1", "M-FINANCE": "P1", "M-SOCIAL": "P1",
  "M-UC3": "P2", "M-UCARE1": "P2", "M-UCARE2": "P2", "M-API-IMPL": "P2", "M-API-SANTE": "P2", "M-API-ECO": "P2",
  "M-FRUIT": "P3", "M-MARA": "P3", "M-AGROF": "P3", "M-EAU": "P3", "M-PPAM": "P3", "M-CEREALE": "P3",
  "M-DIST": "P4", "M-BRASS": "P4", "M-ENER": "P4", "M-ACCISE": "P4", "M-SECU": "P4", "M-ATELIER": "P4", "M-LIQ": "P4",
  "M-UC5": "P5", "M-MARQUE": "P5", "M-SENSO": "P5", "M-DIGITAL": "P5", "M-COUT": "P5",
  "M-BP": "P6", "M-DJA": "P6", "M-JURY": "P6", "M-RETRO": "P6", "M-RISK": "P6",
  "M-SYN": "PT", "M-SANI": "PT", "M-HYDRO": "PT", "M-FUT": "PT", "M-FERM": "PT",
  "M-CIRC": "PT", "M-ENVI": "PT", "M-DATA": "PT", "M-LOGI": "PT", "M-RESO": "PT",
};

// Préfixe de source bibliographique (deck.id = "deck-fiche-f-<source>" ou
// "deck-qcm-f-<source>") → phase. Répartition par sujet, à défaut de
// rattachement explicite en base.
const BIBLIO_PREFIX_PHASE: [string, string][] = [
  ["pole1-sante", "P2"], ["pole3-pesticides", "P2"], ["pole5-socioeco", "P2"],
  ["pole6-agriculture", "P2"], ["pole7-genetique", "P2"], ["pole8-produits", "P2"],
  ["itsap", "P2"],
  ["pole2-biodiv", "P3"], ["altieri", "P3"], ["atlas", "P3"], ["laberche", "P3"],
  ["pole4-numerique", "PT"],
  ["wr", "P4"], ["at", "P4"],
];

function themeForDeck(deckId: string, scope: string | null): Theme {
  if (scope === "generale") {
    const code = deckId.replace(/^deck-mod-/, "");
    const phase = MODULE_PHASE[code];
    return phase ? THEMES[phase] : AUTRE;
  }
  const source = deckId.replace(/^deck-(fiche|qcm)-f-/, "");
  for (const [prefix, phase] of BIBLIO_PREFIX_PHASE) {
    if (source.startsWith(prefix)) return THEMES[phase];
  }
  return AUTRE;
}

type PackedCard = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

function pack(card: Record<string, unknown>): PackedCard {
  const due = card.due;
  const lastReview = card.last_review;
  return {
    due: due instanceof Date ? due.toISOString() : (due as string),
    stability: card.stability as number,
    difficulty: card.difficulty as number,
    elapsed_days: card.elapsed_days as number,
    scheduled_days: card.scheduled_days as number,
    learning_steps: (card.learning_steps as number) ?? 0,
    reps: card.reps as number,
    lapses: card.lapses as number,
    state: typeof card.state === "string" ? State[card.state as keyof typeof State] : (card.state as number),
    last_review: lastReview ? (lastReview instanceof Date ? lastReview.toISOString() : (lastReview as string)) : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const hubUrl = Deno.env.get("HUB_URL");
    const hubKey = Deno.env.get("HUB_SERVICE_KEY");
    if (!hubUrl || !hubKey) return json({ error: "hub_not_configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const hub = createClient(hubUrl, hubKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Liste des paquets avec compteurs (cartes / dues aujourd'hui).
    if (action === "list_decks") {
      const [decksRes, cardsRes, reviewRes] = await Promise.all([
        hub.from("learn_decks").select("id, title, scope"),
        hub.from("learn_cards").select("id, deck_id"),
        hub.from("learn_review_state").select("card_id, due"),
      ]);
      if (decksRes.error) return json({ error: "hub_error", detail: decksRes.error.message }, 502);
      if (cardsRes.error) return json({ error: "hub_error", detail: cardsRes.error.message }, 502);
      if (reviewRes.error) return json({ error: "hub_error", detail: reviewRes.error.message }, 502);

      type Card = { id: string; deck_id: string };
      const dueByCard = new Map(
        ((reviewRes.data ?? []) as { card_id: string; due: string }[]).map((r) => [r.card_id, r.due]),
      );
      const now = Date.now();
      const cardsByDeck = new Map<string, number>();
      const dueByDeck = new Map<string, number>();
      for (const c of (cardsRes.data ?? []) as Card[]) {
        cardsByDeck.set(c.deck_id, (cardsByDeck.get(c.deck_id) ?? 0) + 1);
        const due = dueByCard.get(c.id);
        if (!due || new Date(due).getTime() <= now) {
          dueByDeck.set(c.deck_id, (dueByDeck.get(c.deck_id) ?? 0) + 1);
        }
      }
      const decks = ((decksRes.data ?? []) as { id: string; title: string; scope: string | null }[]).map((d) => ({
        id: d.id,
        title: d.title,
        scope: d.scope,
        theme: themeForDeck(d.id, d.scope),
        cardCount: cardsByDeck.get(d.id) ?? 0,
        dueCount: dueByDeck.get(d.id) ?? 0,
      }));
      return json({ decks });
    }

    // Cartes d'un paquet OU de tout un thème (plusieurs paquets regroupés),
    // avec leur état de révision courant — un thème permet de réviser en une
    // seule session tout ce qui concerne un sujet (ex: 🐝 Cœur apicole),
    // plutôt que d'ouvrir chaque petit paquet un par un.
    if (action === "list_cards") {
      const deckId = body.deck_id as string | undefined;
      const themeId = body.theme_id as string | undefined;
      if (!deckId && !themeId) return json({ error: "bad_request" }, 400);
      const dueOnly = Boolean(body.due_only);

      let deckIds: string[];
      let deckTitleById = new Map<string, string>();
      if (deckId) {
        deckIds = [deckId];
      } else {
        const decksRes = await hub.from("learn_decks").select("id, title, scope");
        if (decksRes.error) return json({ error: "hub_error", detail: decksRes.error.message }, 502);
        const matching = ((decksRes.data ?? []) as { id: string; title: string; scope: string | null }[]).filter(
          (d) => themeForDeck(d.id, d.scope).id === themeId,
        );
        deckIds = matching.map((d) => d.id);
        deckTitleById = new Map(matching.map((d) => [d.id, d.title]));
        if (deckIds.length === 0) return json({ cards: [] });
      }

      const [cardsRes, reviewRes] = await Promise.all([
        hub.from("learn_cards").select("id, deck_id, front, back, type").in("deck_id", deckIds),
        hub.from("learn_review_state").select("*"),
      ]);
      if (cardsRes.error) return json({ error: "hub_error", detail: cardsRes.error.message }, 502);
      if (reviewRes.error) return json({ error: "hub_error", detail: reviewRes.error.message }, 502);

      const stateByCard = new Map(((reviewRes.data ?? []) as { card_id: string }[]).map((r) => [r.card_id, r]));
      const now = Date.now();
      let cards = ((cardsRes.data ?? []) as { id: string; deck_id: string; front: string; back: string; type: string }[]).map(
        (c) => ({
          ...c,
          deckTitle: deckTitleById.get(c.deck_id) ?? null,
          review: stateByCard.get(c.id) ?? null,
        }),
      );
      if (dueOnly) {
        cards = cards.filter((c) => !c.review || new Date((c.review as { due: string }).due).getTime() <= now);
      }
      return json({ cards });
    }

    // Enregistre une révision : upsert de l'état FSRS + insert du log — pattern
    // identique à recordLearnReview() côté hub (src/lib/supabase.js).
    if (action === "submit_review") {
      const cardId = body.card_id as string;
      const rating = Math.max(1, Math.min(4, Number(body.rating) || 3));
      if (!cardId) return json({ error: "bad_request" }, 400);

      const { data: current, error: curErr } = await hub
        .from("learn_review_state")
        .select("*")
        .eq("card_id", cardId)
        .maybeSingle();
      if (curErr) return json({ error: "hub_error", detail: curErr.message }, 502);

      const now = new Date();
      // ts-fsrs accepte directement un objet plat (dates ISO) comme CardInput —
      // même convention que le wrapper côté hub (src/utils/fsrs.js).
      const input = current
        ? {
            due: current.due,
            stability: current.stability,
            difficulty: current.difficulty,
            elapsed_days: current.elapsed_days,
            scheduled_days: current.scheduled_days,
            learning_steps: current.learning_steps ?? 0,
            reps: current.reps,
            lapses: current.lapses,
            state: current.state,
            last_review: current.last_review,
          }
        : createEmptyCard(now);

      const { card, log } = engine.next(input, now, rating);
      const newState = pack(card as unknown as Record<string, unknown>);

      const { error: e1 } = await hub
        .from("learn_review_state")
        .upsert({ card_id: cardId, ...newState }, { onConflict: "card_id" });
      if (e1) return json({ error: "hub_error", detail: e1.message }, 502);

      const logDue = log.due;
      const logReview = log.review;
      const logRow = {
        card_id: cardId,
        rating: log.rating,
        state: typeof log.state === "string" ? State[log.state as keyof typeof State] : log.state,
        due: logDue instanceof Date ? logDue.toISOString() : logDue,
        stability: log.stability,
        difficulty: log.difficulty,
        elapsed_days: log.elapsed_days,
        last_elapsed_days: log.last_elapsed_days,
        scheduled_days: log.scheduled_days,
        learning_steps: log.learning_steps ?? 0,
        review: logReview instanceof Date ? logReview.toISOString() : logReview,
      };
      const { error: e2 } = await hub.from("learn_review_log").insert(logRow);
      // L'état est déjà sauvé ; le log est best-effort, comme côté hub.
      if (e2) return json({ ok: true, state: newState, logError: e2.message });

      return json({ ok: true, state: newState });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "exception", detail: String(e) }, 500);
  }
});
