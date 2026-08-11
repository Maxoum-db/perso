// L'ÉQUILIBRE du corps, quand aucun point faible n'est déclaré.
//
// Sans point faible, le générateur n'avait plus qu'un critère : la fraîcheur.
// Or la fraîcheur est un signal COURT — douze heures par cran, tout est revenu
// en quatre jours. Une semaine sans consigne donnait donc six exercices de
// jambes le lundi (les jambes étaient fraîches), six de dos le mercredi, six de
// jambes le vendredi : chaque séance juste, l'ensemble bancal.
//
// Deux garde-fous, tous deux inactifs dès qu'un point faible est déclaré — s'il
// y a une intention, elle passe devant l'équilibre, c'est tout son objet.
//
//   1. DANS la séance : pas plus de deux exercices sur le même segment au
//      premier passage de remplissage. Le second passage comble sans la
//      contrainte, comme pour l'équilibre pousser/tirer : mieux vaut un exercice
//      de plus qu'un trou dans la séance.
//   2. ENTRE les séances : le segment le moins servi des quatre dernières
//      semaines pèse plus lourd au classement, le plus servi pèse moins. Quatre
//      semaines parce que c'est l'échelle à laquelle une négligence devient
//      visible sur le corps, là où la récupération se joue en heures.

import { ZONE_LARGE, type MuscleRegion } from './muscles'
import { apportSeries, musclesDeLExercice } from './composition'
import type { MuscuSession } from './muscu'

export type Segment = 'jambes' | 'dos' | 'torse' | 'bras' | 'tronc' | 'cou'

export const SEGMENTS: Segment[] = ['jambes', 'dos', 'torse', 'bras', 'tronc', 'cou']

/** À quel segment appartient chaque zone du mannequin. */
const SEGMENT_DE_ZONE: Record<string, Segment> = {
  // Jambes
  Quadriceps: 'jambes',
  Ischios: 'jambes',
  Fessiers: 'jambes',
  Adducteurs: 'jambes',
  Mollets: 'jambes',
  Chevilles: 'jambes',
  'Rotateurs de hanche': 'jambes',
  'Fléchisseurs de hanche': 'jambes',
  // Dos — le tirage, du grand dorsal aux lombaires.
  'Grand dorsal': 'dos',
  'Milieu du dos': 'dos',
  Trapèzes: 'dos',
  Lombaires: 'dos',
  // Torse — ce qui pousse.
  Pectoraux: 'torse',
  Épaules: 'torse',
  Coiffe: 'torse',
  'Sous-scapulaire': 'torse',
  Dentelé: 'torse',
  // Bras
  Biceps: 'bras',
  Triceps: 'bras',
  'Avant-bras': 'bras',
  Pronation: 'bras',
  Préhension: 'bras',
  // Tronc
  Abdominaux: 'tronc',
  Obliques: 'tronc',
  'Sangle profonde': 'tronc',
  // Cou — à part, et pas dans le dos : en béhourd c'est lui qui prend, et le
  // noyer dans le dos le rendrait invisible au compte.
  Cou: 'cou',
  Nuque: 'cou',
}

export function segmentDe(region: MuscleRegion): Segment | null {
  const zone = ZONE_LARGE[region]
  return zone ? (SEGMENT_DE_ZONE[zone] ?? null) : null
}

/** Les segments qu'un exercice met en moteur. */
export function segmentsMoteurs(moteurs: MuscleRegion[]): Segment[] {
  return [...new Set(moteurs.map(segmentDe).filter((s): s is Segment => s !== null))]
}

/**
 * Combien d'exercices d'un même segment une séance sans consigne accepte.
 *
 * Deux, quelle que soit sa taille : au-delà, la séance se met à ressembler à un
 * point faible qu'on n'a pas demandé. Sur dix exercices, ça force cinq segments
 * — c'est exactement ce que veut dire « développer le corps sans cramer des
 * zones précises ».
 */
export const MAX_PAR_SEGMENT = 2

/**
 * Part de volume attendue par segment, pour un corps développé également.
 *
 * Ce n'est pas un sixième chacun : les segments n'ont ni la même masse ni le
 * même besoin. Les jambes portent le plus de muscle, le cou se travaille en
 * minutes. Ces parts servent de RÉFÉRENCE — c'est l'écart à cette référence qui
 * fait le poids, pas la valeur absolue.
 */
export const PART_ATTENDUE: Record<Segment, number> = {
  jambes: 0.28,
  dos: 0.22,
  torse: 0.18,
  bras: 0.13,
  tronc: 0.13,
  cou: 0.06,
}

/** Fenêtre sur laquelle on juge l'équilibre : quatre semaines. */
export const JOURS_EQUILIBRE = 28

/** Bornes du correctif : un segment négligé pèse au plus 1,3, un segment saturé 0,8. */
export const CORRECTIF_MIN = 0.8
export const CORRECTIF_MAX = 1.3

/** Volume effectif par segment sur la fenêtre, en séries pondérées. */
export function volumeParSegment(
  sessions: MuscuSession[],
  jours = JOURS_EQUILIBRE,
  maintenant = Date.now(),
): Map<Segment, number> {
  const out = new Map<Segment, number>()
  const limite = maintenant - jours * 86400000
  for (const s of sessions) {
    if (s.horsMannequin) continue
    const t = new Date(`${s.date}T12:00:00`).getTime()
    if (!Number.isFinite(t) || t < limite) continue
    for (const e of s.exercises) {
      for (const [region, n] of apportSeries(musclesDeLExercice(e.muscle_group), Math.max(1, e.sets))) {
        const seg = segmentDe(region)
        if (!seg) continue
        out.set(seg, (out.get(seg) ?? 0) + n)
      }
    }
  }
  return out
}

/**
 * Le correctif d'équilibre par segment : > 1 pour ce qui a manqué, < 1 pour ce
 * qui a été servi deux fois plutôt qu'une.
 *
 * Sans historique, tous les correctifs valent 1 : on ne corrige pas une
 * distribution qu'on n'a pas observée. C'est la même règle que pour l'alerte de
 * charge — pas de conclusion sans référence.
 */
export function correctifEquilibre(
  sessions: MuscuSession[],
  jours = JOURS_EQUILIBRE,
  maintenant = Date.now(),
): Map<Segment, number> {
  const volumes = volumeParSegment(sessions, jours, maintenant)
  const total = [...volumes.values()].reduce((a, b) => a + b, 0)
  const out = new Map<Segment, number>()
  if (total <= 0) return out
  for (const seg of SEGMENTS) {
    const observee = (volumes.get(seg) ?? 0) / total
    const ecart = PART_ATTENDUE[seg] - observee
    // 1,5 point de correctif par point d'écart : un segment complètement oublié
    // (28 points d'écart sur les jambes) sature le plafond, un segment servi à
    // sa part exacte reste neutre.
    const brut = 1 + ecart * 1.5
    out.set(seg, Math.max(CORRECTIF_MIN, Math.min(CORRECTIF_MAX, brut)))
  }
  return out
}

/** Le correctif d'un exercice : la moyenne de celui de ses segments moteurs. */
export function correctifDe(moteurs: MuscleRegion[], correctifs: Map<Segment, number>): number {
  const segs = segmentsMoteurs(moteurs)
  if (segs.length === 0 || correctifs.size === 0) return 1
  return segs.reduce((t, s) => t + (correctifs.get(s) ?? 1), 0) / segs.length
}
