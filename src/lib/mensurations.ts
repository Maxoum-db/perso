import { fetchKv, saveKv } from './kv'

// Tour de taille. En recomposition à poids constant, la balance ne bouge pas —
// c'est le but. Le tour de taille, lui, bouge : c'est le seul relevé simple qui
// distingue « je stagne » de « ça marche ».

export interface Mensuration {
  date: string
  waist_cm: number
}

const KEY = 'mensurations'

export async function loadMensurations(userId: string): Promise<Mensuration[]> {
  const m = await fetchKv<Mensuration[]>(userId, KEY, [])
  return Array.isArray(m) ? [...m].sort((a, b) => b.date.localeCompare(a.date)) : []
}

export async function saveMensurations(userId: string, m: Mensuration[]): Promise<void> {
  await saveKv(userId, KEY, m)
}

/** Ajoute ou remplace la mesure du jour. */
export function upsert(list: Mensuration[], entree: Mensuration): Mensuration[] {
  const sans = list.filter((m) => m.date !== entree.date)
  return [...sans, entree].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Rapport tour de taille / hauteur. Sous 0,5 le risque cardiométabolique est
 * considéré comme faible, quel que soit le poids — c'est un meilleur marqueur
 * que l'IMC pour quelqu'un de musclé.
 */
export function ratioTailleHauteur(waistCm: number, heightCm: number): number | null {
  if (!waistCm || !heightCm) return null
  return waistCm / heightCm
}
