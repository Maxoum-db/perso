import { buildSession, type SuggestedSession } from './sessionBuilder'
import { evaluerForme } from './forme'
import { PLAFOND_EXOS } from './duree'
import type { EtatZone } from './recuperation'
import type { MuscleRegion } from './muscles'
import type { FocusId } from './focus'
import { seanceDuJour, type CatalogExercise, type GroupLoad, type MuscuSession } from './muscu'
import type { Weighin } from './workouts'

// La prochaine séance : laquelle, et quand.
//
// La composition vivait dans la page Musculation. L'accueil pose exactement la
// même question, et deux appels au générateur réglés à la main auraient fini par
// proposer deux séances différentes selon l'écran — le pire cas, parce qu'on ne
// saurait pas laquelle croire. Le réglage vit donc ici, une fois.

export interface ContexteSeance {
  catalog: CatalogExercise[]
  sessions: MuscuSession[]
  /** Pesées : elles servent à l'état de forme, qui raccourcit la séance. */
  weighins: Weighin[]
  bodyWeight: number | null
  focus: FocusId[]
  behourd: boolean
  /** Créneau visé, en minutes. */
  duree: number
  /** Récupération déjà calculée, corrections comprises. */
  loads: Record<string, GroupLoad>
  /**
   * Muscles mis au repos total. Ici et pas seulement dans la page : l'accueil
   * pose la même question que Musculation, et un blocage respecté d'un côté
   * mais pas de l'autre proposerait sur l'accueil l'exercice que l'onglet
   * Musculation refuse — deux réponses au même écran d'écart.
   */
  bloquees?: Set<MuscleRegion>
  exclude?: Set<string>
}

/**
 * Compose la séance du moment, avec les réglages de l'utilisateur.
 *
 * Le créneau prend le relais du compte d'exercices : c'est lui qui décide de la
 * taille. `forme` le raccourcit les jours de charge élevée, dans la même
 * proportion qu'elle réduisait le nombre d'exercices — une séance allégée est
 * une séance plus courte, pas seulement moins chargée.
 */
export function composerSeance(ctx: ContexteSeance): SuggestedSession | null {
  const forme = evaluerForme(ctx.sessions, ctx.weighins)
  return buildSession(ctx.catalog, ctx.sessions, {
    exclude: ctx.exclude,
    bodyWeight: ctx.bodyWeight,
    focus: ctx.focus,
    behourd: ctx.behourd,
    loads: ctx.loads,
    bloquees: ctx.bloquees,
    count: PLAFOND_EXOS,
    dureeCible: Math.round(ctx.duree * (forme.exos / 6)),
    intensite: forme.intensite,
  })
}

export interface Prochaine {
  session: SuggestedSession
  /** Jours réels à attendre avant que le corps soit prêt. 0 = aujourd'hui. */
  attente: number
  /** La zone qui fait attendre, quand il y en a une. */
  frein?: string
  /**
   * Une séance de travail a DÉJÀ été faite aujourd'hui.
   *
   * Séparé de `attente`, qui ne parle que du corps : ce sont deux faits
   * distincts — le corps peut être frais et la journée déjà prise. Les mélanger
   * dans un seul nombre aurait fait dire au barème une règle de calendrier.
   */
  dejaFait: boolean
}

/**
 * La séance à faire, et le jour où la faire.
 *
 * Le générateur signale lui-même quand il a dû assouplir sa règle faute de
 * muscle disponible (`degrade`) : c'est exactement le signal « pas aujourd'hui ».
 * Le délai est alors celui de la zone qui revient EN PREMIER — c'est à ce
 * moment-là que la situation change, et c'est donc la seule date qu'on puisse
 * annoncer sans inventer.
 */
export function prochaineSeance(
  ctx: ContexteSeance,
  zones: EtatZone[],
  aujourdhui = new Date().toLocaleDateString('en-CA'),
): Prochaine | null {
  const session = composerSeance(ctx)
  if (!session) return null
  // UNE séance par jour. Le corps a beau être frais, si la journée est déjà
  // faite la proposition est pour demain — sinon l'accueil inviterait à une
  // deuxième séance à côté de la première qu'il vient d'afficher en pied.
  const dejaFait = seanceDuJour(ctx.sessions, aujourdhui) !== undefined
  if (!session.degrade) return { session, attente: 0, dejaFait }
  const premier = zones.filter((z) => !z.pret).sort((a, b) => a.reste - b.reste)[0]
  return { session, attente: premier?.reste ?? 0, frein: premier?.zone, dejaFait }
}
