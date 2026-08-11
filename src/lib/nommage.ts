// Le NOM d'une séance, déduit de ce qu'elle a réellement travaillé.
//
// Une séance s'appelait comme la case qu'on avait ouverte : « Séance vierge »,
// le nom du modèle, ou celui que le générateur avait posé AVANT qu'on la fasse.
// Trois heures plus tard, la moitié des exercices avaient changé et le titre du
// journal ne décrivait plus rien. Le nom se recalcule donc à « Terminé », sur
// les séries réellement cochées.
//
// Deux règles, et rien d'autre :
//
//   • on nomme les muscles ICONIQUES — ceux qu'on annonce quand on dit ce qu'on
//     a fait. Personne ne dit « j'ai fait sous-scapulaire et dentelé » ; la
//     coiffe est comptée avec l'épaule, la sangle profonde avec les abdos ;
//   • deux, trois au plus. Au-delà, un titre cesse de dire quoi que ce soit.

import { ZONE_LARGE, type MuscleRegion } from './muscles'
import { apportSeries, musclesDeLExercice } from './composition'

/** Ce qu'on porte dans un nom de séance. Une zone absente ne se nomme jamais. */
const ICONIQUE: Record<string, string | null> = {
  // ── Tronc ──
  Cou: 'Cou',
  Nuque: 'Cou',
  Abdominaux: 'Abdos',
  'Sangle profonde': 'Abdos',
  Obliques: 'Obliques',
  Dentelé: null,
  Lombaires: 'Lombaires',
  // ── Dos et épaules ──
  // Grand dorsal et milieu du dos se disent « dos » : le mannequin les sépare
  // parce que ce sont deux mouvements, un titre de séance n'a pas à le faire.
  'Grand dorsal': 'Dos',
  'Milieu du dos': 'Dos',
  Trapèzes: 'Trapèzes',
  Épaules: 'Épaules',
  Coiffe: 'Épaules',
  'Sous-scapulaire': 'Épaules',
  // ── Bras ──
  Biceps: 'Biceps',
  Triceps: 'Triceps',
  'Avant-bras': 'Avant-bras',
  Pronation: 'Avant-bras',
  Préhension: 'Préhension',
  // ── Poitrine ──
  Pectoraux: 'Pectoraux',
  // ── Jambes ──
  Fessiers: 'Fessiers',
  Quadriceps: 'Quadriceps',
  Ischios: 'Ischios',
  Adducteurs: 'Adducteurs',
  Mollets: 'Mollets',
  Chevilles: null,
  'Rotateurs de hanche': null,
  'Fléchisseurs de hanche': null,
}

/**
 * Notoriété du muscle, à volume comparable.
 *
 * Un développé couché touche le pectoral, l'épaule et le triceps ; les trois
 * sortent à peu près au même volume effectif, et « Épaules · Triceps »
 * décrirait mal ce qu'on vient de faire. Le classement départage.
 */
const NOTORIETE: Record<string, number> = {
  Pectoraux: 1,
  Dos: 1,
  Quadriceps: 1,
  Épaules: 0.9,
  Fessiers: 0.9,
  Ischios: 0.9,
  Biceps: 0.85,
  Triceps: 0.85,
  Abdos: 0.85,
  Trapèzes: 0.8,
  Mollets: 0.8,
  Lombaires: 0.75,
  Cou: 0.75,
  Obliques: 0.7,
  Préhension: 0.65,
  'Avant-bras': 0.6,
  Adducteurs: 0.55,
}

/** Au plus trois muscles nommés : c'est la demande, et c'est la limite du lisible. */
export const MAX_MUSCLES_NOM = 3

/**
 * Sous cette part du muscle de tête, un muscle n'est plus le sujet de la séance.
 *
 * La moitié : un mouvement qui apporte moins de la moitié du volume du premier
 * est un accessoire, pas un titre.
 */
const PART_MINIMALE = 0.5

export interface LigneNommable {
  name: string
  muscle_group: string
  sets: number
}

/** Volume effectif par muscle iconique, séries pondérées par la part du muscle. */
export function volumeIconique(exos: LigneNommable[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of exos) {
    const sets = Math.max(1, Math.round(e.sets) || 1)
    for (const [region, n] of apportSeries(musclesDeLExercice(e.muscle_group), sets)) {
      const zone = ZONE_LARGE[region as MuscleRegion]
      const nom = zone ? ICONIQUE[zone] : undefined
      if (!nom) continue
      out.set(nom, (out.get(nom) ?? 0) + n)
    }
  }
  return out
}

/**
 * Les deux ou trois muscles qui font la séance, du plus travaillé au moins.
 *
 * Vide quand rien n'est identifiable — un exercice sans étiquetage, une séance
 * qui n'a que sa ligne de ressenti. Le nom d'origine reste alors en place :
 * mieux vaut un titre imparfait qu'un titre faux.
 */
export function musclesDuNom(exos: LigneNommable[]): string[] {
  const volumes = [...volumeIconique(exos).entries()]
  if (volumes.length === 0) return []
  const classes = volumes
    .map(([nom, v]) => ({ nom, v, poids: v * (NOTORIETE[nom] ?? 0.5) }))
    .sort((a, b) => b.poids - a.poids || b.v - a.v || a.nom.localeCompare(b.nom, 'fr'))
  const tete = classes[0].poids
  return classes
    .filter((c) => c.poids >= tete * PART_MINIMALE)
    .slice(0, MAX_MUSCLES_NOM)
    .map((c) => c.nom)
}

/**
 * Le nom d'une séance d'après ses exercices, ou null s'il n'y a rien à en dire.
 *
 * @param recuperation Séance de récupération : le titre le dit d'abord, sinon
 *   « Ischios · Fessiers » se lirait comme une séance de jambes.
 */
export function nommerSeance(exos: LigneNommable[], recuperation = false): string | null {
  const muscles = musclesDuNom(exos)
  if (muscles.length === 0) return recuperation ? 'Récupération' : null
  // Pas de cas « corps entier » : la règle a été essayée, sur le nombre de zones
  // touchées puis sur la part de volume qu'un trio porte, et aucune des deux ne
  // sépare une séance de dos d'un corps entier — six gros mouvements touchent
  // une douzaine de muscles quoi qu'il arrive, et un tirage seul en touche déjà
  // six. Un seuil qui range « focus dos » avec « corps entier » ne dit rien ;
  // les trois muscles les plus travaillés, si.
  const nom = muscles.join(' · ')
  return recuperation ? `Récup ${nom}` : nom
}

// ── Emoji en tête de nom ─────────────────────────────────────────────────────
//
// Une séance n'a pas de colonne « icône » : l'emoji choisi à la main vit en
// préfixe de son nom. Visible, modifiable, et sans migration de schéma. Ces
// trois fonctions vivaient dans la page ; elles sont ici parce que le renommage
// automatique doit ABSOLUMENT reposer sur la même définition du préfixe — sinon
// il recopierait l'emoji dans le nom, ou l'effacerait.

export const PREFIXE_EMOJI = /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*/u

export function emojiDuNom(nom: string): string | null {
  return nom.match(PREFIXE_EMOJI)?.[1] ?? null
}

/** Le nom sans son emoji, pour ne pas l'afficher deux fois. */
export function nomSansEmoji(nom: string): string {
  return nom.replace(PREFIXE_EMOJI, '').trim() || nom
}

/** Remplace (ou retire) l'emoji en tête d'un nom de séance. */
export function avecEmoji(nom: string, emoji: string | null): string {
  const base = nom.replace(PREFIXE_EMOJI, '').trim()
  return emoji ? `${emoji} ${base}`.trim() : base
}

// ── Ce qu'on a le droit de renommer ─────────────────────────────────────────

/** Les titres que l'application pose elle-même, et qu'elle peut donc reprendre. */
const NOMS_POSES = [
  /^s[ée]ance( du jour)?$/i,
  /^nouvelle s[ée]ance$/i,
  /^r[ée]cup([ée]ration)?$/i,
  /^entra[îi]nement$/i,
  /^workout$/i,
]

const TOUS_ICONIQUES = new Set(
  Object.values(ICONIQUE).filter((v): v is string => v !== null),
)

/**
 * Les zones du mannequin, telles que le générateur les écrivait avant : elles
 * restent reconnues comme automatiques, sinon les séances déjà nommées
 * « Séance Sangle profonde » resteraient bloquées sur ce titre pour toujours.
 */
const ZONES_NOMMEES = new Set(Object.keys(ICONIQUE))

/**
 * Ce nom a-t-il été posé par l'application, ou tapé à la main ?
 *
 * C'est la seule garde du renommage automatique. Un nom écrit à la main — « AC
 * droite, tout en douceur », « Béhourd Toulouse » — ne se fait pas remplacer
 * par une liste de muscles : c'est une information que le calcul n'a pas.
 *
 * Sont reconnus comme posés : les titres génériques, ceux que le générateur
 * produit (« Séance Quadriceps · Fessiers »), et ceux que CETTE fonction-ci a
 * déjà produits — sans quoi le second enregistrement d'une séance figerait le
 * nom du premier.
 */
export function estNomAutomatique(nom: string): boolean {
  const base = nom.replace(PREFIXE_EMOJI, '').trim()
  if (!base) return true
  if (NOMS_POSES.some((re) => re.test(base))) return true
  // « Séance X · Y », « Récup X · Y » : le préfixe du générateur.
  const sansPrefixe = base.replace(/^(s[ée]ance|r[ée]cup)\s+/i, '')
  const parts = sansPrefixe.split('·').map((p) => p.trim())
  return parts.length > 0 && parts.every((p) => TOUS_ICONIQUES.has(p) || ZONES_NOMMEES.has(p))
}

/**
 * Le nom à enregistrer : celui déduit des exercices, ou l'ancien s'il a été
 * écrit à la main. L'emoji choisi est conservé dans tous les cas.
 */
export function renommerSiAuto(
  ancien: string,
  exos: LigneNommable[],
  recuperation = false,
): string {
  if (!estNomAutomatique(ancien)) return ancien
  const propose = nommerSeance(exos, recuperation)
  if (!propose) return ancien
  return avecEmoji(propose, emojiDuNom(ancien))
}
