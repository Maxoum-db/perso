import { fetchKv, saveKv } from './kv'
import type { Weighin } from './workouts'

// Profil morphologique : ce qu'il faut pour estimer un métabolisme de base.
// Taille et année de naissance ne changent pas (ou une fois par an) : elles
// vivent dans le KV, pas dans le journal.

export interface Profil {
  heightCm: number
  birthYear: number | null
  sex: 'H' | 'F'
}

export const PROFIL_DEFAUT: Profil = { heightCm: 180, birthYear: null, sex: 'H' }

const KEY = 'profil_morpho'

export async function loadProfil(userId: string): Promise<Profil> {
  const p = await fetchKv<Profil>(userId, KEY, PROFIL_DEFAUT)
  return { ...PROFIL_DEFAUT, ...(p ?? {}) }
}

export async function saveProfil(userId: string, p: Profil): Promise<void> {
  await saveKv(userId, KEY, p)
}

export function age(p: Profil): number | null {
  if (!p.birthYear) return null
  return new Date().getFullYear() - p.birthYear
}

/**
 * Métabolisme de base — équation de Mifflin-St Jeor, la plus fiable des
 * formules prédictives sur population générale (±10 %).
 *   Homme : 10×kg + 6,25×cm − 5×âge + 5
 *   Femme : 10×kg + 6,25×cm − 5×âge − 161
 */
export function metabolismeDeBase(p: Profil, poidsKg: number): number | null {
  const a = age(p)
  if (a === null || !poidsKg) return null
  const base = 10 * poidsKg + 6.25 * p.heightCm - 5 * a
  return Math.round(base + (p.sex === 'H' ? 5 : -161))
}

/**
 * Facteur d'activité HORS sport : déplacements, travail, ménage. Le sport est
 * compté à part, à partir des séances réellement enregistrées — sinon il serait
 * compté deux fois.
 */
export const FACTEUR_NEAT = 1.35

/**
 * Ce que la vie courante attribue à UNE HEURE, entraînement compris.
 *
 * C'est la pièce qui manquait, et elle réparait un double comptage. La méthode
 * MET donne une dépense BRUTE : MET 1, c'est le repos, donc les 500 kcal d'une
 * séance contiennent le métabolisme qu'on aurait dépensé assis. Or la dépense
 * du jour valait « métabolisme × facteur d'activité » sur vingt-quatre heures
 * PLUS la séance entière — les heures d'entraînement étaient donc comptées
 * deux fois, une fois en vie courante et une fois en sport.
 *
 * On ne peut pas non plus retirer le seul métabolisme de base : pendant que tu
 * es à la salle, tu ne fais pas AUSSI ta vie courante. C'est bien la dépense de
 * base × NEAT qu'il faut déduire de ces heures-là.
 */
export function depenseParHeure(bmr: number): number {
  return (bmr * FACTEUR_NEAT) / 24
}

/**
 * Fenêtre de référence du bilan énergétique, en jours.
 *
 * La MÊME que celle de la pente de poids, et ce n'est pas un détail : le bilan
 * déduit l'apport en confrontant la dépense à la pente. Une dépense mesurée sur
 * sept jours confrontée à une pente mesurée sur vingt-huit comparait deux
 * périodes différentes — une semaine de repos après trois semaines chargées
 * faisait apparaître un apport en trop qui n'existait pas.
 */
export const FENETRE_BILAN = 28

/** Énergie stockée dans un kilo de masse corporelle (valeur conventionnelle). */
export const KCAL_PAR_KG = 7700

/**
 * Le poids de corps EN VIGUEUR à une date donnée.
 *
 * La dépense d'une séance se calcule sur le poids qu'on portait ce jour-là,
 * pas sur celui d'aujourd'hui : c'est le corps qu'il a fallu déplacer. Toutes
 * les séances d'une fenêtre étaient jusqu'ici recalculées avec la dernière
 * pesée — sur quatre semaines l'écart reste petit, mais il est systématique et
 * il tire toujours dans le même sens, celui de la tendance en cours.
 *
 * La règle est celle d'une pesée : la dernière connue À CETTE DATE ou avant.
 * Une pesée du lendemain ne dit rien de la veille — sauf s'il n'y a rien avant
 * du tout, et là c'est elle ou rien.
 */
export type PoidsDuJour = (date: string) => number | null

export function poidsHistorique(weighins: Weighin[]): PoidsDuJour {
  // Une seule fois, pas à chaque appel : le bilan appelle cette fonction une
  // fois par séance, et un tri par séance sur quatre-vingts séances se voit.
  const tries = [...weighins].sort((a, b) => a.date.localeCompare(b.date))
  if (!tries.length) return () => null
  return (date: string) => {
    let trouve: number | null = null
    for (const w of tries) {
      if (w.date > date) break
      trouve = w.weight_kg
    }
    // Séance antérieure à la toute première pesée : la plus ancienne connue
    // est la moins fausse des réponses disponibles.
    return trouve ?? tries[0].weight_kg
  }
}

/** Un relevé daté, quelle que soit son unité : des kilos, des centimètres. */
export interface Releve {
  date: string
  value: number
}

/**
 * Pente d'une série de relevés, par unité et par SEMAINE, sur la fenêtre
 * demandée. Régression linéaire des moindres carrés.
 *
 * Générique parce qu'il n'y a aucune raison que le tour de taille se mesure
 * autrement que le poids : mêmes garde-fous, même arithmétique, mêmes cas de
 * refus. Deux régressions écrites séparément auraient fini par ne plus vouloir
 * dire la même chose — et c'est justement leur COMPARAISON qui nous intéresse.
 *
 * `minPoints` et `etendueMin` sont réglables parce que là, les deux séries
 * diffèrent vraiment : un poids se prend tous les matins, un tour de taille
 * deux fois par mois. Exiger la même densité de l'un et de l'autre reviendrait
 * à ne jamais rien dire du second.
 *
 * Null quand il n'y a pas de quoi conclure — jamais zéro, qui se lirait comme
 * « c'est stable » alors que ça veut dire « je ne sais pas ».
 */
export function penteHebdo(
  releves: Releve[],
  jours: number,
  { minPoints = 3, etendueMin = 7 }: { minPoints?: number; etendueMin?: number } = {},
): number | null {
  const limite = new Date()
  limite.setHours(0, 0, 0, 0)
  limite.setDate(limite.getDate() - jours)
  const limiteStr = limite.toLocaleDateString('en-CA')

  const points = releves
    .filter((r) => r.date >= limiteStr)
    .map((r) => ({ x: Date.parse(r.date + 'T00:00:00') / 86400000, y: r.value }))
  if (points.length < minPoints) return null

  const etendue = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
  if (etendue < etendueMin) return null // trop resserré : le bruit domine

  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const num = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  if (den === 0) return null
  return (num / den) * 7 // par jour → par semaine
}

/**
 * Pente de la courbe de poids en kg/semaine. Null si trop peu de pesées ou
 * fenêtre trop courte pour dire quoi que ce soit.
 */
export function tendancePoids(weighins: Weighin[], jours = 28): number | null {
  return penteHebdo(
    weighins.map((w) => ({ date: w.date, value: w.weight_kg })),
    jours,
  )
}

/** Moyenne glissante : lisse les ±1,5 kg quotidiens (eau, sel, digestion). */
export function moyenneGlissante(
  points: Array<{ date: string; weight_kg: number }>,
  fenetre = 7,
): Array<{ date: string; value: number }> {
  const tries = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return tries.map((p, i) => {
    const debut = Math.max(0, i - fenetre + 1)
    const tranche = tries.slice(debut, i + 1)
    return { date: p.date, value: tranche.reduce((s, x) => s + x.weight_kg, 0) / tranche.length }
  })
}
