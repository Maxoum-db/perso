import { penteHebdo, type Releve } from './profil'
import type { Mensuration } from './mensurations'
import type { Weighin } from './workouts'

// Est-ce que j'échange du gras contre du muscle ?
//
// C'est LA question, et ni la balance ni le mètre ruban n'y répondent seuls.
// La balance ne distingue pas un kilo de muscle d'un kilo de gras — à poids
// constant, elle affiche exactement la même chose qu'on progresse ou qu'on
// stagne. Le tour de taille ne dit pas non plus grand-chose seul : il baisse
// aussi bien en fondant qu'en se recomposant.
//
// Croisés, en revanche, ils tranchent :
//
//                    │ taille ↓        │ taille stable   │ taille ↑
//   ─────────────────┼─────────────────┼─────────────────┼──────────────
//   poids ↑          │ RECOMPOSITION   │ prise de muscle │ prise mixte
//   poids stable     │ RECOMPOSITION   │ stagnation      │ à surveiller
//   poids ↓          │ perte de gras   │ à surveiller    │ à surveiller
//
// Les deux cases « RECOMPOSITION » sont l'objectif : la masse tient ou monte
// pendant que le tour de taille descend. C'est la seule configuration où on
// peut affirmer que du gras est parti et que du muscle l'a remplacé.
//
// Deux cases sont volontairement inconfortables. « Poids stable, taille qui
// monte » veut dire du muscle perdu contre du gras gagné — l'inverse exact de
// ce qu'on cherche, et invisible sur la balance. « Poids qui baisse, taille
// stable » veut dire de la masse perdue qui n'est pas du gras.

/**
 * Fenêtre de lecture, en jours.
 *
 * Plus longue que celle du bilan énergétique, et il le faut : un tour de taille
 * se prend deux fois par mois, et il bouge de un à deux centimètres par
 * trimestre. Sur vingt-huit jours il n'y aurait ni assez de points ni assez
 * d'amplitude pour distinguer un vrai mouvement du bruit du mètre ruban.
 */
export const FENETRE_RECOMPO = 84

/**
 * Bande de stabilité du poids, en kg/semaine.
 *
 * La même que celle déjà affichée sur la courbe de poids — au-dessous, on écrit
 * « stable ». Deux seuils pour la même notion auraient produit une courbe qui
 * dit « stable » et un verdict qui dit « tu montes ».
 */
export const SEUIL_POIDS = 0.15

/**
 * Bande de stabilité du tour de taille, en cm/semaine.
 *
 * Un mètre ruban se lit à un demi-centimètre près, et la mesure dépend de la
 * respiration et de l'heure. 0,1 cm/semaine, c'est 1,2 cm sur la fenêtre —
 * au-delà du bruit d'une mesure isolée, donc lisible.
 */
export const SEUIL_TAILLE = 0.1

export type VerdictRecompo =
  | 'recomposition'
  | 'prise-muscle'
  | 'prise-mixte'
  | 'perte-gras'
  | 'stagnation'
  | 'surveiller'

export interface Recomposition {
  verdict: VerdictRecompo
  /** kg/semaine. */
  pentePoids: number
  /** cm/semaine. */
  penteTaille: number
  titre: string
  /** Ce que ça veut dire, en une phrase. */
  explication: string
  /** Vert quand c'est l'objectif, ambre quand c'est neutre, argile sinon. */
  ton: 'bon' | 'neutre' | 'attention'
}

const VERDICTS: Record<VerdictRecompo, { titre: string; explication: string; ton: Recomposition['ton'] }> = {
  recomposition: {
    titre: 'Recomposition en cours',
    explication:
      'Ton tour de taille descend pendant que la masse tient ou monte. C’est du gras parti et du muscle à la place — exactement ce que la balance seule ne sait pas voir.',
    ton: 'bon',
  },
  'prise-muscle': {
    titre: 'Prise de masse propre',
    explication:
      'Tu prends du poids sans prendre de tour de taille. À ce rythme, ce qui s’ajoute est essentiellement du muscle.',
    ton: 'bon',
  },
  'perte-gras': {
    titre: 'Perte de gras',
    explication:
      'Poids et tour de taille descendent ensemble. C’est du gras qui part — surveille les charges à la salle, c’est là que se voit une perte de muscle.',
    ton: 'neutre',
  },
  'prise-mixte': {
    titre: 'Prise mixte',
    explication:
      'Poids et tour de taille montent tous les deux. Il y a du muscle là-dedans, mais pas que : c’est le moment de resserrer l’apport plutôt que d’attendre.',
    ton: 'attention',
  },
  stagnation: {
    titre: 'Rien ne bouge',
    explication:
      'Ni le poids ni le tour de taille ne bougent. Ce n’est pas un échec — mais si tu visais une recomposition, il faut changer un levier : l’apport, le volume, ou les deux.',
    ton: 'neutre',
  },
  surveiller: {
    titre: 'À surveiller',
    explication:
      'La combinaison n’est pas celle qu’on cherche : le tour de taille monte, ou de la masse part sans que le tour de taille suive. Dans les deux cas, ce qui change n’est pas ce qu’on voudrait.',
    ton: 'attention',
  },
}

/**
 * Pente du tour de taille, cm/semaine, ou null si elle n'est pas lisible.
 *
 * Exportée parce que le graphique en a besoin séparément : sans assez de
 * mesures, il ne doit PAS tracer de ligne. Une ligne plate entre deux points
 * affirme « ton tour de taille est stable » — exactement la phrase que cette
 * carte existe pour ne pas dire à la légère. Deux points, deux ronds, et rien
 * entre les deux.
 *
 * Trois mesures étalées sur trois semaines : deux points ne décrivent qu'une
 * droite, jamais une tendance, et deux mesures prises la même semaine ne disent
 * rien du trimestre.
 */
export function penteTaille(mensurations: Mensuration[], jours = FENETRE_RECOMPO): number | null {
  return penteHebdo(
    mensurations.map((m) => ({ date: m.date, value: m.waist_cm })),
    jours,
    { minPoints: 3, etendueMin: 21 },
  )
}

/** Le signe d'une pente, sa bande de stabilité comprise. */
function sens(pente: number, seuil: number): -1 | 0 | 1 {
  if (pente > seuil) return 1
  if (pente < -seuil) return -1
  return 0
}

/**
 * Le verdict, ou `null` s'il n'y a pas de quoi conclure.
 *
 * Null et pas « stagnation » : ne rien savoir et savoir que rien ne bouge sont
 * deux états différents, et les confondre ferait annoncer une stagnation à
 * quelqu'un qui vient juste de commencer à mesurer.
 */
export function evaluerRecomposition(
  weighins: Weighin[],
  mensurations: Mensuration[],
  jours = FENETRE_RECOMPO,
): Recomposition | null {
  const poids: Releve[] = weighins.map((w) => ({ date: w.date, value: w.weight_kg }))

  const pentePoids = penteHebdo(poids, jours)
  const penteT = penteTaille(mensurations, jours)
  if (pentePoids === null || penteT === null) return null

  const p = sens(pentePoids, SEUIL_POIDS)
  const t = sens(penteT, SEUIL_TAILLE)

  let verdict: VerdictRecompo
  if (t < 0) verdict = p < 0 ? 'perte-gras' : 'recomposition'
  else if (t === 0) verdict = p > 0 ? 'prise-muscle' : p === 0 ? 'stagnation' : 'surveiller'
  else verdict = p > 0 ? 'prise-mixte' : 'surveiller'

  return { verdict, pentePoids, penteTaille: penteT, ...VERDICTS[verdict] }
}

/** Ce qu'il manque pour conclure, à dire plutôt que de se taire. */
export function manqueRecompo(weighins: Weighin[], mensurations: Mensuration[], jours = FENETRE_RECOMPO): string {
  const poids = weighins.map((w) => ({ date: w.date, value: w.weight_kg }))
  const sansPoids = penteHebdo(poids, jours) === null
  const sansTaille = penteTaille(mensurations, jours) === null
  if (sansPoids && sansTaille) return 'Il me faut trois pesées et trois tours de taille étalés sur trois semaines.'
  if (sansTaille) return 'Il me manque le tour de taille : trois mesures étalées sur au moins trois semaines.'
  return 'Il me manque des pesées : trois au moins, étalées sur une semaine.'
}
