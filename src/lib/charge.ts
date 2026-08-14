import { isBodyweightExercise, type MuscuSession } from './muscu'
import { poidsDuCorpsPorte } from './effort'
import { clefReference } from '../data/exercises'

// Charge conseillée pour le prochain passage sur un exercice, déduite de ce qui
// a réellement été fait avant. C'est la double progression que la page conseille
// déjà, mais calculée automatiquement :
//   • haut de la fourchette de reps atteint → on monte la charge ;
//   • en dessous → on garde la même et on vise les reps ;
//   • trois séances au même poids sans y arriver → palier, on redescend de 10 %
//     pour repartir ;
//   • plus de trois semaines sans le faire → reprise à -10 %.

export type TonCharge = 'hausse' | 'maintien' | 'baisse' | 'nouveau' | 'corps'

export interface ChargeSuggestion {
  /** Charge conseillée en kg, null si on ne peut rien déduire. */
  weight: number | null
  ton: TonCharge
  /** Phrase courte affichée sous le champ de charge. */
  raison: string
}

/** Reps réellement visées : « 8-10 » → 10, « 12/jambe » → 12, « 45 s » → aucune. */
function repsMax(reps: string): number | null {
  const t = (reps ?? '').toLowerCase()
  // Un exercice au temps ou à la distance ne se progresse pas en charge.
  if (/\d\s*(s\b|sec|min|m\b|km)/.test(t)) return null
  const nums = t.match(/\d+/g)
  return nums ? Math.max(...nums.map(Number)) : null
}

/** Palier de progression réaliste : petits sauts en isolation, 5 kg sur du lourd. */
function incrementPour(weight: number): number {
  if (weight < 10) return 1
  if (weight < 25) return 2
  if (weight < 60) return 2.5
  return 5
}

/** Au demi-kilo : c'est la plus petite marche possible en salle. */
function arrondi(w: number): number {
  return Math.round(w * 2) / 2
}

function joursDepuis(date: string): number {
  const d = Date.parse(date + 'T00:00:00')
  if (!Number.isFinite(d)) return 0
  return Math.max(0, Math.round((Date.now() - d) / 86400000))
}

/**
 * Charge à proposer pour cet exercice, à partir de l'historique des séances.
 * `sessions` peut être dans n'importe quel ordre.
 */
export function suggererCharge(
  sessions: MuscuSession[],
  exo: { name: string; default_reps: string },
  bodyWeight: number | null,
): ChargeSuggestion {
  // Sur l'IDENTITÉ du mouvement, renvoi de nom suivi. Comparés par libellé
  // brut, « Rowing barre » — deux passages à 60 kg — ne se reconnaissait pas
  // dans « Tirage buste penché à la barre », et la page annonçait « jamais
  // chargé » sur l'exercice le plus lourd de la séance. C'est exactement là
  // qu'une charge conseillée sert, et exactement là qu'elle disparaissait.
  const key = clefReference(exo.name)
  if (!key) return { weight: null, ton: 'nouveau', raison: '' }

  // Historique de cet exercice, du plus récent au plus ancien.
  const histo: Array<{ date: string; reps: string; weight: number }> = []
  for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const e of s.exercises) {
      if (clefReference(e.name) !== key) continue
      if (e.weight_kg !== null && e.weight_kg > 0) histo.push({ date: s.date, reps: e.reps, weight: e.weight_kg })
    }
  }

  // Au poids du corps, la progression se fait en répétitions, pas en charge :
  // on ne monte jamais tout seul. On garde juste le lest s'il y en avait un.
  //
  // Le champ porte le poids AJOUTÉ, et lui seul. Il a longtemps reçu le poids
  // du corps entier — « traction : 102 » — pendant que le calcul d'effort
  // rajoutait ce même poids par-dessus : une traction à vide comptait pour 204
  // kg. Le poids du corps est désormais affiché à part, sur la pastille PDC,
  // et n'entre jamais dans ce champ.
  if (isBodyweightExercise(exo.name)) {
    const dernier = histo[0]
    if (dernier) {
      // Une valeur héritée de l'ancien format — le poids du corps recopié dans
      // le champ — ne doit pas ressortir comme un lest de 102 kg.
      const lest = bodyWeight && dernier.weight > bodyWeight - 5 ? null : arrondi(dernier.weight)
      if (lest !== null) return { weight: lest, ton: 'maintien', raison: `${lest} kg de lest la dernière fois` }
    }
    const pdc = poidsDuCorpsPorte(exo.name, bodyWeight)
    return {
      weight: null,
      ton: 'corps',
      raison: pdc > 0 ? `${pdc} kg de corps — ajoute un lest si tu en prends` : 'au poids du corps',
    }
  }

  if (histo.length === 0) {
    return repsMax(exo.default_reps) === null
      ? { weight: null, ton: 'nouveau', raison: 'au temps ou à la distance — lest libre' }
      : { weight: null, ton: 'nouveau', raison: 'jamais chargé — cale une série d’essai' }
  }

  const last = histo[0]
  const jours = joursDepuis(last.date)
  if (jours > 21) {
    return {
      weight: arrondi(last.weight * 0.9),
      ton: 'baisse',
      raison: `reprise après ${jours} j — 10 % sous tes ${last.weight} kg`,
    }
  }

  const cible = repsMax(exo.default_reps)
  const fait = repsMax(last.reps)
  if (cible === null || fait === null) {
    return { weight: last.weight, ton: 'maintien', raison: `comme la dernière fois (${last.weight} kg)` }
  }

  if (fait >= cible) {
    const inc = incrementPour(last.weight)
    return {
      weight: arrondi(last.weight + inc),
      ton: 'hausse',
      raison: `${fait} reps la dernière fois : +${inc} kg`,
    }
  }

  // Palier : trois séances au même poids sans jamais atteindre la fourchette
  // haute. Insister ne sert plus à rien, on redescend pour relancer.
  const trois = histo.slice(0, 3)
  if (
    trois.length === 3 &&
    trois.every((h) => h.weight === last.weight) &&
    trois.every((h) => (repsMax(h.reps) ?? 0) < cible)
  ) {
    return {
      weight: arrondi(last.weight * 0.9),
      ton: 'baisse',
      raison: `palier depuis 3 séances — repars 10 % plus bas`,
    }
  }

  return { weight: last.weight, ton: 'maintien', raison: `garde ${last.weight} kg, vise ${cible} reps` }
}

/**
 * Rabote une charge conseillée d'un facteur donné (séance allégée). Sans effet
 * au poids du corps : on ne demande pas à quelqu'un de peser 10 % de moins.
 */
export function ajusterCharge(c: ChargeSuggestion, facteur: number): ChargeSuggestion {
  if (facteur >= 1 || c.weight === null || c.ton === 'corps') return c
  const w = Math.round(c.weight * facteur * 2) / 2
  const pct = Math.round((1 - facteur) * 100)
  return { weight: w, ton: 'baisse', raison: `${c.raison} — allégé de ${pct} %` }
}

/** Petite pastille de couleur associée au ton. */
export const TON_STYLE: Record<TonCharge, { icone: string; classe: string }> = {
  hausse: { icone: '↗', classe: 'text-sage-dark' },
  maintien: { icone: '=', classe: 'text-muted' },
  baisse: { icone: '↘', classe: 'text-clay' },
  nouveau: { icone: '•', classe: 'text-muted' },
  corps: { icone: '🧍', classe: 'text-muted' },
}
