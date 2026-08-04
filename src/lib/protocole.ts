// Le bloc de préparation en cours, et la phase où l'on se trouve.
//
// Un protocole daté vaut par ses dates : « semaine de taper » ne veut rien dire
// tant qu'on ne sait pas quel jour on est. Les dates vivent donc ici, une fois,
// et l'écran demande la phase au lieu de la déduire — c'est en la redéduisant à
// deux endroits qu'on finit par afficher « bloc » d'un côté et « taper » de
// l'autre le même matin.

export interface Protocole {
  nom: string
  /** Premier jour du bloc spécifique. Avant : mise en forme générale. */
  debut: string
  /** Jour de l'échéance (YYYY-MM-DD). */
  jourJ: string
  /**
   * Durée de l'affûtage final, en jours.
   *
   * Sept, parce que c'est ce que le protocole prescrit : volume −40/50 % sur
   * les 5 à 7 derniers jours. L'explosivité et l'absorption des chocs dépendent
   * plus de la fraîcheur nerveuse que d'une séance de plus.
   */
  taperJours: number
}

export const PROTOCOLE: Protocole = {
  nom: 'Opération Caméléon',
  // Le protocole prévoyait un départ mi-août sur six semaines. Le bloc démarre
  // en septembre, et ce n'est pas un choix de confort : le traîneau, la sangle
  // cervicale et le kickboxing arrivent avec la nouvelle salle. Trois des six
  // séances du microcycle sont donc impossibles à Basic Fit, ce qui rend la
  // question « peut-on avancer le départ ? » sans objet.
  debut: '2026-09-01',
  jourJ: '2026-09-15',
  taperJours: 7,
}

/**
 * Où l'on s'entraîne, et ce que ça autorise.
 *
 * Le matériel n'est pas un détail d'intendance ici : c'est lui qui découpe le
 * calendrier. Une séance qui demande un traîneau n'est pas « à faire plus
 * tard », elle est impossible — et une application qui la propose quand même
 * fait perdre le déplacement.
 */
export interface Salle {
  nom: string
  /** Premier jour où l'on s'y entraîne. */
  depuis: string
  /** Ce que la salle permet, dit du point de vue du protocole. */
  materiel: string
  /**
   * Ce qu'elle apporte de neuf par rapport à la précédente, en une poignée de
   * mots.
   *
   * Séparé de `materiel` parce que les deux ne se lisent pas au même endroit :
   * la description complète va sous le bandeau, ce champ-ci s'insère dans une
   * phrase. La première version glissait `materiel` dans la phrase et produisait
   * « avec nouvelle salle : équipement complet et kickboxing : traîneau… », deux
   * deux-points et un point final en double.
   */
  apporte?: string
}

export const SALLES: Salle[] = [
  {
    nom: 'Basic Fit',
    depuis: '0000-01-01',
    materiel:
      'Machines, barres, haltères, poulies. Ni traîneau, ni sangle cervicale, ni ring — ' +
      'le cou se travaille à l’élastique, la préhension aux haltères.',
  },
  {
    nom: 'Nouvelle salle',
    depuis: '2026-09-01',
    materiel: 'Équipement complet et kickboxing : traîneau, sangle cervicale et ring disponibles.',
    apporte: 'le traîneau, la sangle cervicale et le kickboxing',
  },
]

/** La salle où l'on s'entraîne à une date donnée : la plus récente déjà ouverte. */
export function salleDuJour(aujourdhui = new Date().toLocaleDateString('en-CA'), salles = SALLES): Salle {
  return salles.filter((s) => s.depuis <= aujourdhui).sort((a, b) => b.depuis.localeCompare(a.depuis))[0] ?? salles[0]
}

/**
 * En dessous de trois semaines de construction, on n'entreprend plus une montée
 * en charge : on entretient ce qui existe et on soigne le spécifique.
 *
 * Trois semaines parce que c'est l'ordre de grandeur d'un cycle d'adaptation
 * utilisable — en dessous, chercher des records ne fait qu'apporter de la
 * fatigue à un jour J qu'on veut aborder frais. C'est exactement l'arbitrage du
 * protocole : l'explosivité et l'absorption des chocs dépendent plus de la
 * fraîcheur nerveuse que d'une séance de plus.
 */
const CONSTRUCTION_MIN = 21

export type Phase = 'miseEnForme' | 'bloc' | 'taper' | 'apres'

export interface EtatProtocole {
  phase: Phase
  /** Jours restants avant l'échéance. Négatif une fois passée. */
  joursAvantJourJ: number
  titre: string
  consigne: string
  /** Où l'on s'entraîne ce jour-là, et ce que ça autorise. */
  salle: Salle
}

/** Jours calendaires entre deux dates ISO, `b − a`. */
function ecartJours(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()
  return Math.round(ms / 86400000)
}

/**
 * Où en est-on du protocole, et que faut-il faire aujourd'hui.
 *
 * Le texte de consigne est renvoyé avec la phase, et non composé par l'écran :
 * c'est la même règle qui décide de la phase et de ce qu'elle implique, et les
 * séparer aurait permis d'afficher « affûtage » à côté d'un conseil de montée
 * en charge.
 */
export function etatProtocole(
  aujourdhui = new Date().toLocaleDateString('en-CA'),
  p: Protocole = PROTOCOLE,
): EtatProtocole {
  const joursAvantJourJ = ecartJours(aujourdhui, p.jourJ)
  // Les jours réellement disponibles pour construire : la fenêtre du bloc, moins
  // l'affûtage qui la termine. C'est ce nombre-là qui décide s'il est encore
  // raisonnable de chercher des records, et non la longueur brute du bloc — une
  // fenêtre de deux semaines dont une d'affûtage n'offre qu'une semaine de
  // travail, quoi qu'en dise le calendrier.
  const construction = ecartJours(p.debut, p.jourJ) - p.taperJours
  const salle = salleDuJour(aujourdhui)

  if (joursAvantJourJ < 0) {
    return {
      phase: 'apres',
      joursAvantJourJ,
      salle,
      titre: `${p.nom} — échéance passée`,
      consigne: 'Le bloc est terminé. Reprends la mise en forme, ou fixe la prochaine échéance.',
    }
  }
  if (aujourdhui < p.debut) {
    const avant = ecartJours(aujourdhui, p.debut)
    // Le matériel explique la date, et pas l'inverse : le traîneau, la sangle
    // cervicale et le ring arrivent avec la nouvelle salle. Trois des six
    // séances du microcycle sont donc littéralement infaisables avant. Le dire
    // évite de croire qu'on perd du temps par prudence.
    const apres = salleDuJour(p.debut)
    const change = apres.nom !== salle.nom
    return {
      phase: 'miseEnForme',
      joursAvantJourJ,
      salle,
      titre: `Mise en forme — ${salle.nom}`,
      consigne:
        `Intensité soutenue, séances généralistes avec ce que ${salle.nom} permet. ` +
        `Le bloc « ${p.nom} » démarre dans ${avant} j (${frJour(p.debut)})` +
        (change && apres.apporte
          ? `, en même temps que la nouvelle salle — c’est elle qui apporte ${apres.apporte}.`
          : '.'),
    }
  }
  if (joursAvantJourJ <= p.taperJours) {
    // Le jour même est encore dans l'affûtage — le volume y est au plus bas —
    // mais les consignes n'ont rien à voir : à ce stade il n'y a plus rien à
    // préparer, seulement une liste à exécuter. Afficher « volume −40 % » le
    // matin du combat n'aurait servi à rien.
    const jourJ = joursAvantJourJ === 0
    return {
      phase: 'taper',
      joursAvantJourJ,
      salle,
      titre: jourJ ? `Jour J — ${p.nom}` : `Affûtage — J−${joursAvantJourJ}`,
      consigne: jourJ
        ? 'Repas digeste 2 h avant, eau et électrolytes prêts sur le terrain. Échauffement RAMP et activation ' +
          'du cou AVANT de coiffer le heaume. Aucune nouveauté — ni aliment, ni supplément, ni mouvement.'
        : 'Volume −40 à −50 %, charges lourdes mais peu de séries. Masque rangé, sommeil prioritaire, ' +
          'aucune nouveauté. On ne cherche plus le stress, on récupère.',
    }
  }
  return {
    phase: 'bloc',
    joursAvantJourJ,
    salle,
    titre: `${p.nom} — J−${joursAvantJourJ}`,
    consigne:
      construction < CONSTRUCTION_MIN
        ? `Fenêtre courte — ${construction} j de construction avant l’affûtage. On entretient la force et on ` +
          'soigne le spécifique : cou, préhension, souffle. Pas de recherche de records, ils coûteraient plus ' +
          'de fraîcheur qu’ils ne rapportent.'
        : 'Montée en charge : cou et préhension en progression, masque en résistance moyenne. ' +
          'Décharge immédiate si deux marqueurs matinaux passent au rouge.',
  }
}

function frJour(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
