import { fetchKv, saveKv } from './kv'
import type { ExoInput, MuscuExo, MuscuSession, MuscuTemplate } from './muscu'

// « Mes séances perso » : les séances que J'AI faites et que je veux refaire.
//
// Les séances types sont des modèles reçus — le programme Basic Fit, le
// programme béhourd, les récups. On les suit. Une séance perso, c'est
// l'inverse : une séance qui a eu lieu, dont on a gardé les charges qui
// allaient bien, et qu'on veut reproduire telle quelle la semaine suivante.
//
// Les deux sont des modèles au sens de la base — même table, même éditeur, même
// façon de démarrer une séance. Ce qui les sépare, c'est l'ORIGINE, et ça ne
// vaut pas une colonne : une liste d'identifiants dans le KV suffit, et évite
// une migration pour un booléen. Les séances perso passent devant dans l'écran,
// parce que c'est celles-là qu'on vient chercher.

const CLE = 'muscu_modeles_perso'

export type ModelesPerso = Record<string, true>

export async function loadModelesPerso(userId: string): Promise<ModelesPerso> {
  const v = await fetchKv<ModelesPerso>(userId, CLE, {})
  return v && typeof v === 'object' ? v : {}
}

export async function marquerPerso(userId: string, templateId: string, connus: ModelesPerso): Promise<ModelesPerso> {
  const next = { ...connus, [templateId]: true as const }
  await saveKv(userId, CLE, next)
  return next
}

/** Purge les modèles disparus : sans ça le KV garde des identifiants morts pour toujours. */
export function nettoyerModelesPerso(connus: ModelesPerso, idsVivants: Set<string>): ModelesPerso {
  const out: ModelesPerso = {}
  for (const id of Object.keys(connus)) if (idsVivants.has(id)) out[id] = true
  return out
}

/**
 * Range les modèles en deux paquets, perso d'abord.
 *
 * Un seul endroit décide de la frontière : l'écran des séances types, l'écran
 * de saisie après coup et le partage la posaient sinon chacun à leur façon, et
 * un modèle aurait fini perso d'un côté et type de l'autre.
 */
export function trierModeles(
  templates: MuscuTemplate[],
  perso: ModelesPerso,
): { perso: MuscuTemplate[]; types: MuscuTemplate[] } {
  return {
    perso: templates.filter((t) => perso[t.id]),
    types: templates.filter((t) => !perso[t.id]),
  }
}

/**
 * Ce qu'une séance faite devient quand on l'ajoute à ses séances perso.
 *
 * Les lignes de ressenti sautent : « Zones sollicitées » décrit ce qu'on a
 * senti ce jour-là, pas un exercice à refaire. Les charges, elles, sont
 * gardées — c'est tout l'intérêt, et l'éditeur permet de les corriger ensuite.
 *
 * Le nom prend la date de la séance : trois « Pectoraux · Épaules » dans la
 * liste ne se distingueraient pas, et c'est justement quand on en a plusieurs
 * qu'on vient les chercher.
 */
export function modeleDepuisSeance(
  s: MuscuSession,
  estRessenti: (nom: string) => boolean,
): { tpl: { name: string; icon: string; duration_min: number | null; notes: string }; exos: ExoInput[] } {
  const lignes = s.exercises.filter((e: MuscuExo) => e.name.trim() && !estRessenti(e.name))
  return {
    tpl: {
      name: `${s.name} — ${s.date}`,
      icon: '⭐',
      duration_min: s.duration_min,
      notes: s.notes,
    },
    exos: lignes.map((e) => ({
      name: e.name,
      muscle_group: e.muscle_group,
      sets: e.sets,
      reps: e.reps,
      weight_kg: e.weight_kg,
      notes: e.notes,
    })),
  }
}
