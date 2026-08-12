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

/** Indexé sur le jour de l'année : la même question toute la journée, pas un tirage différent à chaque ouverture. */
function dayIndex(len: number): number {
  if (len <= 0) return 0
  const start = Date.UTC(new Date().getFullYear(), 0, 0)
  const doy = Math.floor((Date.now() - start) / 86400000)
  return doy % len
}

/**
 * La prochaine question à poser, en écartant celles qu'on vient de faire.
 *
 * L'index par jour de l'année donne la stabilité — la même question toute la
 * journée, pas un tirage différent à chaque ouverture de l'accueil. Mais dès
 * qu'on en répond une, il faut la SUIVANTE, sinon l'accueil repose la même.
 */
export function prochaineQcm<T extends { id: string }>(items: T[], exclure: ReadonlySet<string> = new Set()): T | null {
  const restants = exclure.size ? items.filter((it) => !exclure.has(it.id)) : items
  return restants.length > 0 ? restants[dayIndex(restants.length)] : null
}

/** @param exclure Questions déjà répondues depuis l'ouverture de l'accueil. */
export async function fetchNotionDuJourQcm(exclure: ReadonlySet<string> = new Set()): Promise<QcmItem | null> {
  const items = await fetchQcmBank()
  if (!items) return null
  return prochaineQcm(items, exclure)
}

export const QCM_KIND_LABELS: Record<QcmItem['kind'], string> = {
  fiche: '📖 Bibliothèque',
  module: '🎓 Module BPREA',
  bprea: '📝 Examen BPREA',
  aides: '🎯 Aides & Subventions',
}
