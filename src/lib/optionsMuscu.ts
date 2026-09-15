import { fetchKv, saveKv } from './kv'

// Les options de la section Musculation : ce qui s'allume et s'éteint sans
// rien changer au reste.
//
// Le capteur cardiaque n'est pas un onglet — il ne se range pas dans la barre,
// il apparaît DANS la séance, DANS le journal, DANS les réglages. L'allumer ou
// l'éteindre doit donc le faire disparaître des trois d'un coup : une option
// à moitié éteinte, qui laisse un bloc vide quelque part, est pire qu'une
// option toujours allumée — on ne sait plus si elle est active.
//
// ── Deux réglages, comme pour les onglets ───────────────────────────────────
//
//   · l'AUTORISATION du propriétaire, dans `perso_acces` : ce qu'un compte a le
//     droit d'utiliser. Andréa n'a pas de capteur, le compte de mon frère non
//     plus — leur proposer un bouton « brancher le capteur » qui ne trouvera
//     jamais rien n'est pas neutre, c'est une case morte dans un écran qu'on
//     regarde entre deux séries ;
//   · le CHOIX du compte, dans le KV : je l'éteins les jours où je m'entraîne
//     sans brassard, pour retrouver l'écran sans le bloc.
//
// La première borne la seconde : on ne peut pas s'allumer une option qu'on n'a
// pas reçue.

export type OptionMuscu = 'cardio' | 'polar'

export const OPTIONS_MUSCU: Array<{ id: OptionMuscu; label: string; aide: string }> = [
  {
    id: 'cardio',
    label: '❤️ Capteur cardiaque',
    aide: 'Brassard Bluetooth pendant la séance, zones, mesure au repos. Inutile sans capteur.',
  },
  {
    id: 'polar',
    label: '🔗 Polar Flow',
    aide: 'Relève les séances que le capteur a enregistrées seul (mode vert). Demande un compte Polar.',
  },
]

/**
 * Polar Flow ne s'allume pas sans le capteur cardiaque.
 *
 * Ce n'est pas une politesse d'affichage : les deux parlent du MÊME brassard, et
 * les blocs Polar vivent à l'intérieur des écrans cardio — dans la carte du
 * journal, dans la section des réglages. Cardio éteint, ces écrans n'existent
 * pas, et une option « allumée » qui ne s'affiche nulle part est pire qu'une
 * option éteinte : on la croit active et on cherche pourquoi rien ne vient.
 *
 * La dépendance est donc déclarée ici, à un seul endroit, plutôt que répétée à
 * chaque appel.
 */
export const DEPEND_DE: Partial<Record<OptionMuscu, OptionMuscu>> = { polar: 'cardio' }

export function estOptionConnue(id: string): id is OptionMuscu {
  return OPTIONS_MUSCU.some((o) => o.id === id)
}

/**
 * Les options réellement actives : ce que le propriétaire autorise, moins ce
 * que le compte a éteint.
 *
 * `autorisees` à `null` veut dire « aucune restriction ». Une liste VIDE veut
 * dire « aucune option » — les deux ne se confondent pas, et c'est pour ça que
 * la colonne est nullable.
 */
export function optionsActives(eteintes: OptionMuscu[], autorisees: OptionMuscu[] | null): OptionMuscu[] {
  const propres = OPTIONS_MUSCU.map((o) => o.id).filter(
    (id) => (autorisees === null || autorisees.includes(id)) && !eteintes.includes(id),
  )
  // Puis on retire celles dont le parent est éteint. En deux temps, et pas en
  // une condition : une option peut être autorisée, allumée par son compte, et
  // rester inactive parce que ce dont elle dépend ne l'est pas. Les trois
  // raisons sont distinctes et l'écran doit pouvoir les distinguer.
  return propres.filter((id) => {
    const parent = DEPEND_DE[id]
    return parent === undefined || propres.includes(parent)
  })
}

/** Raccourci de lecture : « est-ce que le cardio est allumé ici ? » */
export function optionActive(
  id: OptionMuscu,
  eteintes: OptionMuscu[],
  autorisees: OptionMuscu[] | null,
): boolean {
  return optionsActives(eteintes, autorisees).includes(id)
}

// ── Le choix du compte ──────────────────────────────────────────────────────

const CLE = 'muscu_options_eteintes'

function valides(v: unknown): OptionMuscu[] {
  return (Array.isArray(v) ? v : []).filter((id): id is OptionMuscu => typeof id === 'string' && estOptionConnue(id))
}

export async function loadOptionsEteintes(userId: string): Promise<OptionMuscu[]> {
  return valides(await fetchKv<OptionMuscu[]>(userId, CLE, []))
}

export async function saveOptionsEteintes(userId: string, eteintes: OptionMuscu[]): Promise<OptionMuscu[]> {
  const propre = valides(eteintes)
  await saveKv(userId, CLE, propre)
  return propre
}
