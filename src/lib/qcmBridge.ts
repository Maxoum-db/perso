// Pont vers le QCM du Hub Prométhée : fichier statique public (voir
// hub-promethee/scripts/export_qcm_json.mjs), régénéré à chaque déploiement
// du Hub — pas de migration de base de données, pas de schéma Supabase
// partagé touché. La Notion du jour de l'accueil pioche dedans : vrai choix
// multiple (4 options), correction immédiate + explication.

export interface QcmItem {
  id: string
  kind: 'fiche' | 'module' | 'bprea' | 'aides'
  srcId: string
  srcLabel: string
  q: string
  options: string[]
  correct: number
  explication: string
  source: string | null
}

const QCM_EXPORT_URL = 'https://hub-promethee.vercel.app/qcm_export.json'
const CACHE_KEY = 'perso_qcm_export_cache_v1'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12h — le contenu ne bouge qu'aux déploiements du Hub

interface CacheShape {
  fetchedAt: number
  items: QcmItem[]
}

function readCache(): QcmItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheShape
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null
    return parsed.items.length ? parsed.items : null
  } catch {
    return null
  }
}

function writeCache(items: QcmItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), items } satisfies CacheShape))
  } catch {
    // Quota localStorage dépassé (~1,2 Mo) : tant pis, on retentera un fetch réseau la prochaine fois.
  }
}

export async function fetchQcmBank(): Promise<QcmItem[] | null> {
  const cached = readCache()
  if (cached) return cached
  try {
    const res = await fetch(QCM_EXPORT_URL)
    if (!res.ok) return null
    const data = (await res.json()) as { items?: QcmItem[] }
    const items = data.items ?? []
    if (items.length) writeCache(items)
    return items.length ? items : null
  } catch {
    return null
  }
}

// Historique persistant des dernières questions VUES (pas seulement répondues),
// pour qu'une question ne puisse pas revenir tout de suite — y compris après un
// rechargement de page, qui vide l'état en mémoire du composant. Sans ça, un
// index déterministe (jour de l'année) rendait la même question à chaque
// ouverture et l'enchaînement "suivante" retombait dans une boucle prévisible.
const HISTORY_KEY = 'perso_qcm_recent_history_v1'
const HISTORY_MAX = 60 // grand devant le rythme réel d'usage, minuscule devant les 1031 questions du pool

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushHistory(id: string) {
  try {
    const hist = readHistory()
    hist.push(id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-HISTORY_MAX)))
  } catch {
    // Quota localStorage dépassé : tant pis, l'exclusion se limitera à la session en cours.
  }
}

/** La prochaine question à poser, tirée au hasard parmi celles qui ne sont pas exclues. */
export function prochaineQcm<T extends { id: string }>(items: T[], exclure: ReadonlySet<string> = new Set()): T | null {
  const restants = exclure.size ? items.filter((it) => !exclure.has(it.id)) : items
  const pool = restants.length > 0 ? restants : items // tout exclu (improbable vu HISTORY_MAX) : on retombe sur le pool complet
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
}

/** @param exclure Questions déjà répondues depuis l'ouverture de l'accueil (en plus de l'historique persistant). */
export async function fetchNotionDuJourQcm(exclure: ReadonlySet<string> = new Set()): Promise<QcmItem | null> {
  const items = await fetchQcmBank()
  if (!items) return null
  const historique = readHistory()
  const combinee = historique.length ? new Set([...exclure, ...historique]) : exclure
  const notion = prochaineQcm(items, combinee)
  if (notion) pushHistory(notion.id)
  return notion
}

export const QCM_KIND_LABELS: Record<QcmItem['kind'], string> = {
  fiche: '📖 Bibliothèque',
  module: '🎓 Module BPREA',
  bprea: '📝 Examen BPREA',
  aides: '🎯 Aides & Subventions',
}
