import { EXERCISE_LIBRARY } from '../data/exercises'
import { PRIORITE_BEHOURD, poidsBehourd } from '../data/behourdPriority'
import { regionsForGroup, type MuscleRegion } from './muscles'
import { reposParMuscle } from './recuperation'
import { estRessenti, groupLoads, parseGroupEntries, type CatalogExercise, type GroupLoad, type MuscuSession } from './muscu'
import { ajusterCharge, suggererCharge, type ChargeSuggestion } from './charge'
import { FOCUS, FOCUS_RECUP, MAX_USAGE_FOCUS, PART_FOCUS, POIDS_FOCUS, type FocusId } from './focus'
import { clefExo, enRotation, familiarites, poidsFamiliarite } from './familiarite'

// Générateur de séance : compose une séance à partir de ce que le corps a déjà
// encaissé. Le principe est celui du mannequin, appliqué à l'envers — au lieu
// de colorer les muscles fatigués, on va chercher les exercices qui visent les
// muscles reposés, en évitant ceux qui retomberaient sur du rouge.
//
// À priorité de repos égale, les muscles qui comptent pour le béhourd passent
// devant (cou, préhension, trapèzes, érecteurs, obliques…).

/**
 * Ni les activités (nage, course, béhourd, bois) ni la récupération active ne
 * sont des exercices de séance : les premières se vivent dehors, la seconde
 * s'enregistre pour effacer de la fatigue — pas pour en produire.
 */
const ACTIVITES = new Set(
  EXERCISE_LIBRARY.filter((e) => e.kind).map((e) => e.name.trim().toLowerCase()),
)

/** Le vivier du mode récupération : étirements et mobilité, rien d'autre. */
const RECUPERATIONS = new Set(
  EXERCISE_LIBRARY.filter((e) => e.kind === 'recuperation').map((e) => e.name.trim().toLowerCase()),
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
  /** Séances déjà passées sur cet exercice dans la fenêtre de comptage. */
  familiarite: number
  /** Vrai quand il a dépassé le seuil et qu'on commence à le remplacer. */
  rotation: boolean
  /** Vrai quand il a été retenu au titre du point faible visé. */
  focus: boolean
}

export interface SuggestedSession {
  name: string
  /** Vrai quand la séance composée vise à passer les courbatures. */
  recuperation: boolean
  exercises: SuggestedExercise[]
  /** Muscles écartés parce qu'encore en récupération. */
  evites: MuscleRegion[]
  /** Vrai si tout était encore rouge et qu'on a dû assouplir la règle. */
  degrade: boolean
}

/** Un muscle en récupération pénalise, un muscle prêt rapporte. */
function poidsRepos(jours: number): number {
  if (jours <= 2) return -3
  if (jours <= 4) return 0.6
  return 1.6
}

/**
 * Mode récupération : la logique s'inverse. Plus un muscle est courbaturé, plus
 * on veut l'étirer — un muscle déjà frais n'a rien à gagner à être mobilisé.
 */
function poidsCourbature(jours: number): number {
  if (jours <= 2) return 3
  if (jours <= 4) return 1.5
  return 0.2
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
  /**
   * Multiplicateur de charge venu de l'état de forme (séance allégée). Ne
   * touche ni au poids du corps ni aux exercices au temps.
   */
  intensite?: number
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
  const modeRecup = options.focus === FOCUS_RECUP
  const focusRegions = new Set(FOCUS[options.focus ?? 'aucun'].regions)

  // Exercices déjà pratiqués : eux seuls ont un historique de charge. À score
  // comparable ils passent devant, sinon la séance proposée arrive pleine de
  // « ? kg » — la charge conseillée devient inutile là où elle sert le plus.
  //
  // Mais le bonus n'est PAS plat : il monte jusqu'à la dixième séance puis
  // redescend, pour qu'un mouvement travaillé depuis des mois finisse par céder
  // la place à un voisin. Voir lib/familiarite.
  const vues = familiarites(sessions)
  const familiariteDe = (nom: string) => vues.get(clefExo(nom)) ?? 0
  const reposDe = (r: MuscleRegion) => repos[r]?.jours ?? JAMAIS

  const candidats = catalog
    .filter((c) => {
      if (exclude.has(c.id) || estRessenti(c.name)) return false
      const clef = c.name.trim().toLowerCase()
      // En récupération on ne veut QUE des étirements ; sinon on les écarte.
      return modeRecup ? RECUPERATIONS.has(clef) : !ACTIVITES.has(clef)
    })
    .map((c) => {
      const muscles = musclesDeLExercice(c.muscle_group)
      const moteurs = [...muscles.entries()].filter(([, i]) => i >= 0.8).map(([r]) => r)
      let score = 0
      for (const [region, intensity] of muscles) {
        if (modeRecup) {
          score += intensity * poidsCourbature(reposDe(region))
          continue
        }
        const focus = focusRegions.has(region) ? POIDS_FOCUS : 1
        score += intensity * poidsRepos(reposDe(region)) * poidsBehourd(region) * focus
      }
      // En récupération on retient la courbature MOYENNE des muscles visés, pas
      // la somme : sinon un « étirements complets » qui couvre tout le corps
      // bat systématiquement l'étirement précis de ce qui fait mal.
      if (modeRecup && muscles.size > 0) score /= muscles.size
      const familiarite = familiariteDe(c.name)
      // Sur un score négatif, multiplier par un bonus l'aggraverait : la
      // familiarité ne joue que sur ce qui est déjà retenu comme jouable.
      if (!modeRecup && score > 0) score *= poidsFamiliarite(familiarite)
      // En récupération, viser un muscle chaud est le but : aucun veto.
      const fatigue = !modeRecup && moteurs.some((r) => reposDe(r) <= 2)
      const reposMin = moteurs.length ? Math.min(...moteurs.map(reposDe)) : JAMAIS
      return { exo: c, muscles, moteurs, score, fatigue, reposMin, familiarite }
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
  const prendre = (c: (typeof classes)[number], auTitreDuFocus = false) => {
    pris.add(c.exo.id)
    for (const r of c.moteurs) usage.set(r, (usage.get(r) ?? 0) + 1)
    choisis.push({
      exo: c.exo,
      moteurs: c.moteurs,
      reposMin: c.reposMin,
      score: c.score,
      familiarite: c.familiarite,
      rotation: enRotation(c.familiarite),
      focus: auTitreDuFocus,
      charge: ajusterCharge(
        suggererCharge(
          sessions,
          { name: c.exo.name, default_reps: c.exo.default_reps },
          options.bodyWeight ?? null,
        ),
        options.intensite ?? 1,
      ),
    })
  }

  // Réserve du point faible : deux exercices garantis dessus quand il est
  // reposé. Le multiplicateur de score ne suffit pas — un exercice de gainage
  // ne vise qu'un ou deux muscles et perd contre n'importe quel polyarticulaire.
  // Deux exercices par muscle, trois sur les muscles du point faible. Défini ici
  // et pas seulement dans la boucle finale : les réserves choisissaient sans en
  // tenir compte, et un exercice pris « au titre du focus » pouvait faire monter
  // à trois un muscle qui n'est PAS dans le focus — le droit fémoral se
  // retrouvait travaillé trois fois par une séance jambes.
  const plafond = (r: MuscleRegion) => (focusRegions.has(r) ? MAX_USAGE_FOCUS : 2)
  const sousLePlafond = (c: { moteurs: MuscleRegion[] }) =>
    !c.moteurs.some((r) => (usage.get(r) ?? 0) >= plafond(r))

  const placesFocus = !modeRecup && focusRegions.size > 0 ? Math.max(2, Math.ceil(count * PART_FOCUS)) : 0
  for (let n = 0; n < placesFocus; n++) {
    const best = classes.find(
      (c) =>
        !pris.has(c.exo.id) &&
        c.moteurs.some((r) => focusRegions.has(r) && reposDe(r) >= 3) &&
        sousLePlafond(c),
    )
    if (!best) break
    prendre(best, true)
  }

  // Réserve béhourd : le cou et la préhension se travaillent en isolation, donc
  // ils perdent toujours au score face à un soulevé de terre. Deux places leur
  // sont réservées quand ils sont reposés — sinon ils ne sortiraient jamais.
  // Une seule place quand un focus est déclaré, deux sinon : la priorité béhourd
  // est un biais de fond, le focus est une intention. Sans ce recul, focus et
  // béhourd occupaient cinq places sur six et il ne restait plus rien pour
  // composer une séance cohérente.
  const placesBehourd = placesFocus > 0 ? 1 : 2
  const prioritaires: MuscleRegion[] = modeRecup
    ? [] // en récupération, la priorité est la courbature, pas le béhourd
    : (Object.keys(PRIORITE_BEHOURD) as MuscleRegion[])
        .filter((r) => reposDe(r) >= 5)
        .sort((a, b) => PRIORITE_BEHOURD[a]!.rang - PRIORITE_BEHOURD[b]!.rang)
        .slice(0, placesBehourd)
  for (const region of prioritaires) {
    const best = classes.find((c) => !pris.has(c.exo.id) && c.moteurs.includes(region) && sousLePlafond(c))
    if (best) prendre(best)
  }

  // Puis deux règles de composition, sinon la séance dérive vers trois variantes
  // du même mouvement : chaque exercice doit apporter un muscle moteur que la
  // séance ne couvre pas encore, et aucun muscle n'est attaqué plus de deux fois.
  for (const c of classes) {
    if (choisis.length >= count) break
    if (pris.has(c.exo.id)) continue
    // Règle générale : apporter un muscle que la séance ne couvre pas encore,
    // sinon elle dérive vers trois variantes du même mouvement. EXCEPTION pour
    // le point faible — sans elle, un troisième exercice ciblé était refusé ici
    // avant même d'atteindre le plafond relevé, et le focus ne « marquait »
    // jamais rien.
    const apporteDuNeuf = c.moteurs.some((r) => !usage.has(r))
    const renforceLeFocus = c.moteurs.some(
      (r) => focusRegions.has(r) && (usage.get(r) ?? 0) < MAX_USAGE_FOCUS,
    )
    if (!apporteDuNeuf && !renforceLeFocus) continue
    if (!sousLePlafond(c)) continue
    prendre(c, c.moteurs.some((r) => focusRegions.has(r)))
  }

  if (choisis.length === 0) return null

  // Les polyarticulaires d'abord, l'isolation en fin de séance.
  choisis.sort((a, b) => b.moteurs.length - a.moteurs.length || b.score - a.score)

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
    name: modeRecup
      ? zones.length
        ? `Récup ${zones.join(' · ')}`
        : 'Récupération'
      : zones.length
        ? `Séance ${zones.join(' · ')}`
        : 'Séance du jour',
    recuperation: modeRecup,
    exercises: choisis,
    evites,
    degrade,
  }
}
