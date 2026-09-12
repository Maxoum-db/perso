import { fetchKv, saveKv } from './kv'

// Ce que l'écran Musculation propose, et à qui.
//
// Cinq onglets, dont personne ne se sert de tous. Le compte d'Andréa n'a que
// faire de la progression aux charges, le mien ne regarde le sommeil qu'une
// fois par mois. Un onglet qu'on n'ouvre jamais n'est pas neutre : sur un
// téléphone il prend une place dans une barre qui en a cinq, et il faut viser
// entre deux cases pour atteindre celle qu'on veut.
//
// ── Deux réglages, et ils ne se remplacent pas ──────────────────────────────
//
//   · le CHOIX du compte : ce que je décide de ne plus voir. Une préférence,
//     rangée dans le KV avec le reste de mes réglages ;
//   · la RESTRICTION du propriétaire : ce qu'un compte n'a pas le droit de
//     voir. Une autorisation, rangée dans `perso_acces` avec les sections,
//     là où la base peut la faire respecter.
//
// La seconde borne la première. Un compte ne peut pas se rendre un onglet que
// le propriétaire lui a fermé — sinon le réglage personnel serait une porte
// dérobée sur l'autorisation.

export type OngletMuscu = 'journal' | 'types' | 'progression' | 'sommeil' | 'poids'

export const ONGLETS_MUSCU: Array<{ id: OngletMuscu; label: string; aide: string }> = [
  { id: 'journal', label: '📒 Journal', aide: 'Les séances, le mannequin, la composition.' },
  { id: 'types', label: '📋 Séances types', aide: 'Tes séances perso et les modèles.' },
  { id: 'progression', label: '📈 Progression', aide: 'Courbes de charge, exercice par exercice.' },
  { id: 'sommeil', label: '😴 Sommeil', aide: 'Nuits déclarées — elles pèsent sur la récupération.' },
  { id: 'poids', label: '⚖️ Poids', aide: 'Pesées et tour de taille.' },
]

/**
 * Le journal ne se masque pas.
 *
 * C'est l'onglet d'arrivée et le seul par lequel on enregistre quoi que ce
 * soit. Masqué, la section Musculation devient un écran où l'on ne peut rien
 * faire — autant la retirer entièrement, ce que la liste des accès permet
 * déjà, proprement.
 */
export const ONGLET_TOUJOURS: OngletMuscu = 'journal'

export function estMasquable(id: OngletMuscu): boolean {
  return id !== ONGLET_TOUJOURS
}

/**
 * Les onglets réellement affichés : ce que le propriétaire autorise, moins ce
 * que le compte a choisi de ranger.
 *
 * `autorises` à `null` veut dire « aucune restriction » — l'état de tous les
 * comptes tant que le propriétaire n'a rien décidé, et celui du propriétaire
 * lui-même. Une liste VIDE, elle, veut dire « rien sauf le journal » : les deux
 * ne se confondent pas, et c'est pour ça que la colonne est nullable.
 */
export function ongletsAffiches(masques: OngletMuscu[], autorises: OngletMuscu[] | null): OngletMuscu[] {
  return ONGLETS_MUSCU.map((o) => o.id).filter(
    (id) =>
      id === ONGLET_TOUJOURS ||
      ((autorises === null || autorises.includes(id)) && !masques.includes(id)),
  )
}

// ── Le choix du compte ──────────────────────────────────────────────────────

const CLE_MASQUES = 'muscu_onglets_masques'

function valides(v: unknown): OngletMuscu[] {
  const liste = Array.isArray(v) ? v : []
  return liste.filter(
    (id): id is OngletMuscu =>
      typeof id === 'string' && ONGLETS_MUSCU.some((o) => o.id === id) && estMasquable(id as OngletMuscu),
  )
}

export async function loadOngletsMasques(userId: string): Promise<OngletMuscu[]> {
  return valides(await fetchKv<OngletMuscu[]>(userId, CLE_MASQUES, []))
}

export async function saveOngletsMasques(userId: string, masques: OngletMuscu[]): Promise<OngletMuscu[]> {
  const propre = valides(masques)
  await saveKv(userId, CLE_MASQUES, propre)
  return propre
}

// ── L'affichage des muscles au journal ──────────────────────────────────────

const CLE_MUSCLES = 'muscu_muscles_visibles'

/**
 * Faut-il écrire les muscles sollicités derrière chaque exercice du journal ?
 *
 * Non, par défaut, et c'est un changement : la liste y était toujours, avec ses
 * coefficients — « Pectoral supérieur:1, Deltoïde antérieur:0.5, Grand
 * pectoral:0.5… ». Douze muscles chiffrés sous un exercice repoussent hors de
 * l'écran ce qu'on vient réellement y lire, qui tient en six caractères :
 * 3×8 @ 65 kg. L'étiquetage reste lu par le mannequin, l'export et le calcul de
 * récupération ; il n'a simplement plus à s'afficher pour cela.
 *
 * L'interrupteur le ramène pour qui vérifie l'étiquetage d'un exercice — c'est
 * le seul moment où ces chiffres servent à l'œil.
 */
export async function loadMusclesVisibles(userId: string): Promise<boolean> {
  return (await fetchKv<boolean>(userId, CLE_MUSCLES, false)) === true
}

export async function saveMusclesVisibles(userId: string, visibles: boolean): Promise<void> {
  await saveKv(userId, CLE_MUSCLES, visibles)
}
