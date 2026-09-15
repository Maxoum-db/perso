import type { IdZone, TempsParZone } from './cardio'
import { totalZones } from './cardio'
import type { CardiosSeances } from './cardioSeance'

// Ce que le cœur a encaissé sur la semaine.
//
// ── Pourquoi une DEUXIÈME charge, alors qu'il y en a déjà une ───────────────
//
// `trainingLoad.ts` compte la charge en MET-minutes : durée × intensité
// déclarée. Elle répond à « combien de travail ». Elle ne sait rien du cœur —
// deux séances d'une heure au même MET pèsent pareil, que l'une se soit passée
// à 110 bpm entre de longues pauses et l'autre à 160 sans souffler.
//
// Celle-ci répond à autre chose : « à quel point ça a coûté au cœur ». Elle ne
// se calcule que sur ce que le brassard a vraiment mesuré, et elle ne remplace
// pas l'autre.
//
// ⚠️ Et surtout : elle ne rend AUCUN verdict de prévention. Un second ratio
// aigu/chronique à côté du premier ferait exactement ce que le commentaire de
// `trainingLoad.ts` décrit comme le défaut à ne pas répéter — deux indicateurs
// qui racontent deux séances différentes, sans que rien ne dise lequel croire.
// Ici on donne des minutes et un total, et le verdict reste à un seul endroit.
//
// ── Le TRIMP d'Edwards ──────────────────────────────────────────────────────
//
// Les minutes passées dans chaque zone, multipliées par le rang de la zone, et
// additionnées. Dix minutes en zone 4 valent quarante ; dix minutes en zone 1,
// dix. C'est la méthode la plus simple qui tienne compte de l'intensité, et la
// seule qui se calcule directement à partir de ce qu'on garde déjà — le temps
// par zone. Les variantes exponentielles (Banister) demandent la fréquence de
// repos et la max relevée pour un résultat qui classe les séances dans le même
// ordre.
//
// La zone 0 pèse zéro, et ce n'est pas un oubli : sous 50 % de la maximale, on
// récupère entre deux séries. La compter reviendrait à récompenser les longues
// pauses.

export const POIDS_ZONE: Record<IdZone, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }

const TOUTES: IdZone[] = [0, 1, 2, 3, 4, 5]

/** Les zones sont gardées en SECONDES. Le TRIMP se compte en minutes. */
export function trimp(zones: TempsParZone): number {
  return Math.round(TOUTES.reduce<number>((n, id) => n + (zones[id] / 60) * POIDS_ZONE[id], 0))
}

/** Minutes passées dans un groupe de zones, arrondies. */
export function minutesZones(zones: TempsParZone, ids: IdZone[]): number {
  return Math.round(ids.reduce<number>((n, id) => n + zones[id], 0) / 60)
}

/** Zones faciles (endurance) et zones dures (seuil et au-delà). */
export const FACILES: IdZone[] = [1, 2]
export const DURES: IdZone[] = [4, 5]
/** Tout ce qui compte comme effort : la zone 0 n'en est pas. */
const EFFORT: IdZone[] = [1, 2, 3, 4, 5]

export interface BilanCardiaque {
  /** TRIMP cumulé sur les 7 derniers jours. */
  trimp: number
  /** Séances des 7 derniers jours où le brassard a mesuré quelque chose. */
  seances: number
  minutesFaciles: number
  minutesDures: number
  /**
   * Part du temps d'EFFORT passée en zones 4-5, entre 0 et 1.
   *
   * Le dénominateur exclut la zone 0 : en musculation, les pauses entre séries
   * font la moitié du temps, et les inclure écraserait la proportion à des
   * valeurs qui ne veulent plus rien dire.
   */
  partDure: number | null
  /**
   * Moyenne hebdomadaire des trois semaines précédentes.
   *
   * `null` tant que moins de deux de ces trois semaines contiennent quelque
   * chose : une seule semaine n'est pas une habitude, et s'y comparer
   * transformerait la reprise après une pause en « pic de charge ».
   */
  moyenne: number | null
}

function borne(joursAvant: number, maintenant: Date): string {
  const x = new Date(maintenant)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - joursAvant)
  return x.toLocaleDateString('en-CA')
}

/**
 * Les séances mesurées, avec leur date.
 *
 * Les mesures sont rangées par identifiant de séance : sans la liste des
 * séances, elles n'ont pas de date, et on ne peut rien fenêtrer. Une mesure
 * dont la séance a disparu est ignorée plutôt que datée d'aujourd'hui.
 */
function datees(
  cardios: CardiosSeances,
  seances: Array<{ id: string; date: string }>,
): Array<{ date: string; zones: TempsParZone }> {
  const out: Array<{ date: string; zones: TempsParZone }> = []
  for (const s of seances) {
    const c = cardios[s.id]
    if (!c || !s.date) continue
    // Une séance où le brassard n'a rien enregistré n'est pas une séance à zéro
    // de charge : c'est une séance sans mesure. Elle ne compte pas non plus
    // dans le nombre de séances mesurées.
    if (totalZones(c.zones) <= 0) continue
    out.push({ date: s.date, zones: c.zones })
  }
  return out
}

export function bilanCardiaque(
  cardios: CardiosSeances,
  seances: Array<{ id: string; date: string }>,
  maintenant: Date = new Date(),
): BilanCardiaque {
  const tout = datees(cardios, seances)
  const fenetre = (depuis: number, jusqua: number) => {
    const d = borne(depuis, maintenant)
    const f = borne(jusqua, maintenant)
    return tout.filter((x) => x.date >= d && x.date <= f)
  }

  const semaine = fenetre(6, 0)
  const zonesSemaine = semaine.reduce<TempsParZone>(
    (acc, x) => {
      for (const id of TOUTES) acc[id] += x.zones[id]
      return acc
    },
    { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  )

  const precedentes = [3, 2, 1].map((i) =>
    fenetre(7 * i + 6, 7 * i).reduce((n, x) => n + trimp(x.zones), 0),
  )
  const pleines = precedentes.filter((v) => v > 0)
  const moyenne = pleines.length >= 2 ? Math.round(pleines.reduce((a, b) => a + b, 0) / pleines.length) : null

  const effort = EFFORT.reduce<number>((n, id) => n + zonesSemaine[id], 0)

  return {
    trimp: semaine.reduce((n, x) => n + trimp(x.zones), 0),
    seances: semaine.length,
    minutesFaciles: minutesZones(zonesSemaine, FACILES),
    minutesDures: minutesZones(zonesSemaine, DURES),
    partDure: effort > 0 ? DURES.reduce<number>((n, id) => n + zonesSemaine[id], 0) / effort : null,
    moyenne,
  }
}

/** « +18 % », « −7 % » — l'écart à l'habitude, ou `null` sans habitude. */
export function ecartMoyenne(b: BilanCardiaque): number | null {
  if (b.moyenne === null || b.moyenne <= 0) return null
  return Math.round(((b.trimp - b.moyenne) / b.moyenne) * 100)
}
