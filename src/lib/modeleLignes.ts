import { declarationParLigne } from './parLigne'

// Les façons de faire déclarées sur une ligne de SÉANCE TYPE.
//
// « Version douce » et « descente freinée » disaient jusqu'ici comment une
// séance avait été faite. Un modèle, lui, dit ce qu'on VA faire — et c'est
// aussi une chose qui se prévoit : « ce curl-là, je le fais au négatif » est
// une consigne d'entraînement, pas un constat.
//
// Les deux cases étaient donc proposées dans l'éditeur de modèle, mais rien ne
// les enregistrait : elles vivaient en KV indexées par SÉANCE, et un modèle n'a
// pas de séance. La coche partait à la poubelle sans un mot. On les avait
// retirées de cet écran ; elles reviennent, avec de quoi tenir.
//
// ── Un seul sac, deux drapeaux ──────────────────────────────────────────────
//
// Côté séance, chaque déclaration a son entrée KV — elles sont nées l'une après
// l'autre et se lisent à des moments différents. Côté modèle elles se lisent
// toujours ensemble, au même instant, dans le même écran : deux allers-retours
// de KV pour deux booléens portés par la même ligne n'auraient rien apporté.
//
// ── Ce qu'un modèle transmet ────────────────────────────────────────────────
//
// Rien tout seul : un modèle ne fatigue personne. Ces drapeaux sont recopiés
// dans le brouillon quand on démarre une séance depuis le modèle, et c'est la
// SÉANCE qui, une fois enregistrée, les porte au mannequin. Le modèle propose,
// la séance dispose — et on peut décocher avant de commencer.

export interface FaconLigne {
  /** Fait à vide, en amplitude : la ligne compte comme récupération. */
  doux?: true
  /** Descente freinée : mêmes muscles, plus de récupération (cf. `lib/negatif`). */
  negatif?: true
}

export type ModeleLignes = Record<string, FaconLigne>

const MODELE = declarationParLigne<FaconLigne>('muscu_modele_lignes')

/** La clé KV de cette déclaration — distincte de celle des autres, cf. `lib/parLigne`. */
export const CLE_MODELE_LIGNES = MODELE.cleKv
export const clefModeleLigne = MODELE.clef
export const loadModeleLignes = MODELE.load
export const nettoyerModeleLignes = MODELE.nettoyer

/**
 * Réécrit les façons de faire d'UN modèle. Les lignes qui n'ont plus aucun
 * drapeau disparaissent : garder `{}` ferait grossir le KV d'entrées qui ne
 * disent rien.
 */
export function saveModeleLignes(
  userId: string,
  templateId: string,
  lignes: Array<{ nom: string; doux?: boolean; negatif?: boolean }>,
  connues: ModeleLignes,
): Promise<ModeleLignes> {
  const utiles = lignes
    .map(({ nom, doux, negatif }) => ({
      nom,
      valeur: { ...(doux ? { doux: true as const } : {}), ...(negatif ? { negatif: true as const } : {}) },
    }))
    .filter((l) => Object.keys(l.valeur).length > 0)
  return MODELE.save(userId, templateId, utiles, connues)
}

/** Ce qui est déclaré sur cette ligne-ci du modèle. Jamais `undefined`, pour se lire sans garde. */
export function faconDeLigne(connues: ModeleLignes, templateId: string, nom: string): FaconLigne {
  return connues[clefModeleLigne(templateId, nom)] ?? {}
}
