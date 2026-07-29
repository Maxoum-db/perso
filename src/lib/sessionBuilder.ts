import { EXERCISE_LIBRARY } from '../data/exercises'
import { PRIORITE_BEHOURD, poidsBehourd } from '../data/behourdPriority'
import { regionsForGroup, type MuscleRegion } from '../components/MuscleBodyDiagram'
import { groupLoads, parseGroupEntries, type CatalogExercise, type GroupLoad, type MuscuSession } from './muscu'
import { suggererCharge, type ChargeSuggestion } from './charge'
import { FOCUS, POIDS_FOCUS, type FocusId } from './focus'

// Générateur de séance : compose une séance à partir de ce que le corps a déjà
// encaissé. Le principe est celui du mannequin, appliqué à l'envers — au lieu
// de colorer les muscles fatigués, on va chercher les exercices qui visent les
// muscles reposés, en évitant ceux qui retomberaient sur du rouge.
//
// À priorité de repos égale, les muscles qui comptent pour le béhourd passent
// devant (cou, préhension, trapèzes, érecteurs, obliques…).

/** Les activités (nage, course, béhourd, bois) ne sont pas des exercices de séance. */
const ACTIVITES = new Set(
  EXERCISE_LIBRARY.filter((e) => e.kind === 'activite').map((e) => e.name.trim().toLowerCase()),
)

/** Muscle jamais travaillé : totalement disponible. */
const JAMAIS = 99

/** Zone large d'appartenance, pour nommer la séance. */
const ZONE: Partial<Record<MuscleRegion, string>> = {
  pecUpper: 'Pectoraux',
  pecLower: 'Pectoraux',
  lats: 'Dos',
  teres: 'Dos',
  trapsMid: 'Dos',
  trapsLow: 'Dos',
  trapsUpper: 'Trapèzes',
  erectors: 'Lombaires',
  deltAnt: 'Épaules',
  deltLat: 'Épaules',
  deltPost: 'Épaules',
  biceps: 'Bras',
  brachialis: 'Bras',
  tricepsLong: 'Bras',
  tricepsLat: 'Bras',
  forearmFlex: 'Avant-bras',
  forearmExt: 'Avant-bras',
  rectus: 'Core',
  obliques: 'Core',
  serratus: 'Core',
  neck: 'Cou',
  gluteMax: 'Jambes',
  gluteMed: 'Jambes',
  rectusFemoris: 'Jambes',
  vastusLat: 'Jambes',
  vastusMed: 'Jambes',
  adductors: 'Jambes',
  bicepsFemoris: 'Jambes',
  hamsInner: 'Jambes',
  gastroc: 'Mollets',
  soleus: 'Mollets',
  tibialis: 'Mollets',
}

export interface SuggestedExercise {
  exo: CatalogExercise
  /** Muscles moteurs (intensité ≥ 0,8) de cet exercice. */
  moteurs: MuscleRegion[]
  /** Jours de repos du muscle moteur le plus frais — sert d'argument à l'écran. */
  reposMin: number
  score: number
  /** Charge conseillée, déduite des séances précédentes. */
  charge: ChargeSuggestion
}

export interface SuggestedSession {
  name: string
  exercises: SuggestedExercise[]
  /** Muscles visés, du plus reposé au moins reposé. */
  cibles: MuscleRegion[]
  /** Muscles écartés parce qu'encore en récupération. */
  evites: MuscleRegion[]
  /** Vrai si tout était encore rouge et qu'on a dû assouplir la règle. */
  degrade: boolean
}

/** Repos « ressenti » de chaque muscle : le plus frais des libellés qui le couvrent. */
function reposParMuscle(loads: Record<string, GroupLoad>): Partial<Record<MuscleRegion, number>> {
  const out: Partial<Record<MuscleRegion, number>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = out[region]
      if (cur === undefined || load.effectiveDays < cur) out[region] = load.effectiveDays
    }
  }
  return out
}

/** Un muscle en récupération pénalise, un muscle prêt rapporte. */
function poidsRepos(jours: number): number {
  if (jours <= 2) return -3
  if (jours <= 4) return 0.6
  return 1.6
}

/** Intensité maximale par muscle pour un exercice donné. */
function musclesDeLExercice(groups: string): Map<MuscleRegion, number> {
  const out = new Map<MuscleRegion, number>()
  for (const entry of parseGroupEntries(groups)) {
    for (const region of regionsForGroup(entry.name)) {
      const cur = out.get(region)
      if (cur === undefined || entry.intensity > cur) out.set(region, entry.intensity)
    }
  }
  return out
}

export interface BuildOptions {
  /** Nombre d'exercices visés (défaut 6). */
  count?: number
  /** Exercices à ne pas reproposer — sert au bouton « autre proposition ». */
  exclude?: Set<string>
  /** Poids de corps, pour les exercices qui s'y chargent. */
  bodyWeight?: number | null
  /** Point faible à rattraper : ses muscles pèsent plus et ont une place réservée. */
  focus?: FocusId
  /**
   * Récupération déjà calculée (courbatures déclarées comprises). Sans elle,
   * elle est recalculée depuis les séances — mais sans les courbatures.
   */
  loads?: Record<string, GroupLoad>
}

/**
 * Compose une séance à partir du catalogue et de l'état de récupération, avec
 * la charge conseillée sur chaque exercice.
 * Retourne null si le catalogue ne contient aucun exercice exploitable.
 */
export function buildSession(
  catalog: CatalogExercise[],
  sessions: MuscuSession[],
  options: BuildOptions = {},
): SuggestedSession | null {
  const count = options.count ?? 6
  const exclude = options.exclude ?? new Set<string>()
  const loads: Record<string, GroupLoad> = options.loads ?? groupLoads(sessions)
  const repos = reposParMuscle(loads)
  const focusRegions = new Set(FOCUS[options.focus ?? 'aucun'].regions)
  const reposDe = (r: MuscleRegion) => repos[r] ?? JAMAIS

  const candidats = catalog
    .filter((c) => !exclude.has(c.id) && !ACTIVITES.has(c.name.trim().toLowerCase()))
    .map((c) => {
      const muscles = musclesDeLExercice(c.muscle_group)
      const moteurs = [...muscles.entries()].filter(([, i]) => i >= 0.8).map(([r]) => r)
      let score = 0
      for (const [region, intensity] of muscles) {
        const focus = focusRegions.has(region) ? POIDS_FOCUS : 1
        score += intensity * poidsRepos(reposDe(region)) * poidsBehourd(region) * focus
      }
      const fatigue = moteurs.some((r) => reposDe(r) <= 2)
      const reposMin = moteurs.length ? Math.min(...moteurs.map(reposDe)) : JAMAIS
      return { exo: c, muscles, moteurs, score, fatigue, reposMin }
    })
    // Un exercice sans muscle identifié (« Cardio » seul) ne compose pas une séance.
    .filter((c) => c.moteurs.length > 0)

  if (candidats.length === 0) return null

  // Règle normale : on n'attaque pas un muscle moteur encore en récupération.
  // Si tout est rouge (reprise après une grosse semaine), on assouplit plutôt
  // que de ne rien proposer, et on le dit.
  const frais = candidats.filter((c) => !c.fatigue)
  const degrade = frais.length < Math.min(count, 3)
  const pool = degrade ? candidats : frais

  const choisis: SuggestedExercise[] = []
  const usage = new Map<MuscleRegion, number>()
  const classes = [...pool].sort((a, b) => b.score - a.score)

  const pris = new Set<string>()
  const prendre = (c: (typeof classes)[number]) => {
    pris.add(c.exo.id)
    for (const r of c.moteurs) usage.set(r, (usage.get(r) ?? 0) + 1)
    choisis.push({
      exo: c.exo,
      moteurs: c.moteurs,
      reposMin: c.reposMin,
      score: c.score,
      charge: suggererCharge(
        sessions,
        { name: c.exo.name, default_reps: c.exo.default_reps },
        options.bodyWeight ?? null,
      ),
    })
  }

  // Réserve du point faible : deux exercices garantis dessus quand il est
  // reposé. Le multiplicateur de score ne suffit pas — un exercice de gainage
  // ne vise qu'un ou deux muscles et perd contre n'importe quel polyarticulaire.
  if (focusRegions.size > 0) {
    for (let n = 0; n < 2; n++) {
      const best = classes.find(
        (c) => !pris.has(c.exo.id) && c.moteurs.some((r) => focusRegions.has(r) && reposDe(r) >= 3),
      )
      if (!best) break
      prendre(best)
    }
  }

  // Réserve béhourd : le cou et la préhension se travaillent en isolation, donc
  // ils perdent toujours au score face à un soulevé de terre. Deux places leur
  // sont réservées quand ils sont reposés — sinon ils ne sortiraient jamais.
  const prioritaires = (Object.keys(PRIORITE_BEHOURD) as MuscleRegion[])
    .filter((r) => reposDe(r) >= 5)
    .sort((a, b) => PRIORITE_BEHOURD[a]!.rang - PRIORITE_BEHOURD[b]!.rang)
    .slice(0, 2)
  for (const region of prioritaires) {
    const best = classes.find((c) => !pris.has(c.exo.id) && c.moteurs.includes(region))
    if (best) prendre(best)
  }

  // Puis deux règles de composition, sinon la séance dérive vers trois variantes
  // du même mouvement : chaque exercice doit apporter un muscle moteur que la
  // séance ne couvre pas encore, et aucun muscle n'est attaqué plus de deux fois.
  for (const c of classes) {
    if (choisis.length >= count) break
    if (pris.has(c.exo.id)) continue
    if (c.moteurs.every((r) => usage.has(r))) continue
    if (c.moteurs.some((r) => (usage.get(r) ?? 0) >= 2)) continue
    prendre(c)
  }

  if (choisis.length === 0) return null

  // Les polyarticulaires d'abord, l'isolation en fin de séance.
  choisis.sort((a, b) => b.moteurs.length - a.moteurs.length || b.score - a.score)

  const cibles = [...usage.keys()].sort((a, b) => reposDe(b) - reposDe(a))
  const evites = [...new Set(candidats.filter((c) => c.fatigue).flatMap((c) => c.moteurs))]
    .filter((r) => reposDe(r) <= 2)
    .sort((a, b) => reposDe(a) - reposDe(b))

  // Le nom reflète ce qui pèse dans la séance, pas l'ordre de sélection : on
  // compte les muscles moteurs par zone.
  const parZone = new Map<string, number>()
  for (const c of choisis) {
    for (const r of c.moteurs) {
      const z = ZONE[r]
      if (z) parZone.set(z, (parZone.get(z) ?? 0) + 1)
    }
  }
  const zones = [...parZone.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([z]) => z)

  return {
    name: zones.length ? `Séance ${zones.join(' · ')}` : 'Séance du jour',
    exercises: choisis,
    cibles,
    evites,
    degrade,
  }
}
