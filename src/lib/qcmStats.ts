// Suivi des réponses au QCM du Hub Prométhée (Notion du jour de l'accueil) —
// stocké côté perso puisque ce sont de vraies questions à choix multiple
// (correct/incorrect), distinctes des notes FSRS 1-4 du Quiz Rustique.
import type { QcmItem } from './qcmBridge'

const STATS_KEY = 'perso_qcm_stats_v1'

type Kind = QcmItem['kind']

interface KindStat {
  attempts: number
  correct: number
}

export interface QcmStats {
  attempts: number
  correct: number
  byKind: Record<Kind, KindStat>
}

const KINDS: Kind[] = ['fiche', 'module', 'bprea', 'aides']

function emptyStats(): QcmStats {
  return {
    attempts: 0,
    correct: 0,
    byKind: Object.fromEntries(KINDS.map((k) => [k, { attempts: 0, correct: 0 }])) as Record<Kind, KindStat>,
  }
}

export function getQcmStats(): QcmStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw) as Partial<QcmStats>
    const base = emptyStats()
    return {
      attempts: parsed.attempts ?? 0,
      correct: parsed.correct ?? 0,
      byKind: { ...base.byKind, ...(parsed.byKind ?? {}) },
    }
  } catch {
    return emptyStats()
  }
}

export function recordQcmAnswer(kind: Kind, correct: boolean): void {
  const stats = getQcmStats()
  stats.attempts += 1
  stats.byKind[kind].attempts += 1
  if (correct) {
    stats.correct += 1
    stats.byKind[kind].correct += 1
  }
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // Quota localStorage dépassé : cette réponse ne sera pas comptée, tant pis.
  }
}
