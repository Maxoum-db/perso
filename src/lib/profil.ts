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

/** Énergie stockée dans un kilo de masse corporelle (valeur conventionnelle). */
export const KCAL_PAR_KG = 7700

/**
 * Pente de la courbe de poids en kg/semaine, par régression linéaire sur la
 * fenêtre demandée. Null si trop peu de pesées ou fenêtre trop courte pour
 * dire quoi que ce soit.
 */
export function tendancePoids(weighins: Weighin[], jours = 28): number | null {
  const limite = new Date()
  limite.setHours(0, 0, 0, 0)
  limite.setDate(limite.getDate() - jours)
  const limiteStr = limite.toLocaleDateString('en-CA')

  const points = weighins
    .filter((w) => w.date >= limiteStr)
    .map((w) => ({ x: Date.parse(w.date + 'T00:00:00') / 86400000, y: w.weight_kg }))
  if (points.length < 3) return null

  const etendue = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
  if (etendue < 7) return null // moins d'une semaine : le bruit domine

  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const num = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  if (den === 0) return null
  return (num / den) * 7 // kg par jour → kg par semaine
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
