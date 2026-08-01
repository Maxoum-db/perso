import { EXERCISE_LIBRARY } from '../data/exercises'
import { poidsBehourd, rangsBehourd } from '../data/behourdPriority'
import type { MuscleRegion } from './muscles'
import { reposParMuscle } from './recuperation'
import { estRessenti, groupLoads, type CatalogExercise, type GroupLoad, type MuscuSession } from './muscu'
import { ajusterCharge, suggererCharge, type ChargeSuggestion } from './charge'
import {
  FOCUS,
  FOCUS_RECUP,
  MAX_USAGE_FOCUS,
  PART_BEHOURD,
  PART_FOCUS,
  POIDS_FOCUS,
  REPOS_BEHOURD,
  REPOS_BEHOURD_SPECIAL,
  type FocusId,
} from './focus'
import { clefExo, enRotation, familiarites, poidsFamiliarite } from './familiarite'
import { apparier, dureeSeance, regrouper, type Appariable } from './duree'
import {
  BONUS_ETIRE,
  SERIES_MAX,
  SERIES_MAX_FOCUS,
  apportSeries,
  budgetSystemique,
  coutSystemique,
  estEtire,
  estPoussee,
  estTirage,
  musclesDeLExercice,
  patternDe,
  type Pattern,
} from './composition'

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
  /** Famille de mouvement — sert à équilibrer la séance. */
  pattern: Pattern
  /**
   * Numéro de superset, ou null si l'exercice se fait seul. Deux lignes qui
   * partagent ce numéro s'alternent : le repos de l'une est le travail de l'autre.
   */
  superset: number | null
  /** Charge le muscle en position allongée : plus de croissance par série. */
  etire: boolean
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
  /**
   * Ce que la séance pèse, une fois composée. Affiché en pied de carte : sans
   * ça, les règles de volume et de fatigue seraient invisibles, et une séance de
   * quatre exercices passerait pour un générateur qui n'a rien trouvé alors
   * qu'elle est simplement au bout de son budget.
   */
  bilan: {
    /** Séries totales, toutes lignes confondues. */
    series: number
    /** Charge nerveuse cumulée et son budget. */
    cout: number
    budget: number
    poussees: number
    tirages: number
    /** Durée estimée en minutes, appariement compris. */
    duree: number
    /** Créneau visé, quand il y en avait un. */
    dureeCible?: number
    /** Nombre de supersets formés. */
    supersets: number
  }
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
   * Mode « spécial béhourd », cumulable avec le point faible.
   *
   * Les priorités béhourd pèsent déjà en fond de tableau sur toutes les séances.
   * Cochée, la case double leur écart au neutre, réserve un tiers de la séance et
   * abaisse la fraîcheur exigée — le cou et la préhension sortent alors vraiment,
   * au lieu de perdre au score contre un soulevé de terre.
   */
  behourd?: boolean
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
  /**
   * Créneau visé, en minutes. C'est le REPOS qui fait la durée d'une séance, pas
   * le travail : sans cette contrainte, six gros mouvements dépassent l'heure et
   * demie sans que rien ne le signale.
   */
  dureeCible?: number
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
  const special = options.behourd === true && !modeRecup
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
        score += intensity * poidsRepos(reposDe(region)) * poidsBehourd(region, special) * focus
      }
      // En récupération on retient la courbature MOYENNE des muscles visés, pas
      // la somme : sinon un « étirements complets » qui couvre tout le corps
      // bat systématiquement l'étirement précis de ce qui fait mal.
      if (modeRecup && muscles.size > 0) score /= muscles.size
      const familiarite = familiariteDe(c.name)
      const etire = estEtire(c.name)
      // Sur un score négatif, multiplier par un bonus l'aggraverait : ni la
      // familiarité ni la position étirée ne jouent sur ce qui est déjà écarté.
      if (!modeRecup && score > 0) {
        score *= poidsFamiliarite(familiarite)
        // Charger un muscle en position allongée rend plus par série. En mode
        // récupération on ne s'en sert pas : le but n'est plus de faire pousser.
        if (etire) score *= BONUS_ETIRE
      }
      // En récupération, viser un muscle chaud est le but : aucun veto.
      const fatigue = !modeRecup && moteurs.some((r) => reposDe(r) <= 2)
      const reposMin = moteurs.length ? Math.min(...moteurs.map(reposDe)) : JAMAIS
      return {
        exo: c,
        muscles,
        moteurs,
        score,
        fatigue,
        reposMin,
        familiarite,
        etire,
        pattern: patternDe(c.name),
        cout: coutSystemique(c.name),
      }
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

  // Volume déjà posé sur chaque muscle, en séries EFFECTIVES : une série compte
  // au prorata de la part du muscle dans l'exercice. Quatre séries de développé
  // couché valent quatre séries de pectoral et deux de triceps.
  const series = new Map<MuscleRegion, number>()
  let coutTotal = 0
  let poussees = 0
  let tirages = 0
  const budget = budgetSystemique(count, special)

  // Ce que la séance durerait si on ajoutait cet exercice, appariement compris.
  // On mesure APRÈS appariement parce que c'est lui qui décide : deux mouvements
  // antagonistes appariés tiennent dans la moitié du temps de deux menés seuls,
  // donc juger avant l'appariement écarterait des exercices qui rentraient.
  const appariable = (e: { exo: CatalogExercise; moteurs: MuscleRegion[] }): Appariable => ({
    nom: e.exo.name,
    sets: e.exo.default_sets,
    reps: e.exo.default_reps,
    cout: coutSystemique(e.exo.name),
    moteurs: e.moteurs,
  })

  /**
   * L'ordre définitif de la séance. Utilisé DEUX fois — pour estimer la durée
   * pendant la sélection, et pour trier la séance à la fin — et c'est exactement
   * pour ça qu'il vit dans une seule fonction : `apparier` apparie le premier
   * compatible avec le premier compatible, donc un ordre différent donne des
   * paires différentes, donc une durée différente. Estimer sur l'ordre de
   * sélection et apparier sur l'ordre trié faisait déborder le créneau.
   */
  const ordonner = <T extends { focus: boolean; moteurs: MuscleRegion[]; score: number }>(l: T[]): T[] =>
    [...l].sort(
      (a, b) =>
        (a.focus ? 0 : 1) - (b.focus ? 0 : 1) ||
        b.moteurs.length - a.moteurs.length ||
        b.score - a.score,
    )

  const dureeAvec = (candidat?: (typeof classes)[number]): number => {
    const liste = [
      ...choisis.map((e) => ({ focus: e.focus, moteurs: e.moteurs, score: e.score, exo: e.exo })),
      ...(candidat
        ? [
            {
              focus: candidat.moteurs.some((r) => focusRegions.has(r)),
              moteurs: candidat.moteurs,
              score: candidat.score,
              exo: candidat.exo,
            },
          ]
        : []),
    ]
    const lignes = ordonner(liste).map(appariable)
    return dureeSeance(lignes, apparier(lignes))
  }
  const tientDansLeCreneau = (c: (typeof classes)[number]) =>
    options.dureeCible === undefined || dureeAvec(c) <= options.dureeCible

  const pris = new Set<string>()
  const prendre = (c: (typeof classes)[number], auTitreDuFocus = false) => {
    pris.add(c.exo.id)
    coutTotal += c.cout
    if (estPoussee(c.exo.name)) poussees++
    if (estTirage(c.exo.name)) tirages++
    for (const r of c.moteurs) usage.set(r, (usage.get(r) ?? 0) + 1)
    for (const [region, n] of apportSeries(c.muscles, c.exo.default_sets)) {
      series.set(region, (series.get(region) ?? 0) + n)
    }
    choisis.push({
      exo: c.exo,
      moteurs: c.moteurs,
      reposMin: c.reposMin,
      score: c.score,
      familiarite: c.familiarite,
      rotation: enRotation(c.familiarite),
      focus: auTitreDuFocus,
      pattern: c.pattern,
      etire: c.etire,
      superset: null, // posé après le tri final, quand l'ordre est arrêté
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
  // Deux garde-fous, et non plus un seul compte d'exercices.
  //
  // 1. Le nombre d'exercices par muscle : deux, trois sur le point faible. Il
  //    évite trois variantes du même mouvement à la suite.
  // 2. Le VOLUME en séries effectives. C'est le vrai garde-fou physiologique :
  //    trois exercices de quatre séries sur un même muscle font douze séries, là
  //    où la croissance plafonne vers six à huit et où le reste ne fait plus
  //    qu'ajouter de la fatigue. Compter les exercices ne pouvait pas voir ça.
  const plafond = (r: MuscleRegion) => (focusRegions.has(r) ? MAX_USAGE_FOCUS : 2)
  const plafondSeries = (r: MuscleRegion) => (focusRegions.has(r) ? SERIES_MAX_FOCUS : SERIES_MAX)
  const sousLePlafond = (c: {
    moteurs: MuscleRegion[]
    muscles: Map<MuscleRegion, number>
    exo: CatalogExercise
    cout: number
  }) => {
    if (c.moteurs.some((r) => (usage.get(r) ?? 0) >= plafond(r))) return false
    if (!tientDansLeCreneau(c as (typeof classes)[number])) return false
    if (coutTotal + c.cout > budget) return false
    for (const [region, n] of apportSeries(c.muscles, c.exo.default_sets)) {
      if ((series.get(region) ?? 0) + n > plafondSeries(region)) return false
    }
    return true
  }

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
  // Hors mode spécial : une seule place quand un focus est déclaré, deux sinon.
  // La priorité béhourd est alors un biais de fond, le focus est une intention —
  // sans ce recul, les deux occupaient cinq places sur six.
  //
  // En mode spécial, c'est l'inverse : le béhourd EST l'intention, il prend un
  // tiers de la séance. Les deux réserves tiennent ensemble parce qu'elles se
  // recouvrent (la ceinture abdominale est des deux côtés) et parce que celle-ci
  // ne vise que des muscles encore intacts dans la séance.
  const placesBehourd = special
    ? Math.max(2, Math.ceil(count * PART_BEHOURD))
    : placesFocus > 0
      ? 1
      : 2
  const seuilRepos = special ? REPOS_BEHOURD_SPECIAL : REPOS_BEHOURD
  const prioritaires: MuscleRegion[] = modeRecup
    ? [] // en récupération, la priorité est la courbature, pas le béhourd
    : rangsBehourd()
        // Un muscle déjà pris par la réserve du focus n'a pas besoin d'une
        // seconde place : la réserve béhourd comble les trous, elle ne double pas.
        .filter((r) => reposDe(r) >= seuilRepos && (usage.get(r) ?? 0) === 0)
        .slice(0, placesBehourd)
  for (const region of prioritaires) {
    const best = classes.find((c) => !pris.has(c.exo.id) && c.moteurs.includes(region) && sousLePlafond(c))
    if (best) prendre(best)
  }

  // Remplissage, en deux passes.
  //
  // La première tient l'équilibre pousser/tirer : une séance qui empile les
  // poussées entretient l'épaule tombante au lieu de la corriger, et l'AC droite
  // n'a pas besoin de ça. On vise au moins autant de tirages que de poussées.
  // La seconde comble ce qui reste sans cette contrainte — mieux vaut une
  // poussée de plus qu'un trou dans la séance.
  const remplir = (equilibrer: boolean) => {
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
      if (equilibrer && estPoussee(c.exo.name) && poussees >= tirages) continue
      prendre(c, c.moteurs.some((r) => focusRegions.has(r)))
    }
  }
  remplir(true)
  remplir(false)

  if (choisis.length === 0) return null

  // L'ordre de la séance.
  //
  // Ce qui est fait en premier progresse le plus, la fatigue nerveuse
  // s'accumulant au fil de la séance. La littérature est explicite : on place le
  // muscle prioritaire d'abord, QU'IL SOIT polyarticulaire ou non. C'est un
  // changement par rapport à la règle « les gros mouvements d'abord » : elle
  // reléguait systématiquement le gainage et le cou en fin de séance, c'est-à-dire
  // exactement les points faibles qu'on cherche à rattraper.
  const tries = ordonner(choisis)
  choisis.length = 0
  choisis.push(...tries)

  // Appariement, une fois l'ordre arrêté : le repos d'un mouvement est occupé
  // par le travail de son antagoniste. Même volume, séance nettement plus courte.
  const lignes: Appariable[] = choisis.map(appariable)
  const paires = apparier(lignes)
  // Les deux membres d'une paire se suivent à l'écran : un superset qui enjambe
  // un exercice étranger n'est pas un superset.
  const groupes = regrouper(choisis, paires)
  choisis.length = 0
  for (const [e, p] of groupes) {
    e.superset = p
    choisis.push(e)
  }

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
    bilan: {
      series: choisis.reduce((t, e) => t + e.exo.default_sets, 0),
      cout: coutTotal,
      budget,
      poussees,
      tirages,
      duree: dureeSeance(lignes, paires),
      dureeCible: options.dureeCible,
      supersets: new Set(paires.filter((p) => p !== null)).size,
    },
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
