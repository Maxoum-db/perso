import { fetchKv } from './kv'
import { appeler } from './polarLien'

// Ce que Polar sait de toi, et que le brassard seul ne peut pas mesurer.
//
// ── D'où ça vient ───────────────────────────────────────────────────────────
//
// Du TEST DE CONDITION PHYSIQUE de l'application Polar Flow (Start › Testing),
// qui fonctionne avec le Verity Sense : cinq minutes allongé, immobile. Il
// calcule un VO2max à partir de la fréquence de repos, de la variabilité, et
// des données du profil — âge, taille, poids, niveau d'activité déclaré.
//
// C'est une estimation, comme la nôtre, mais une MEILLEURE : elle repose sur
// une mesure de variabilité prise dans les conditions du test, et sur un modèle
// que Polar a calibré sur sa propre population. La nôtre multiplie deux
// approximations et vient de quarante-six hommes bien entraînés.
//
// ── Ce que ce n'est pas ─────────────────────────────────────────────────────
//
// Ni un test à l'effort, ni une mesure directe de consommation d'oxygène. Aucun
// chiffre obtenu sans masque n'en est une. Ce que ça donne, c'est un repère
// stable qu'on peut suivre dans le temps — et c'est ce qu'on en fait.
//
// Le test ORTHOSTATIQUE, lui, demande une montre (Grit X Pro, Vantage V2) : le
// brassard seul ne le fait pas, et aucune valeur n'en viendra.

export interface Physique {
  /** ml/kg/min, mesuré par le test de condition physique. */
  vo2max: number | null
  fcRepos: number | null
  fcMax: number | null
  poidsKg: number | null
  tailleCm: number | null
  /** Date de la mesure, telle que Polar la donne. */
  date: string | null
}

export const CLE_PHYSIQUE = 'polar_physique'

export function physiqueVide(): Physique {
  return { vo2max: null, fcRepos: null, fcMax: null, poidsKg: null, tailleCm: null, date: null }
}

/** Une entrée dont tous les champs utiles sont vides n'apprend rien. */
export function physiqueUtile(p: Physique | null): p is Physique {
  return !!p && (p.vo2max !== null || p.fcRepos !== null || p.fcMax !== null)
}

/**
 * Ce qui a déjà été relevé, lu dans le KV.
 *
 * C'est la fonction serveur qui l'y écrit, et pas l'application : la route de
 * Polar est transactionnelle et EFFACE la donnée à la validation. Laisser le
 * navigateur décider du moment de la validation, c'est perdre la mesure le jour
 * où l'onglet se ferme entre les deux.
 */
export async function loadPhysique(userId: string): Promise<Physique | null> {
  const v = await fetchKv<Physique | null>(userId, CLE_PHYSIQUE, null)
  return physiqueUtile(v) ? v : null
}

export async function releverPhysique(): Promise<{ physique: Physique | null; nouveau: boolean }> {
  return await appeler<{ physique: Physique | null; nouveau: boolean }>({ action: 'physique' })
}
