// Morphologie du mannequin : un seul jeu de tracés, deux silhouettes.
//
// Redessiner trente muscles une seconde fois pour la silhouette féminine
// donnerait deux planches à maintenir en parallèle, qui divergeraient à la
// première retouche. On garde donc UNE anatomie de référence et on lui applique
// une déformation horizontale dépendant de la hauteur : les proportions
// changent, les muscles restent les mêmes et gardent leurs contacts.
//
// Ce que la déformation traduit, en s'appuyant sur les écarts anthropométriques
// classiques (biacromial / bi-iliaque) :
//   - épaules moins larges et cage thoracique plus étroite ;
//   - taille plus marquée ;
//   - bassin plus large — c'est l'écart le plus net, et le plus lisible ;
//   - cuisses relativement plus fortes, genoux plus rapprochés (angle Q).

export type Sexe = 'H' | 'F'

/**
 * Largeur relative de la silhouette féminine, par hauteur dans le canon du
 * mannequin (0 = sommet du crâne, 335 = plante des pieds). Entre deux repères,
 * on interpole : le contour reste continu, sans marche.
 */
const SILHOUETTE_F: Array<[y: number, k: number]> = [
  [0, 0.95], //    crâne
  [45, 0.9], //    cou plus fin
  [63, 0.88], //   ligne des épaules — l'écart biacromial est le plus marqué ici
  [100, 0.91], //  cage thoracique
  [124, 0.85], //  taille
  [152, 1.02], //  crêtes iliaques
  [178, 1.12], //  grands trochanters — bassin large
  [210, 1.07], //  cuisses
  [256, 0.99], //  genou, ramené vers l'axe (angle Q plus ouvert)
  [300, 0.97], //  mollet
  [335, 0.97], //  pied
]

/** Coefficient de largeur à cette hauteur. Toujours 1 pour l'homme, la référence. */
export function largeurRelative(y: number, sexe: Sexe = 'F'): number {
  if (sexe === 'H') return 1
  const p = SILHOUETTE_F
  if (y <= p[0][0]) return p[0][1]
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const [y0, k0] = p[i - 1]
      const [y1, k1] = p[i]
      return k0 + ((k1 - k0) * (y - y0)) / (y1 - y0)
    }
  }
  return p[p.length - 1][1]
}

/** Demi-largeur du tronc au plus large : au-delà, on est sur un membre. */
const TRONC = 32

/**
 * Épaisseur relative des membres. Un bras ne suit pas la largeur du bassin :
 * il faut une valeur à lui, constante sur toute sa longueur.
 */
const MEMBRES_F = 0.93

/**
 * Abscisse déformée.
 *
 * Le coefficient de largeur décrit le TRONC. L'appliquer tel quel au bras, qui
 * pend le long du corps, l'étirait en biais : rétréci au coude (au niveau de la
 * taille) et élargi au poignet (au niveau des hanches) — un avant-bras en
 * trompette. Au-delà de la demi-largeur du tronc, le membre est donc translaté
 * en bloc, avec sa propre épaisseur : un bassin large écarte le bras du corps,
 * il ne l'épaissit pas.
 */
export function deformerX(x: number, y: number, sexe: Sexe): number {
  if (sexe === 'H') return x
  const a = Math.abs(x)
  const tronc = Math.min(a, TRONC) * largeurRelative(y, sexe)
  const membre = Math.max(0, a - TRONC) * MEMBRES_F
  return (x < 0 ? -1 : 1) * (tronc + membre)
}

/**
 * Toutes les coordonnées des tracés vont par paires « x,y » et les commandes se
 * limitent à M, L, C et Z — pas d'arc ni de commande relative. Chaque point peut
 * donc être déplacé indépendamment, points de contrôle compris : la courbe suit
 * sans qu'on ait à la recalculer.
 */
const PAIRE = /(-?\d*\.?\d+),(-?\d*\.?\d+)/g

/** Commandes autorisées — un tracé qui en sortirait ne serait plus déformable. */
export const COMMANDES_ADMISES = /^[MLCZ\s\-.,\d]*$/

export function morphPath(d: string, sexe: Sexe): string {
  if (sexe === 'H') return d
  return d.replace(PAIRE, (_m, sx: string, sy: string) => {
    const x = deformerX(parseFloat(sx), parseFloat(sy), sexe)
    // Deux décimales : au-delà on alourdit le DOM sans rien gagner à l'écran.
    return `${Math.round(x * 100) / 100},${sy}`
  })
}
