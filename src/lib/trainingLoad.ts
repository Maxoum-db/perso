import { fetchKv, saveKv } from './kv'
import { densiteSeance, dureeSeance, metPourExercice } from './calories'
import { estRessenti, type MuscuSession } from './muscu'

// Charge d'entraînement et ratio aigu/chronique (ACWR).
//
// La charge d'une séance est comptée en MET-minutes : durée × intensité. Ça
// mélange volume et intensité en une seule unité, indépendante du poids de
// corps — deux séances de 60 min ne pèsent pas pareil selon ce qu'on y fait.
//
// Le ratio compare la semaine écoulée à la moyenne des 4 dernières. Au-delà de
// 1,5 le risque de blessure grimpe nettement : le corps n'a pas eu le temps de
// s'adapter à ce qu'on lui demande.

export function chargeSeance(s: MuscuSession, bodyWeight: number | null = null): number {
  const minutes = dureeSeance(s)
  const mets = s.exercises.filter((e) => !estRessenti(e.name)).map((e) => metPourExercice(e.name))
  const met = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : metPourExercice(s.name)
  // Même modulation que les calories : une heure dense pèse plus qu'une heure
  // traînante, sinon les deux indicateurs raconteraient des choses différentes.
  return Math.round(met * densiteSeance(s, bodyWeight).coef * minutes)
}

function chargeSurFenetre(sessions: MuscuSession[], depuis: number, jusqua: number): number {
  const borne = (d: number) => {
    const x = new Date()
    x.setHours(0, 0, 0, 0)
    x.setDate(x.getDate() - d)
    return x.toLocaleDateString('en-CA')
  }
  const debut = borne(depuis)
  const fin = borne(jusqua)
  return sessions
    .filter((s) => s.date >= debut && s.date <= fin)
    .reduce((n, s) => n + chargeSeance(s), 0)
}

export type Verdict = 'repos' | 'sous-charge' | 'optimal' | 'attention' | 'risque'

export interface BilanCharge {
  /** MET-minutes des 7 derniers jours. */
  aigue: number
  /** Moyenne hebdomadaire sur 28 jours. */
  chronique: number
  /** aiguë ÷ chronique — null tant qu'il n'y a pas d'historique. */
  ratio: number | null
  verdict: Verdict
  /** Charge semaine par semaine, de la plus ancienne à la plus récente. */
  semaines: number[]
}

export const VERDICTS: Record<Verdict, { label: string; couleur: string; conseil: string }> = {
  repos: { label: 'Semaine de repos', couleur: '#a8a29e', conseil: 'Rien d’enregistré sur 7 jours.' },
  'sous-charge': {
    label: 'En dessous de ton habitude',
    couleur: '#60A5FA',
    conseil: 'Semaine légère : bon pour récupérer, à ne pas enchaîner plus de deux fois.',
  },
  optimal: {
    label: 'Zone optimale',
    couleur: '#10B981',
    conseil: 'Progression soutenable : la charge monte au rythme où le corps s’adapte.',
  },
  attention: {
    label: 'Montée rapide',
    couleur: '#F59E0B',
    conseil: 'Tu montes plus vite que ton habitude. Surveille l’épaule et les rotules.',
  },
  risque: {
    label: 'Pic de charge',
    couleur: '#EF4444',
    conseil: 'Au-delà de +50 % d’un coup, le risque de blessure grimpe. Allège la semaine prochaine.',
  },
}

export function bilanCharge(sessions: MuscuSession[]): BilanCharge {
  const aigue = chargeSurFenetre(sessions, 6, 0)
  const semaines = [3, 2, 1, 0].map((i) => chargeSurFenetre(sessions, 7 * i + 6, 7 * i))
  const passees = semaines.slice(0, 3).filter((v) => v > 0)
  const chronique = passees.length ? Math.round(passees.reduce((a, b) => a + b, 0) / passees.length) : 0

  const ratio = chronique > 0 ? aigue / chronique : null
  let verdict: Verdict = 'optimal'
  if (aigue === 0) verdict = 'repos'
  else if (ratio === null) verdict = 'optimal'
  else if (ratio < 0.8) verdict = 'sous-charge'
  else if (ratio <= 1.3) verdict = 'optimal'
  else if (ratio <= 1.5) verdict = 'attention'
  else verdict = 'risque'

  return { aigue, chronique, ratio, verdict, semaines }
}

// ── Objectif calorique hebdomadaire ─────────────────────────────────────────

const OBJECTIF_KEY = 'objectif_kcal_hebdo'
export const OBJECTIF_DEFAUT = 3500

export async function loadObjectif(userId: string): Promise<number> {
  const v = await fetchKv<number>(userId, OBJECTIF_KEY, OBJECTIF_DEFAUT)
  return typeof v === 'number' && v > 0 ? v : OBJECTIF_DEFAUT
}

export async function saveObjectif(userId: string, v: number): Promise<void> {
  await saveKv(userId, OBJECTIF_KEY, v)
}

/** Jours restants dans la semaine glissante de 7 jours (aujourd'hui compris). */
export function joursRestantsSemaine(): number {
  // Semaine calendaire lundi → dimanche : c'est celle qu'on ressent.
  const jour = new Date().getDay() // 0 = dimanche
  return jour === 0 ? 1 : 8 - jour
}
