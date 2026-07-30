import { fetchKv, saveKv } from './kv'
import { PAS_JOURS, type GroupLoad } from './muscu'

// Le sommeil, et ce qu'il fait à la récupération.
//
// Le barème comptait les jours écoulés depuis une séance comme si toutes les
// nuits se valaient. Or c'est la nuit que le muscle se répare : une nuit de six
// heures hachée par deux réveils n'apporte pas la même récupération qu'une nuit
// pleine, et deux jours après une grosse séance de jambes, c'est exactement ce
// qui fait la différence entre pouvoir y retourner et se blesser.
//
// Deux choses comptent, et pas une seule :
//
//   • la DURÉE, par rapport à 8 h — c'est la référence retenue, milieu de la
//     fourchette adulte, et le seuil sous lequel la synthèse protéique et la
//     sécrétion d'hormone de croissance nocturne décrochent ;
//   • la CONTINUITÉ — le sommeil profond arrive par cycles, et un réveil en
//     coupe un. Sept heures d'affilée ne valent pas sept heures en trois
//     morceaux, même durée totale. C'est pourquoi les réveils coûtent en plus du
//     temps qu'ils ont fait perdre.

export interface Nuit {
  /** Temps passé au lit, en heures (on retire les réveils ensuite). */
  heures: number
  /** Nombre de réveils dans la nuit. */
  reveils: number
  /** Minutes passées éveillé au total pendant ces réveils. */
  minutesEveille: number
}

/** Une nuit par date de RÉVEIL (le matin où tu te lèves), format YYYY-MM-DD. */
export type Nuits = Record<string, Nuit>

const KEY = 'muscu_sommeil'

/** La nuit de référence, celle qui ne change rien au barème. */
export const NUIT_REFERENCE = 8

/**
 * Coût d'une heure manquante, en jours de récupération.
 *
 * 0,2 j — soit un peu moins de 5 h. Une nuit de 6 h coûte donc 0,4 j : assez
 * pour décaler d'une section de 12 h sur le mannequin, pas assez pour qu'une
 * seule mauvaise nuit fasse tout basculer.
 */
const COUT_HEURE_MANQUANTE = 0.2

/**
 * Gain d'une heure en plus, en jours. Volontairement plus faible que le coût :
 * on ne rattrape pas une dette de sommeil en dormant douze heures le samedi, et
 * se tromper en s'accordant du repos ne coûte rien — se tromper dans l'autre
 * sens, si. Même asymétrie que la barre de ressenti et que l'intensité déclarée.
 */
const GAIN_HEURE_SUP = 0.125

/** Coût d'un réveil, en plus du temps qu'il a fait perdre : la continuité compte. */
const COUT_REVEIL = 0.1

/** Bornes de l'effet d'UNE nuit. Aucune nuit ne décide à elle seule. */
export const NUIT_MIN = -0.5
export const NUIT_MAX = 0.25

/**
 * Bornes de l'effet CUMULÉ des nuits depuis la séance.
 *
 * Sans plafond, deux semaines de sommeil pourri figeraient un muscle en rouge
 * indéfiniment, ce qui serait faux : le corps finit par s'adapter, et surtout un
 * mannequin qui ne repasse jamais au vert ne sert plus à rien.
 */
export const CUMUL_MIN = -2
export const CUMUL_MAX = 1

/** Sommeil réellement dormi : le temps au lit moins les réveils. */
export function sommeilNet(n: Nuit): number {
  return Math.max(0, n.heures - n.minutesEveille / 60)
}

/**
 * Ce qu'une nuit ajoute (ou retire) à la récupération, en jours.
 *
 * Négatif quand elle a été mauvaise : le muscle est alors traité comme s'il
 * avait moins récupéré que le temps écoulé ne le laisse croire.
 */
export function effetNuit(n: Nuit): number {
  const net = sommeilNet(n)
  const ecart = net - NUIT_REFERENCE
  const duree = ecart < 0 ? ecart * COUT_HEURE_MANQUANTE : ecart * GAIN_HEURE_SUP
  const continuite = -Math.max(0, n.reveils) * COUT_REVEIL
  return Math.max(NUIT_MIN, Math.min(NUIT_MAX, duree + continuite))
}

/** « bonne nuit », « nuit courte », « nuit hachée » — ce qu'on lit sur la fiche. */
export function qualifieNuit(n: Nuit): string {
  const effet = effetNuit(n)
  const net = sommeilNet(n)
  if (effet >= 0.1) return 'très bonne nuit'
  if (effet > -0.1) return 'bonne nuit'
  // Distinguer les deux causes : on ne corrige pas une nuit courte comme une
  // nuit hachée. La première se règle à l'heure du coucher, la seconde non.
  if (n.reveils >= 2 && net >= NUIT_REFERENCE - 1) return 'nuit hachée'
  if (effet <= NUIT_MIN + 1e-9) return 'très mauvaise nuit'
  return net < NUIT_REFERENCE - 1 ? 'nuit courte' : 'nuit moyenne'
}

/**
 * Effet cumulé des nuits postérieures à une date, en jours de récupération.
 *
 * Seules comptent les nuits d'APRÈS la séance : celle de la veille n'a rien
 * réparé de ce qui n'existait pas encore. Une nuit non renseignée est neutre —
 * on ne devine pas, et surtout on ne pénalise pas l'oubli de saisie.
 */
export function effetDepuis(nuits: Nuits, dateSeance: string, aujourdhui: string): number {
  let total = 0
  for (const [date, nuit] of Object.entries(nuits)) {
    if (date <= dateSeance || date > aujourdhui) continue
    total += effetNuit(nuit)
  }
  return Math.max(CUMUL_MIN, Math.min(CUMUL_MAX, total))
}

/**
 * Applique le sommeil aux charges par groupe.
 *
 * Même mécanique que les courbatures déclarées : on ajoute aux jours ressentis,
 * en négatif quand le sommeil a manqué. Le plafond orange est REPOSÉ après coup —
 * un bon sommeil ne doit pas faire sauter la journée qui vient de se passer, pas
 * plus qu'une récup active ne le fait.
 */
export function applySommeil(
  loads: Record<string, GroupLoad>,
  nuits: Nuits,
  aujourdhui = new Date().toLocaleDateString('en-CA'),
): Record<string, GroupLoad> {
  const out: Record<string, GroupLoad> = {}
  for (const [group, load] of Object.entries(loads)) {
    const delta = effetDepuis(nuits, load.date, aujourdhui)
    if (delta === 0) {
      out[group] = load
      continue
    }
    const joursPlafonnes = load.intensity >= 0.5 ? 2 : 1
    const cumul = Math.max(0, load.effectiveDays + delta)
    out[group] = {
      ...load,
      effectiveDays: load.days <= joursPlafonnes ? Math.min(cumul, 4) : cumul,
      sommeilDelta: delta,
    }
  }
  return out
}

// ── Stockage ────────────────────────────────────────────────────────────────

export async function loadNuits(userId: string): Promise<Nuits> {
  const n = await fetchKv<Nuits>(userId, KEY, {})
  return n && typeof n === 'object' ? n : {}
}

export async function saveNuits(userId: string, nuits: Nuits): Promise<void> {
  await saveKv(userId, KEY, nuits)
}

/**
 * Pose ou retire une nuit. `null` la retire — on ne garde pas de coquille vide.
 *
 * Fonction PURE, volontairement séparée de l'écriture : l'écran met son état à
 * jour tout de suite avec le résultat, puis la persistance part de son côté.
 * L'inverse — attendre le réseau avant d'afficher — faisait perdre la saisie
 * chaque fois que l'écriture échouait, et c'est le contraire de ce que fait le
 * reste du module pour les courbatures et les intensités.
 */
export function poserNuit(connues: Nuits, date: string, nuit: Nuit | null): Nuits {
  const next = { ...connues }
  if (nuit) next[date] = nuit
  else delete next[date]
  return next
}

/** Les N dernières nuits renseignées, de la plus récente à la plus ancienne. */
export function dernieresNuits(nuits: Nuits, n = 14): Array<[string, Nuit]> {
  return (Object.entries(nuits) as Array<[string, Nuit]>)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, n)
}

/**
 * Moyenne de sommeil net sur les nuits renseignées d'une fenêtre.
 *
 * Sur les nuits RENSEIGNÉES et non sur la fenêtre entière : compter une nuit
 * oubliée comme zéro heure de sommeil donnerait une moyenne absurde.
 */
export function moyenneNet(nuits: Nuits, jours = 7, aujourdhui = new Date().toLocaleDateString('en-CA')): number | null {
  const debut = new Date(aujourdhui + 'T00:00:00')
  debut.setDate(debut.getDate() - jours + 1)
  const min = debut.toLocaleDateString('en-CA')
  const retenues = Object.entries(nuits).filter(([d]) => d >= min && d <= aujourdhui)
  if (retenues.length === 0) return null
  return retenues.reduce((s, [, n]) => s + sommeilNet(n), 0) / retenues.length
}

/** Dette de sommeil de la semaine : heures manquantes par rapport à 8 h/nuit. */
export function dette(nuits: Nuits, jours = 7, aujourdhui = new Date().toLocaleDateString('en-CA')): number {
  const debut = new Date(aujourdhui + 'T00:00:00')
  debut.setDate(debut.getDate() - jours + 1)
  const min = debut.toLocaleDateString('en-CA')
  let d = 0
  for (const [date, n] of Object.entries(nuits)) {
    if (date < min || date > aujourdhui) continue
    d += NUIT_REFERENCE - sommeilNet(n)
  }
  return d
}

/** « 7 h 30 », « 6 h » — une durée en heures décimales, lisible. */
export function fmtHeures(h: number): string {
  const heures = Math.floor(h)
  const minutes = Math.round((h - heures) * 60)
  if (minutes === 0) return `${heures} h`
  if (minutes === 60) return `${heures + 1} h`
  return `${heures} h ${String(minutes).padStart(2, '0')}`
}

/** Pas de saisie des heures : la demi-heure, comme le reste du module. */
export const PAS_HEURES_SAISIE = PAS_JOURS // 0.5
