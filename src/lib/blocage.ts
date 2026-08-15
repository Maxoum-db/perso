import { fetchKv, saveKv } from './kv'
import { MUSCLE_LABELS, type MuscleRegion } from './muscles'

// Mise au repos TOTAL d'un muscle, pour une durée décidée.
//
// Une gêne, une douleur, une articulation qui proteste : le muscle sort du jeu.
// Il passe au noir sur le mannequin et disparaît du vivier du générateur — pas
// pénalisé, pas classé dernier : absent.
//
// ── Pourquoi ce n'est PAS un cran de plus sur la barre des courbatures ──────
//
// La barre corrige un barème : « ça tire plus que prévu, ajoute deux jours ».
// Sa déclaration est rattachée à la SÉANCE qui l'a provoquée et s'efface dès
// que le muscle est retravaillé — c'est exactement ce qu'on veut d'un ressenti.
//
// Un blocage dit l'inverse : il doit tenir MALGRÉ tout, et surtout ne pas
// s'effacer parce qu'on a retravaillé le muscle. Le stocker comme une
// courbature l'aurait fait disparaître au premier exercice qui touche l'épaule
// bloquée, c'est-à-dire au moment précis où il aurait dû empêcher cet exercice.
//
// Il vit donc à part, avec une date de fin absolue, et ne dépend d'aucune
// séance. La barre s'arrête à « ça tire » ; le blocage est ce qu'il y a au bout,
// et c'est un autre objet.
//
// ── Pas de blocage sans fin ─────────────────────────────────────────────────
//
// Toutes les durées proposées sont bornées, et c'est délibéré. Un blocage
// « jusqu'à nouvel ordre » qu'on oublie retire des exercices pour toujours sans
// que rien ne le rappelle — le générateur composerait autour d'un trou dont on
// ne se souvient plus. Il se prolonge d'un geste ; il ne s'installe pas tout
// seul.

export interface Blocage {
  /** Instant de fin, en ISO. Passé cette date, le muscle revient au barème. */
  jusqua: string
  /** Quand il a été posé — pour l'afficher et pour prolonger depuis la fin. */
  depuis: string
  /** Ce qui l'a motivé, si on a pris la peine de l'écrire. */
  motif?: string
}

export type Blocages = Partial<Record<MuscleRegion, Blocage>>

const KEY = 'muscu_blocages'

/**
 * Durées proposées, du plus court au plus long.
 *
 * Commence à 12 h — le pas du mannequin, donc la plus petite durée qui se voie
 * quelque part — et s'arrête à un mois : au-delà, ce n'est plus une gêne qu'on
 * gère avec un curseur, c'est une blessure qui demande un avis.
 */
export const DUREES_BLOCAGE = [
  { heures: 12, label: '12 h' },
  { heures: 24, label: '1 j' },
  { heures: 48, label: '2 j' },
  { heures: 72, label: '3 j' },
  { heures: 168, label: '1 sem.' },
  { heures: 336, label: '2 sem.' },
  { heures: 720, label: '1 mois' },
] as const

export const DUREE_BLOCAGE_DEFAUT = 72

export async function loadBlocages(userId: string): Promise<Blocages> {
  const b = await fetchKv<Blocages>(userId, KEY, {})
  return b && typeof b === 'object' ? b : {}
}

export async function saveBlocages(userId: string, b: Blocages): Promise<void> {
  await saveKv(userId, KEY, b)
}

/**
 * Pose un blocage de `heures` à partir de maintenant, ou le retire si `heures`
 * vaut 0.
 *
 * La fin se compte depuis MAINTENANT et non depuis la pose précédente :
 * prolonger un blocage de trois jours qui expire dans une heure doit donner
 * trois jours, pas trois jours et une heure. C'est ce qu'on veut dire quand on
 * reclique sur « 3 j » alors que ça fait toujours mal.
 */
export function declarerBlocage(
  blocages: Blocages,
  region: MuscleRegion,
  heures: number,
  maintenant = Date.now(),
  motif?: string,
): Blocages {
  const next = { ...blocages }
  if (heures <= 0) delete next[region]
  else
    next[region] = {
      jusqua: new Date(maintenant + heures * 3600_000).toISOString(),
      depuis: new Date(maintenant).toISOString(),
      ...(motif ? { motif } : {}),
    }
  return next
}

/** Le blocage encore actif d'un muscle, ou `null`. */
export function blocageActif(
  blocages: Blocages,
  region: MuscleRegion,
  maintenant = Date.now(),
): Blocage | null {
  const b = blocages[region]
  if (!b) return null
  const fin = Date.parse(b.jusqua)
  if (!Number.isFinite(fin) || fin <= maintenant) return null
  return b
}

/**
 * Les muscles actuellement bloqués.
 *
 * Un Set et pas un tableau : c'est une question d'appartenance posée une fois
 * par exercice du catalogue, soit trois cents fois par composition.
 */
export function regionsBloquees(blocages: Blocages, maintenant = Date.now()): Set<MuscleRegion> {
  const out = new Set<MuscleRegion>()
  for (const region of Object.keys(blocages) as MuscleRegion[]) {
    if (blocageActif(blocages, region, maintenant)) out.add(region)
  }
  return out
}

/**
 * Un exercice touche-t-il un muscle bloqué ?
 *
 * N'IMPORTE QUELLE part suffit, même 0,1. C'est le sens de « repos total » : sur
 * une épaule qui fait mal, on ne veut pas non plus de l'exercice où elle ne fait
 * que stabiliser — c'est souvent celui-là qui réveille la douleur.
 *
 * La contrepartie est réelle et assumée : bloquer un muscle profond qui
 * stabilise presque tout peut vider le vivier. C'est la vérité de la situation,
 * pas un défaut du filtre — mais il faut alors le DIRE, et c'est pourquoi le
 * générateur compte ce que le blocage lui retire au lieu de rendre une séance
 * courte sans explication.
 */
export function exerciceBloque(
  muscles: Iterable<MuscleRegion>,
  bloquees: Set<MuscleRegion>,
): boolean {
  if (bloquees.size === 0) return false
  for (const r of muscles) if (bloquees.has(r)) return true
  return false
}

/** Purge les blocages expirés : sans ça le KV garde tout l'historique. */
export function nettoyerBlocages(blocages: Blocages, maintenant = Date.now()): Blocages {
  const out: Blocages = {}
  for (const region of Object.keys(blocages) as MuscleRegion[]) {
    const b = blocageActif(blocages, region, maintenant)
    if (b) out[region] = b
  }
  return out
}

/** « encore 2 j », « encore 5 h », « moins d'une heure ». */
export function resteBlocage(b: Blocage, maintenant = Date.now()): string {
  const ms = Date.parse(b.jusqua) - maintenant
  if (!Number.isFinite(ms) || ms <= 0) return 'terminé'
  const heures = ms / 3600_000
  if (heures < 1) return 'moins d’une heure'
  if (heures < 48) return `encore ${Math.round(heures)} h`
  return `encore ${Math.round(heures / 24)} j`
}

/** « Épaule droite, grand pectoral » — pour dire ce qui est retiré. */
export function libellesBloques(bloquees: Set<MuscleRegion>): string {
  return [...bloquees].map((r) => MUSCLE_LABELS[r]).join(', ')
}
