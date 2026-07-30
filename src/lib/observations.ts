import { fetchKv, saveKv } from './kv'
import { VITESSE_RECUP, type ReposMuscle } from './recuperation'
import { MUSCLE_LABELS, type MuscleRegion } from './muscles'
import type { IntensiteId } from './intensite'

// Journal des ressentis déclarés — la base pour affiner le barème plus tard.
//
// Le barème actuel repose sur de la littérature générale : part de fibres lentes,
// masse, usage quotidien, exposition à l'excentrique. Ce sont de bonnes moyennes,
// et de mauvaises prédictions individuelles. Tes ischios ne récupèrent pas comme
// « les ischios ».
//
// Chaque fois que tu corriges le barème, tu produis une mesure : à cet instant, le
// modèle prévoyait X et tu as observé Y. Une seule de ces mesures ne dit rien ;
// trente disent si une zone est systématiquement mal réglée, et de combien.
//
// D'où la règle de conception : on enregistre la PRÉDICTION en même temps que
// l'observation, ainsi que les paramètres qui ont servi à la produire. Sans la
// prédiction, l'écart est irrécupérable a posteriori — et si on change le modèle
// demain, les observations passées deviendraient illisibles.

export interface Observation {
  /** Instant de la déclaration (ISO). Sert aussi de clé de tri. */
  at: string
  /** Muscle touché, quand la déclaration vient de la fiche du mannequin. */
  region: MuscleRegion
  /** Libellé de groupe déclaré dans la séance — c'est lui qui porte la charge. */
  group: string
  /** Date de la séance à l'origine. */
  seance: string
  /** Ancienneté réelle de la séance au moment de la déclaration, en jours. */
  joursReels: number
  /** Part du muscle dans l'exercice (1 = moteur principal). */
  part: number
  /** Intensité déclarée de la séance, si elle l'était. */
  intensite?: IntensiteId
  /** Jours ressentis que le barème PRÉVOYAIT à cet instant. */
  prevu: number
  /** Vitesse de zone utilisée pour cette prédiction — le modèle peut changer. */
  vitesse: number
  /**
   * Ce que tu as déclaré :
   *   • un nombre de jours d'ajustement (négatif = ça va mieux que prévu) ;
   *   • ou `pret`, « c'est totalement bon », qui n'a pas d'équivalent chiffré.
   */
  ajustement: number
  pret?: boolean
}

export type Observations = Observation[]

const KEY = 'muscu_observations'

/** Au-delà, on oublie les plus anciennes : le KV n'est pas un entrepôt. */
const MAX = 500

export async function loadObservations(userId: string): Promise<Observations> {
  const o = await fetchKv<Observations>(userId, KEY, [])
  return Array.isArray(o) ? o : []
}

export async function saveObservations(userId: string, o: Observations): Promise<void> {
  await saveKv(userId, KEY, o)
}

/**
 * Ajoute une observation, en remplaçant celle du même muscle pour la même séance.
 *
 * Remplacer et non empiler : si tu tâtonnes sur la barre, cinq crans successifs
 * produiraient cinq mesures dont quatre que tu as toi-même corrigées. Seule la
 * dernière dit ce que tu penses.
 */
export function noterObservation(
  connues: Observations,
  obs: Observation,
): Observations {
  const autres = connues.filter((o) => !(o.region === obs.region && o.seance === obs.seance))
  return [...autres, obs].slice(-MAX)
}

/**
 * Construit l'observation correspondant à une déclaration sur la fiche d'un muscle.
 *
 * `null` quand le muscle n'a pas de charge connue : sans séance d'origine il n'y a
 * ni prédiction ni ancienneté, donc rien à mesurer.
 */
export function observationDepuisFiche(
  region: MuscleRegion,
  info: ReposMuscle | undefined,
  ajustement: number,
  pret: boolean,
  maintenant: string,
): Observation | null {
  if (!info) return null
  return {
    at: maintenant,
    region,
    group: info.label,
    seance: info.dateSeance,
    joursReels: info.joursReels,
    part: info.intensite,
    intensite: info.intensiteId,
    // La prédiction du barème, avant ta correction : c'est elle qu'on cherche à
    // juger. Elle est PORTÉE par la charge et non recalculée — voir le champ.
    prevu: info.joursPrevus,
    vitesse: VITESSE_RECUP[region],
    ajustement,
    ...(pret ? { pret: true } : {}),
  }
}

// ── Ce que la base raconte ──────────────────────────────────────────────────

export interface BilanZone {
  region: MuscleRegion
  label: string
  /** Nombre d'observations pour cette zone. */
  n: number
  /**
   * Écart moyen, en jours ressentis. POSITIF = tu déclares plus de courbatures
   * que prévu, donc le barème est trop optimiste et la zone récupère plus
   * lentement qu'on ne le croit. Négatif = l'inverse.
   */
  ecart: number
  /** Vitesse actuelle de la zone. */
  vitesse: number
  /** Vitesse qu'il faudrait, si l'écart moyen se confirmait. */
  vitesseSuggeree: number
  /** Nombre de fois où tu as dit « totalement bon ». */
  prets: number
}

/**
 * Seuil de crédibilité d'une zone.
 *
 * En dessous, on affiche le compte mais aucune suggestion : trois déclarations
 * sur un muscle ne distinguent pas une tendance d'une mauvaise semaine, et
 * proposer un réglage sur si peu donnerait à du bruit l'allure d'une mesure.
 */
export const MIN_OBSERVATIONS = 8

export function bilanParZone(obs: Observations): BilanZone[] {
  const par = new Map<MuscleRegion, Observation[]>()
  for (const o of obs) {
    const l = par.get(o.region) ?? []
    l.push(o)
    par.set(o.region, l)
  }

  const out: BilanZone[] = []
  for (const [region, liste] of par) {
    // « Totalement bon » n'a pas de valeur chiffrée : il compte dans le total et
    // dans son propre compteur, mais il ne peut pas entrer dans une moyenne.
    const chiffrees = liste.filter((o) => !o.pret)
    const ecart = chiffrees.length
      ? chiffrees.reduce((s, o) => s + o.ajustement * o.vitesse, 0) / chiffrees.length
      : 0
    const vitesse = VITESSE_RECUP[region]
    out.push({
      region,
      label: MUSCLE_LABELS[region],
      n: liste.length,
      ecart,
      vitesse,
      vitesseSuggeree: vitesseSuggeree(liste, vitesse),
      prets: liste.filter((o) => o.pret).length,
    })
  }
  return out.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
}

/**
 * Vitesse que les observations suggèrent pour une zone.
 *
 * Le raisonnement : à ancienneté réelle égale, tu as déclaré `prevu + écart` au
 * lieu de `prevu`. La vitesse est le facteur qui relie jours réels et jours
 * ressentis, donc la corriger revient à multiplier par le rapport des deux.
 *
 * Volontairement conservateur : on ne bouge que de la moitié de ce que l'écart
 * suggère, et jamais de plus de 25 %. Une base de trente déclarations subjectives
 * ne justifie pas de réécrire un barème d'un coup — et se tromper en gardant un
 * muscle au repos plus longtemps ne coûte rien.
 */
function vitesseSuggeree(liste: Observation[], vitesse: number): number {
  const chiffrees = liste.filter((o) => !o.pret && o.prevu > 0)
  if (chiffrees.length < MIN_OBSERVATIONS) return vitesse
  let rapports = 0
  for (const o of chiffrees) {
    // Un ajustement POSITIF (ça tire) veut dire moins de jours ressentis
    // qu'annoncé : le muscle est plus lent, donc sa vitesse doit baisser.
    const observe = Math.max(0.1, o.prevu - o.ajustement * o.vitesse)
    rapports += observe / o.prevu
  }
  const facteur = rapports / chiffrees.length
  const amorti = 1 + (facteur - 1) / 2
  const borne = Math.max(0.75, Math.min(1.25, amorti))
  return Math.round(vitesse * borne * 100) / 100
}

/** « le barème est trop optimiste de 0,4 j » — l'écart, en français. */
export function fmtEcart(ecart: number): string {
  if (Math.abs(ecart) < 0.15) return 'barème juste'
  const abs = Math.abs(ecart)
  const duree = abs < 1 ? `${Math.round(abs * 24)} h` : `${abs.toFixed(1).replace('.', ',')} j`
  return ecart > 0 ? `trop optimiste de ${duree}` : `trop prudent de ${duree}`
}
