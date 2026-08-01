import { fetchKv, saveKv } from './kv'
import { distanceEnMetres } from './muscu'
import { coutSystemique, patternDe, type Pattern } from './composition'

// Combien de temps une séance prend réellement, et comment la faire tenir dans
// le créneau qu'on a.
//
// Le générateur composait à l'exercice près sans jamais se demander si ça tenait
// dans une heure. Or le temps n'est pas dominé par le travail — quatre séries de
// huit répétitions, c'est deux minutes d'effort — mais par le REPOS, qui pèse
// trois à cinq fois plus. Ignorer ça, c'est proposer des séances de quatre-vingt
// dix minutes en croyant en proposer d'une heure.
//
// D'où deux choses ici : une estimation honnête de la durée, et l'appariement en
// superset, qui est le seul levier qui raccourcisse une séance sans lui retirer
// de volume.
//
// Sources :
//
//   • Repos entre séries — 2 à 3 min sur les gros mouvements, moins sur
//     l'isolation. Trois minutes battent une minute sur la force ET sur
//     l'hypertrophie chez l'entraîné, parce qu'on garde la charge et les
//     répétitions.
//     https://pubmed.ncbi.nlm.nih.gov/25047853/
//     https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/full
//
//   • Supersets antagonistes — durée de séance réduite d'environ 40 à 50 % pour
//     des adaptations identiques en force, hypertrophie et endurance. Le repos
//     d'un muscle est occupé par le travail de son opposé, sans interférence : la
//     force du second mouvement est même parfois meilleure.
//     https://pmc.ncbi.nlm.nih.gov/articles/PMC12011898/
//     https://sportrxiv.org/index.php/server/preprint/view/419

/** Secondes de travail d'une série, déduites du format de répétitions. */
export function tempsTravail(reps: string): number {
  const parCote = /côté|\/bras|\/jambe|par bras|par jambe/i.test(reps)
  const double = parCote ? 2 : 1

  const min = reps.match(/(\d+(?:[.,]\d+)?)\s*min/i)
  if (min) return parseFloat(min[1].replace(',', '.')) * 60 * double

  const sec = reps.match(/(\d+(?:[.,]\d+)?)\s*s(?:ec)?\b/i)
  if (sec) return parseFloat(sec[1].replace(',', '.')) * double

  // Un portage se compte en mètres : environ une seconde par mètre, chargé.
  const metres = distanceEnMetres(reps)
  if (metres !== null) return Math.max(20, metres) * double

  const n = reps.match(/\d+/)
  // Trois secondes par répétition : une descente contrôlée et une montée.
  return Math.max(20, (n ? parseInt(n[0], 10) : 10) * 3) * double
}

/**
 * Secondes de repos après une série, selon le coût de l'exercice.
 *
 * Ce sont ces valeurs qui font la durée d'une séance, pas le travail. Elles
 * suivent la littérature : deux à trois minutes sur les gros mouvements, où la
 * charge et les répétitions s'effondrent sans récupération complète ; une minute
 * et demie sur l'isolation, où l'enjeu est local.
 */
export function tempsRepos(nom: string): number {
  switch (coutSystemique(nom)) {
    case 2:
      return 180
    case 1:
      return 150
    default:
      return 90
  }
}

/**
 * Secondes perdues entre deux exercices : trouver la machine, charger la barre,
 * régler le banc. Systématiquement sous-estimé, et pourtant c'est dix minutes
 * sur une séance de six exercices.
 */
export const TRANSITION = 90

/** Repos entre les deux mouvements d'un superset — le temps de se déplacer. */
export const REPOS_SUPERSET = 90

export interface LigneDuree {
  nom: string
  sets: number
  reps: string
}

/** Durée d'un exercice mené seul, en secondes. */
export function dureeExercice(l: LigneDuree): number {
  const travail = tempsTravail(l.reps) * l.sets
  // Le dernier repos n'existe pas : on enchaîne sur la transition.
  const repos = tempsRepos(l.nom) * Math.max(0, l.sets - 1)
  return travail + repos + TRANSITION
}

/**
 * Durée d'une paire menée en superset.
 *
 * On alterne : le travail de B occupe le repos de A. Chaque muscle récupère donc
 * `travail de l'autre + repos court` au lieu de son repos complet — un peu moins,
 * mais la littérature ne trouve pas de perte sur un couple antagoniste. Une seule
 * transition pour les deux : on reste sur place.
 */
export function dureePaire(a: LigneDuree, b: LigneDuree): number {
  const sets = Math.max(a.sets, b.sets)
  const tour = tempsTravail(a.reps) + tempsTravail(b.reps) + REPOS_SUPERSET
  return tour * sets - REPOS_SUPERSET + TRANSITION
}

// ── Appariement antagoniste ─────────────────────────────────────────────────

/**
 * Couples de familles qui s'apparient sans se gêner.
 *
 * Pousser avec tirer, genou avec hanche : les deux mouvements d'un couple ne
 * partagent pas leurs moteurs, donc le second ne subit pas la fatigue du premier.
 * Apparier deux mouvements de la MÊME famille serait le pire cas — c'est la
 * configuration qui coûte le plus de force.
 */
const COUPLES: Array<[Pattern, Pattern]> = [
  ['poussee', 'tirage'],
  ['genou', 'hanche'],
]

export function sontAntagonistes(nomA: string, nomB: string): boolean {
  const a = patternDe(nomA)
  const b = patternDe(nomB)
  return COUPLES.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

export interface Appariable {
  nom: string
  sets: number
  reps: string
  /** Coût systémique — on n'apparie pas deux mouvements lourds. */
  cout: number
  /** Muscles moteurs : deux exercices qui les partagent ne s'apparient pas. */
  moteurs: string[]
}

/**
 * Apparie ce qui peut l'être, dans l'ordre reçu.
 *
 * Rend un tableau d'index de paire, ou `null` pour un exercice mené seul. Les
 * deux membres ne sont PAS forcément voisins dans la liste : on cherche le
 * premier compatible où qu'il soit. C'est `regrouper` qui les rapproche ensuite.
 *
 * Deux refus explicites :
 *   • deux mouvements lourds ensemble — un soulevé enchaîné à un squat, c'est
 *     une séance qu'on subit, pas qu'on optimise ;
 *   • deux exercices qui partagent un moteur — ce n'est plus un superset
 *     antagoniste mais un enchaînement sur le même muscle, le cas où la force
 *     chute le plus.
 */
export function apparier(exos: Appariable[]): Array<number | null> {
  const paires: Array<number | null> = exos.map(() => null)
  let prochaine = 0
  for (let i = 0; i < exos.length - 1; i++) {
    if (paires[i] !== null) continue
    const a = exos[i]
    for (let j = i + 1; j < exos.length; j++) {
      if (paires[j] !== null) continue
      const b = exos[j]
      if (!sontAntagonistes(a.nom, b.nom)) continue
      if (a.cout === 2 && b.cout === 2) continue
      if (a.moteurs.some((m) => b.moteurs.includes(m))) continue
      paires[i] = prochaine
      paires[j] = prochaine
      prochaine++
      break
    }
  }
  return paires
}

/**
 * Rapproche les membres d'une même paire, sans défaire l'ordre.
 *
 * L'appariement peut relier le 4e et le 6e exercice. Affiché tel quel, le repère
 * visuel du superset enjambait une ligne étrangère et promettait un enchaînement
 * qui n'en était pas un. On remonte donc le second membre juste après le premier :
 * la tête de liste ne bouge pas — c'est elle qui porte la règle du point faible
 * d'abord — et les paires deviennent contiguës.
 *
 * L'appariement n'est PAS recalculé après : les paires sont les mêmes, seule leur
 * place change, donc la durée estimée reste valable.
 */
export function regrouper<T>(exos: T[], paires: Array<number | null>): Array<[T, number | null]> {
  const out: Array<[T, number | null]> = []
  const posees = new Set<number>()
  for (let i = 0; i < exos.length; i++) {
    if (posees.has(i)) continue
    posees.add(i)
    out.push([exos[i], paires[i]])
    const p = paires[i]
    if (p === null) continue
    const j = paires.findIndex((x, k) => x === p && k !== i && !posees.has(k))
    if (j === -1) continue
    posees.add(j)
    out.push([exos[j], paires[j]])
  }
  return out
}

/**
 * Durée totale d'une séance, appariement compris, en MINUTES.
 *
 * On soustrait la dernière transition : elle n'existe pas, la séance est finie.
 */
export function dureeSeance(exos: Appariable[], paires: Array<number | null>): number {
  let total = 0
  const faites = new Set<number>()
  for (let i = 0; i < exos.length; i++) {
    const p = paires[i]
    if (p === null) {
      total += dureeExercice(exos[i])
      continue
    }
    if (faites.has(p)) continue
    faites.add(p)
    const j = paires.findIndex((x, k) => x === p && k !== i)
    total += j === -1 ? dureeExercice(exos[i]) : dureePaire(exos[i], exos[j])
  }
  return Math.round(Math.max(0, total - TRANSITION) / 60)
}

/** « 55 min », « 1 h 05 » — une durée de séance, lisible. */
export function fmtDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** Créneaux proposés à l'écran. */
export const DUREES = [45, 60, 75, 90] as const
export const DUREE_PAR_DEFAUT = 60

/**
 * Garde-fou d'exercices quand c'est le créneau qui décide de la taille.
 *
 * Il ne devrait jamais mordre — le temps s'épuise avant —, mais un catalogue
 * plein d'exercices très courts pourrait produire une liste interminable, et une
 * séance de quinze lignes n'est pas une séance.
 */
export const PLAFOND_EXOS = 10

const KEY = 'muscu_duree'

export async function loadDuree(userId: string): Promise<number> {
  const d = await fetchKv<number>(userId, KEY, DUREE_PAR_DEFAUT)
  return DUREES.includes(d as (typeof DUREES)[number]) ? d : DUREE_PAR_DEFAUT
}

export async function saveDuree(userId: string, minutes: number): Promise<void> {
  await saveKv(userId, KEY, minutes)
}
