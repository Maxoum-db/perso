import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Le pont vers Polar Flow.
//
// ── Pourquoi une fonction serveur et pas du code navigateur ─────────────────
//
// L'échange du code d'autorisation contre un jeton se fait en présentant le
// SECRET client. Un secret dans un bundle Vite n'est pas un secret : il part
// dans le JavaScript que n'importe qui peut lire. Spotify s'en sort côté
// navigateur parce qu'il accepte PKCE, qui existe exactement pour ça ;
// AccessLink ne le propose pas. Donc serveur.
//
// Le jeton, ensuite, ne redescend jamais vers le navigateur. Il vit dans
// `perso_polar_link`, table sans aucune politique RLS — seule la clé de service
// la lit. L'écran demande « suis-je lié ? », pas « donne-moi mon jeton ».
//
// ── Ce que cette fonction ne fait pas ───────────────────────────────────────
//
// Elle n'appelle ni `/users/sleep`, ni `/users/nightly-recharge`, ni
// `/users/continuous-heart-rate`. Ces routes existent, mais elles décrivent des
// données de montre : le Verity Sense ne se porte pas la nuit et ne mesure pas
// en continu. Les appeler rendrait des listes vides qu'il faudrait ensuite
// expliquer.
//
// Elle n'ouvre pas non plus de transaction d'exercices. `GET /v3/exercises`
// rend les trente derniers jours, autant de fois qu'on veut. Le transactionnel
// donnerait le temps par zone, mais sa validation efface les séances pour de
// bon : une synchronisation qu'on peut relancer vaut mieux.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTORISATION = "https://flow.polar.com/oauth2/authorization";
const JETON = "https://polarremote.com/v2/oauth2/token";
const API = "https://www.polaraccesslink.com/v3";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface Reglages {
  clientId: string;
  clientSecret: string;
  redirect: string;
}

function reglages(): Reglages | null {
  const clientId = Deno.env.get("POLAR_CLIENT_ID");
  const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET");
  const redirect = Deno.env.get("POLAR_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirect) return null;
  return { clientId, clientSecret, redirect };
}

/** Le compte appelant, vérifié par son jeton Supabase. */
async function appelant(req: Request): Promise<{ id: string } | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anon || !auth) return null;
  const perso = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await perso.auth.getUser();
  return data.user ? { id: data.user.id } : null;
}

function service() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Les appels à Polar ──────────────────────────────────────────────────────

/**
 * Échange le code d'autorisation contre un jeton.
 *
 * La réponse porte `access_token` et `x_user_id` — l'identifiant Polar de la
 * personne. Pas de jeton de rafraîchissement : ceux d'AccessLink durent des
 * années, et il n'y a rien à renouveler.
 */
async function echanger(r: Reglages, code: string) {
  const res = await fetch(JETON, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${r.clientId}:${r.clientSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json;charset=UTF-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: r.redirect,
    }),
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`polar_token_${res.status}: ${texte.slice(0, 300)}`);
  return JSON.parse(texte) as { access_token: string; x_user_id?: number };
}

/**
 * Enregistre le compte auprès d'AccessLink.
 *
 * Obligatoire : sans ça, toute lecture de données rend 403, même avec un jeton
 * valide. Un 409 veut dire « déjà enregistré » — ce n'est pas une erreur, c'est
 * le cas normal quand on relie une deuxième fois.
 */
async function enregistrer(token: string, memberId: string): Promise<void> {
  const res = await fetch(`${API}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ "member-id": memberId }),
  });
  if (res.ok || res.status === 409) return;
  throw new Error(`polar_register_${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function seancesPolar(token: string): Promise<unknown> {
  const res = await fetch(`${API}/exercises`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  // 204 : rien à lire. Ce n'est pas une panne.
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`polar_exercises_${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

// ── La lecture d'une séance ─────────────────────────────────────────────────
//
// Recopié de `src/lib/polarFlow.ts`, et c'est assumé : une fonction Deno ne
// peut pas importer un module du bundle Vite. Les deux copies ne divergeront
// pas silencieusement — les contrôles de `polarFlow.ts` couvrent la logique, et
// celle-ci n'a d'intérêt que pour écrire en base.

function champ(o: Record<string, unknown>, nom: string): unknown {
  const v = o[nom];
  return v !== undefined ? v : o[nom.replace(/-/g, "_")];
}

function nombre(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function dureeIsoEnSecondes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v.trim());
  if (!m) return null;
  if (m[1] === undefined && m[2] === undefined && m[3] === undefined) return null;
  return Math.round(parseFloat(m[1] ?? "0") * 3600 + parseFloat(m[2] ?? "0") * 60 + parseFloat(m[3] ?? "0"));
}

interface Ligne {
  user_id: string;
  polar_id: string;
  debut: string;
  date: string;
  duree_s: number | null;
  sport: string | null;
  appareil: string | null;
  calories: number | null;
  distance_m: number | null;
  fc_moyenne: number | null;
  fc_max: number | null;
  charge_polar: number | null;
}

function ligneDe(brut: unknown, userId: string): Ligne | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const idBrut = champ(o, "id");
  const id = typeof idBrut === "number" ? String(idBrut) : texte(idBrut);
  const debut = texte(champ(o, "start-time"));
  // `!debut` est REDONDANT avec la regex de date ci-dessous — `exec` sur une
  // valeur nulle ne matche pas, et la séance serait rejetée là. Une mutation qui
  // le retire ne fait donc tomber aucun contrôle, et c'est normal. Gardé parce
  // que c'est lui qui donne son type à `debut` dans le jumeau typé
  // (`src/lib/polarFlow.ts`), et que les deux copies doivent se lire pareil.
  if (!id || !debut) return null;
  // La date se découpe dans la chaîne : `start-time` est en heure locale sans
  // fuseau, et un détour par Date la décalerait d'un jour avant 2 h du matin.
  const d = /^(\d{4}-\d{2}-\d{2})/.exec(debut);
  if (!d) return null;
  const fc = champ(o, "heart-rate");
  const fcObj = fc && typeof fc === "object" ? (fc as Record<string, unknown>) : {};
  return {
    user_id: userId,
    polar_id: id,
    debut,
    date: d[1],
    duree_s: dureeIsoEnSecondes(champ(o, "duration")),
    sport: texte(champ(o, "detailed-sport-info")) ?? texte(champ(o, "sport")),
    appareil: texte(champ(o, "device")),
    calories: nombre(champ(o, "calories")),
    distance_m: nombre(champ(o, "distance")),
    fc_moyenne: nombre(champ(fcObj, "average")),
    fc_max: nombre(champ(fcObj, "maximum")),
    charge_polar: nombre(champ(o, "training-load")),
  };
}

// ── Le service ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const moi = await appelant(req);
    if (!moi) return json({ error: "non_authentifie" }, 401);

    const db = service();
    if (!db) return json({ error: "supabase_non_configure" }, 503);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const r = reglages();
    // L'état se rend même sans réglages : c'est justement l'écran qui doit
    // annoncer « pas encore configuré » plutôt que de rendre une erreur nue.
    if (action === "etat") {
      const { data } = await db
        .from("perso_polar_link")
        .select("polar_user_id, created_at, last_sync_at, last_sync_note")
        .eq("user_id", moi.id)
        .maybeSingle();
      return json({
        configure: !!r,
        lie: !!data,
        polarUserId: data?.polar_user_id ?? null,
        depuis: data?.created_at ?? null,
        derniereSync: data?.last_sync_at ?? null,
        note: data?.last_sync_note ?? null,
      });
    }

    if (!r) return json({ error: "polar_non_configure" }, 503);

    if (action === "url") {
      const url = new URL(AUTORISATION);
      url.searchParams.set("client_id", r.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", r.redirect);
      return json({ url: url.toString() });
    }

    if (action === "lier") {
      const code = texte(body.code);
      if (!code) return json({ error: "code_manquant" }, 400);

      const jeton = await echanger(r, code);
      // Le member-id doit être stable et propre au compte : l'identifiant
      // Supabase fait exactement ça. Un identifiant tiré au hasard à chaque
      // tentative créerait un nouvel « utilisateur » Polar à chaque essai.
      const memberId = moi.id;
      await enregistrer(jeton.access_token, memberId);

      const polarUserId = jeton.x_user_id != null ? String(jeton.x_user_id) : null;
      if (!polarUserId) return json({ error: "polar_sans_identifiant" }, 502);

      const { error } = await db.from("perso_polar_link").upsert(
        {
          user_id: moi.id,
          polar_user_id: polarUserId,
          member_id: memberId,
          access_token: jeton.access_token,
          last_sync_at: null,
          last_sync_note: null,
        },
        { onConflict: "user_id" },
      );
      if (error) return json({ error: "ecriture", detail: error.message }, 502);
      return json({ lie: true, polarUserId });
    }

    // Les actions suivantes ont toutes besoin du lien.
    const { data: lien } = await db
      .from("perso_polar_link")
      .select("polar_user_id, access_token")
      .eq("user_id", moi.id)
      .maybeSingle();
    if (!lien) return json({ error: "pas_lie" }, 409);

    if (action === "sync") {
      const brut = await seancesPolar(lien.access_token);
      const lignes: Ligne[] = [];
      const vus = new Set<string>();
      for (const x of Array.isArray(brut) ? brut : []) {
        const l = ligneDe(x, moi.id);
        if (l && !vus.has(l.polar_id)) {
          vus.add(l.polar_id);
          lignes.push(l);
        }
      }

      if (lignes.length) {
        // `upsert` sur (user_id, polar_id) : la route rend les trente derniers
        // jours à chaque appel, donc chaque synchronisation revoit les mêmes
        // séances. Sans ça, une ligne de plus par passage.
        const { error } = await db
          .from("perso_polar_exercices")
          .upsert(lignes, { onConflict: "user_id,polar_id" });
        if (error) return json({ error: "ecriture", detail: error.message }, 502);
      }

      const note =
        lignes.length === 0
          ? "Rien à rapporter — as-tu synchronisé le capteur dans l’application Polar ?"
          : `${lignes.length} séance${lignes.length > 1 ? "s" : ""} vue${lignes.length > 1 ? "s" : ""} sur 30 jours.`;
      await db
        .from("perso_polar_link")
        .update({ last_sync_at: new Date().toISOString(), last_sync_note: note })
        .eq("user_id", moi.id);

      return json({ vues: lignes.length, note });
    }

    if (action === "delier") {
      // On prévient Polar : ça révoque le jeton de leur côté. Un échec ici ne
      // doit pas empêcher d'oublier le lien du nôtre — sinon on reste attaché à
      // un compte qu'on ne peut plus détacher.
      try {
        await fetch(`${API}/users/${lien.polar_user_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${lien.access_token}` },
        });
      } catch { /* tant pis, on détache quand même */ }
      await db.from("perso_polar_link").delete().eq("user_id", moi.id);
      return json({ lie: false });
    }

    return json({ error: "action_inconnue" }, 400);
  } catch (e) {
    return json({ error: "exception", detail: String(e instanceof Error ? e.message : e) }, 500);
  }
});
