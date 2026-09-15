import { supabase } from './supabase'
import { dateDe, nomSport, type SeancePolar } from './polarFlow'

// Le côté navigateur du pont Polar Flow.
//
// Tout passe par la fonction `polar` : le jeton d'accès ne descend jamais
// jusqu'ici, et la table qui le garde n'a aucune politique RLS. L'écran demande
// donc son ÉTAT au serveur — « suis-je lié, quand ai-je synchronisé » — au lieu
// de lire une table qu'il n'a pas le droit de lire.
//
// Les séances importées, elles, se lisent directement : ce sont des données
// d'entraînement, pas un secret.

export interface EtatPolar {
  /** Les identifiants Polar sont-ils installés côté serveur ? */
  configure: boolean
  lie: boolean
  polarUserId: string | null
  depuis: string | null
  derniereSync: string | null
  note: string | null
}

export const ETAT_INCONNU: EtatPolar = {
  configure: false,
  lie: false,
  polarUserId: null,
  depuis: null,
  derniereSync: null,
  note: null,
}

/**
 * Vrai quand le pont n'existe pas encore : fonction non déployée (404) ou
 * déployée sans ses identifiants (503).
 *
 * Les deux se disent pareil à l'écran — « pas encore configuré » — parce que
 * la réponse est la même : poser les secrets et déployer. Distinguer les deux
 * ne servirait qu'à celui qui les pose, et le README le dit déjà.
 */
export class PolarPasConfigure extends Error {
  constructor() {
    super('Polar n’est pas encore configuré côté serveur.')
    this.name = 'PolarPasConfigure'
  }
}

async function appeler<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('polar', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx?.status === 503 || ctx?.status === 404) throw new PolarPasConfigure()
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(messageLisible(data.error as string, data.detail as string | undefined))
  return data as T
}

/**
 * Traduit les codes d'erreur du serveur.
 *
 * Écrit ici et pas dans la fonction : le serveur rend des codes stables, qu'on
 * peut lire dans des journaux ; l'écran rend des phrases, qu'on peut lire à
 * sept heures du matin. Les deux besoins ne se servent pas du même texte.
 */
function messageLisible(code: string, detail?: string): string {
  if (code === 'polar_non_configure') return 'Polar n’est pas encore configuré côté serveur.'
  if (code === 'pas_lie') return 'Ce compte n’est pas relié à Polar Flow.'
  if (code === 'code_manquant') return 'Polar n’a pas renvoyé de code d’autorisation.'
  if (code === 'non_authentifie') return 'Reconnecte-toi, la session a expiré.'
  if (code.startsWith('polar_token_')) return 'Polar a refusé l’autorisation. Réessaie la connexion.'
  if (code.startsWith('polar_register_')) return 'Polar a refusé l’enregistrement du compte.'
  if (code.startsWith('polar_exercises_403')) return 'Polar refuse la lecture : le compte n’est pas (ou plus) enregistré.'
  if (code.startsWith('polar_exercises_')) return 'Polar n’a pas répondu correctement. Réessaie plus tard.'
  return detail ? `${code} — ${detail}` : code
}

export async function etatPolar(): Promise<EtatPolar> {
  // Un pont absent n'est pas une panne à signaler : c'est un état, et
  // `configure: false` le dit déjà. L'écran affiche alors la marche à suivre
  // au lieu d'un message d'erreur que personne ne peut traiter.
  try {
    return await appeler<EtatPolar>({ action: 'etat' })
  } catch (e) {
    if (e instanceof PolarPasConfigure) return ETAT_INCONNU
    throw e
  }
}

export async function urlAutorisation(): Promise<string> {
  const { url } = await appeler<{ url: string }>({ action: 'url' })
  return url
}

export async function lierPolar(code: string): Promise<void> {
  await appeler({ action: 'lier', code })
}

export async function synchroniserPolar(): Promise<{ vues: number; note: string }> {
  return await appeler<{ vues: number; note: string }>({ action: 'sync' })
}

export async function delierPolar(): Promise<void> {
  await appeler({ action: 'delier' })
}

// ── Les séances rapportées ──────────────────────────────────────────────────

export interface SeanceImportee extends SeancePolar {
  /** Date locale (AAAA-MM-JJ), telle que rangée en base. */
  date: string
}

export async function listerSeancesPolar(userId: string, limite = 40): Promise<SeanceImportee[]> {
  const { data, error } = await supabase
    .from('perso_polar_exercices')
    .select('polar_id, debut, date, duree_s, sport, appareil, calories, distance_m, fc_moyenne, fc_max, charge_polar')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.polar_id as string,
    debut: r.debut as string,
    date: r.date as string,
    dureeS: (r.duree_s as number | null) ?? null,
    sport: (r.sport as string | null) ?? null,
    appareil: (r.appareil as string | null) ?? null,
    calories: (r.calories as number | null) ?? null,
    distanceM: (r.distance_m as number | null) ?? null,
    fcMoyenne: (r.fc_moyenne as number | null) ?? null,
    fcMax: (r.fc_max as number | null) ?? null,
    chargePolar: (r.charge_polar as number | null) ?? null,
  }))
}

export async function oublierSeancePolar(userId: string, polarId: string): Promise<void> {
  const { error } = await supabase
    .from('perso_polar_exercices')
    .delete()
    .eq('user_id', userId)
    .eq('polar_id', polarId)
  if (error) throw new Error(error.message)
}

/** « 48 min », « 1 h 12 » — la durée telle qu'on la dit. */
export function fmtDuree(s: number | null): string {
  if (s === null || s <= 0) return '—'
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** Le titre d'une séance importée : le sport, et l'heure pour la distinguer. */
export function titreSeance(s: SeanceImportee): string {
  const heure = /T(\d{2}):(\d{2})/.exec(s.debut)
  return heure ? `${nomSport(s.sport)} · ${heure[1]}h${heure[2]}` : nomSport(s.sport)
}

export { dateDe }
