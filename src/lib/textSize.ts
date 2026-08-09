// Taille du texte : préférence d'affichage, pas une donnée de compte — elle
// reste locale à l'appareil (pas de sync Supabase, ce serait absurde entre un
// téléphone et un écran de PC). Agit sur la taille de police racine : les
// classes Tailwind (text-sm, text-xs…) sont en rem, donc tout le texte de
// l'app suit — utile pour lire longtemps en Apprentissage ou au Quiz.

export type TextSize = 'normal' | 'grand' | 'tres-grand'

export const TEXT_SIZES: Array<{ id: TextSize; label: string; pct: number }> = [
  { id: 'normal', label: 'Normal', pct: 100 },
  { id: 'grand', label: 'Grand', pct: 115 },
  { id: 'tres-grand', label: 'Très grand', pct: 130 },
]

const CLE = 'perso_text_size'

export function readTextSize(): TextSize {
  const v = localStorage.getItem(CLE)
  return TEXT_SIZES.some((t) => t.id === v) ? (v as TextSize) : 'normal'
}

export function applyTextSize(size: TextSize) {
  const pct = TEXT_SIZES.find((t) => t.id === size)?.pct ?? 100
  document.documentElement.style.fontSize = `${pct}%`
  localStorage.setItem(CLE, size)
}
