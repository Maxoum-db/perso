import { RESSENTI_NAME, type ExoInput } from './muscu'
import { titreSeance, type SeanceImportee } from './polarLien'

// Ce que devient une séance relevée chez Polar quand on la fait entrer au
// journal.
//
// ── Pourquoi on DEMANDE le type ─────────────────────────────────────────────
//
// Polar sait qu'il y a eu quatre-vingt-dix minutes à 140 battements. Il ne sait
// pas si c'était du béhourd, de la musculation ou une marche — et le champ
// « sport » qu'il rend dépend de ce qu'on a sélectionné sur le brassard, quand
// on a pensé à le sélectionner. Deviner à partir de là reviendrait à ranger une
// séance sur trois au mauvais endroit, sans que rien ne le signale.
//
// On demande donc, et c'est un toucher de plus. Le prix est faible ; se
// tromper de type coûte plus cher, parce qu'une séance mal rangée fausse le
// mannequin et la récupération pour la semaine.
//
// ── Ce que chaque type change ───────────────────────────────────────────────
//
// Le TITRE et les LIGNES, rien d'autre. La date, la durée et la fréquence
// cardiaque viennent de Polar dans tous les cas.
//
// C'est important : une séance de béhourd rapatriée sans sa ligne de ressenti
// n'est pas une séance de béhourd incomplète, c'est une séance qui ne nourrit
// NI le mannequin, NI le suivi par zone, NI la récupération. Elle ne pèse que
// par sa durée. C'était le défaut de la première version, qui créait toujours
// une séance vide en invitant à la remplir soi-même.

export type TypeConversion = 'muscu' | 'behourd' | 'marche'

export const TYPES: Array<{ id: TypeConversion; icone: string; label: string; aide: string }> = [
  {
    id: 'muscu',
    icone: '🏋️',
    label: 'Musculation',
    aide: 'La séance arrive vide : Polar ne sait pas ce que tu as soulevé. Tu l’ouvres pour y mettre tes exercices.',
  },
  {
    id: 'behourd',
    icone: '🛡️',
    label: 'Béhourd',
    aide: 'Dis quelles zones ont pris : c’est ce qui nourrit le mannequin et la récupération.',
  },
  {
    id: 'marche',
    icone: '🚶',
    label: 'Marche',
    aide: 'Une activité, comptée sur sa durée. Polar ne donne pas de distance.',
  },
]

export function typeConversion(id: TypeConversion) {
  return TYPES.find((t) => t.id === id) ?? TYPES[0]
}

/** Le béhourd est le seul type qui demande autre chose que le type lui-même. */
export function demandeDesZones(type: TypeConversion): boolean {
  return type === 'behourd'
}

export interface SeanceAcreer {
  name: string
  notes: string
  lignes: ExoInput[]
}

/**
 * Le titre, les notes et les lignes d'une séance convertie.
 *
 * Pure : elle ne parle ni au réseau ni à React, et c'est ce qui la rend
 * vérifiable. Trois types, trois formes, et une seule fonction pour les dire —
 * plutôt que trois branches recopiées dans le composant, dont une aurait
 * divergé.
 *
 * @param zones  les zones du corps, au format du journal (« Épaules:2, … »).
 *               Ignoré hors béhourd.
 */
export function seanceAcreer(type: TypeConversion, s: SeanceImportee, zones: string): SeanceAcreer {
  const provenance = `Relevée dans Polar Flow${s.appareil ? ` · ${s.appareil}` : ''}.`
  const minutes = s.dureeS !== null ? Math.max(1, Math.round(s.dureeS / 60)) : null

  if (type === 'behourd') {
    return {
      // Le MÊME titre qu'une séance saisie dans l'application. Sans ça, le
      // journal contenait « Other indoor · 18h30 » à côté de « 🛡️ Béhourd » :
      // deux noms pour la même chose, et rien qui les rapproche.
      name: '🛡️ Béhourd',
      notes: provenance,
      // Une seule ligne, celle du ressenti — c'est ainsi qu'une séance sans
      // série ni charge existe déjà dans le journal.
      lignes: [{ name: RESSENTI_NAME, muscle_group: zones, sets: 1, reps: '—', weight_kg: null, notes: '' }],
    }
  }

  if (type === 'marche') {
    return {
      name: 'Marche',
      notes: provenance,
      // Pas de distance : Polar ne la donne pas sur cette route. On écrit la
      // durée, qui suffit au coût métabolique, plutôt qu'un kilométrage inventé.
      lignes: [
        {
          name: 'Marche',
          muscle_group: 'Cardio:1, Soléaire:0.6, Gastrocnémiens:0.6, Grand fessier:0.5, Droit fémoral:0.4',
          sets: 1,
          reps: minutes === null ? '—' : `${minutes} min`,
          weight_kg: null,
          notes: '',
        },
      ],
    }
  }

  // Musculation : aucune ligne. Polar ne sait pas ce qui a été soulevé, et en
  // inventer serait pire que rien.
  return { name: titreSeance(s), notes: provenance, lignes: [] }
}

/** Ce qu'on dit une fois la séance créée — chaque type a sa suite. */
export function messageApres(type: TypeConversion): string {
  if (type === 'behourd') return 'Séance de béhourd créée, avec ses zones.'
  if (type === 'marche') return 'Marche créée dans le journal.'
  return 'Séance créée dans le journal. Ouvre-la pour y mettre tes exercices.'
}
