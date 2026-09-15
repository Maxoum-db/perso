import type { MesureRepos } from './cardioSeance'

// La récupération lue au cœur : la comparaison, pas le chiffre.
//
// ── Pourquoi une seule mesure ne vaut rien ──────────────────────────────────
//
// « Variabilité : 20 ms » ne dit rien. Rien du tout. La RMSSD varie d'un facteur
// trois entre deux personnes en bonne santé, et du simple au double chez la même
// personne selon l'âge, la posture et l'heure. Aucun barème universel n'existe,
// et ceux qu'on trouve en ligne comparent des gens qui n'ont rien à voir.
//
// Ce qui veut dire quelque chose, c'est l'écart à SA PROPRE moyenne. Une RMSSD
// à 20 ms est excellente pour qui tourne à 18, et alarmante pour qui tourne à
// 45. D'où ce module : il ne juge jamais une mesure seule, il la compare à la
// base que les précédentes ont construite.
//
// ── Le protocole avant les chiffres ─────────────────────────────────────────
//
// Deux mesures ne se comparent que prises de la même façon : même posture, même
// moment. C'est écrit à l'écran, et c'est la condition de tout ce qui suit —
// une base bâtie sur des mesures prises n'importe comment ne mesure que le
// désordre.

/** Combien de mesures forment la base. */
export const FENETRE_BASE = 7

/**
 * Nombre minimal d'intervalles pour qu'une mesure compte.
 *
 * Trente. La RMSSD est une moyenne d'écarts entre battements successifs : sur
 * six intervalles, un seul battement un peu large la double. Les publications
 * demandent couramment une fenêtre d'une minute au repos, soit environ soixante
 * battements ; trente est le plancher en dessous duquel le chiffre ne mérite
 * plus d'être affiché comme une mesure.
 */
export const INTERVALLES_MIN = 30

export function mesureFiable(m: MesureRepos): boolean {
  return m.rmssd !== null && m.intervalles >= INTERVALLES_MIN
}

export interface BaseRepos {
  /** Moyenne des mesures fiables de la fenêtre. `null` s'il n'y en a pas assez. */
  rmssd: number | null
  bpm: number | null
  /** Écart-type de la RMSSD sur la fenêtre — ce qui définit « normal pour toi ». */
  ecartType: number | null
  /** Combien de mesures fiables la base contient. */
  mesures: number
}

/**
 * La base de référence : les dernières mesures fiables, la plus récente exclue.
 *
 * Exclue parce que c'est ELLE qu'on juge : l'inclure dans sa propre référence
 * la rapprocherait mécaniquement de la moyenne et masquerait justement l'écart
 * qu'on cherche.
 */
export function baseDe(historique: MesureRepos[]): BaseRepos {
  const fiables = historique.filter(mesureFiable).slice(1, 1 + FENETRE_BASE)
  if (fiables.length < 3) return { rmssd: null, bpm: null, ecartType: null, mesures: fiables.length }
  const rmssds = fiables.map((m) => m.rmssd as number)
  const moyenne = rmssds.reduce((s, x) => s + x, 0) / rmssds.length
  const variance = rmssds.reduce((s, x) => s + (x - moyenne) ** 2, 0) / rmssds.length
  return {
    rmssd: Math.round(moyenne),
    bpm: Math.round(fiables.reduce((s, m) => s + m.bpm, 0) / fiables.length),
    ecartType: Math.round(Math.sqrt(variance)),
    mesures: fiables.length,
  }
}

export type Verdict = 'reposé' | 'normal' | 'à surveiller' | 'fatigué' | 'inconnu'

export interface LectureRecup {
  verdict: Verdict
  /** Écart à la base, en écarts-types. `null` quand la base manque. */
  z: number | null
  /** Ce que l'écart veut dire, en une phrase. */
  aide: string
}

/**
 * Ce que la dernière mesure dit, comparée à la base.
 *
 * Le seuil est à UN écart-type, et pas à un pourcentage fixe : quelqu'un dont
 * la variabilité oscille de ±3 ms et quelqu'un dont elle oscille de ±15 ms ne
 * doivent pas déclencher la même alerte pour la même baisse absolue. L'unité
 * naturelle est donc la dispersion de la personne elle-même.
 *
 * ⚠️ Ce n'est pas un diagnostic. Une variabilité basse un matin peut venir d'une
 * mauvaise nuit, d'un verre de trop, d'un début de rhume ou d'une grosse séance
 * — la mesure ne sait pas laquelle. Elle dit « quelque chose coûte », pas quoi.
 */
export function lireRecup(derniere: MesureRepos | null, base: BaseRepos): LectureRecup {
  if (!derniere || !mesureFiable(derniere) || base.rmssd === null || base.ecartType === null) {
    return {
      verdict: 'inconnu',
      z: null,
      aide:
        base.mesures < 3
          ? `Il faut au moins trois mesures fiables pour avoir une référence — ${base.mesures} pour l’instant.`
          : 'Dernière mesure trop courte pour être comparée.',
    }
  }
  // Un écart-type nul (mesures identiques) rendrait une division infinie : on
  // retombe alors sur une dispersion plancher plutôt que sur un verdict extrême.
  const sigma = Math.max(base.ecartType, 2)
  const z = (derniere.rmssd as number - base.rmssd) / sigma
  if (z <= -2) {
    return { verdict: 'fatigué', z, aide: 'Nettement sous ta base. Une séance dure aujourd’hui coûtera plus qu’elle ne rapporte.' }
  }
  if (z <= -1) {
    return { verdict: 'à surveiller', z, aide: 'Sous ta base. Séance possible, mais pas le jour d’un record.' }
  }
  if (z >= 1) {
    return { verdict: 'reposé', z, aide: 'Au-dessus de ta base. C’est le jour pour la séance qui fait mal.' }
  }
  return { verdict: 'normal', z, aide: 'Dans ta fourchette habituelle.' }
}

/** « +1,3 σ », « −0,4 σ » — signé, sinon on ne sait pas de quel côté. */
export function fmtEcart(z: number | null): string {
  if (z === null) return '—'
  const arrondi = Math.round(z * 10) / 10
  return `${arrondi > 0 ? '+' : ''}${arrondi.toString().replace('.', ',')} σ`
}

export const COULEUR_VERDICT: Record<Verdict, string> = {
  'reposé': '#5bbf6a',
  normal: '#7fd39a',
  'à surveiller': '#e08a3c',
  'fatigué': '#c9483a',
  inconnu: '#8a8178',
}
