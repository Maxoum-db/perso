// L'heure et le bandeau de navigation, cachés pendant le voile.
//
// ── Ce qu'on cache, et avec quoi ────────────────────────────────────────────
//
// Android garde deux bandes par-dessus l'application : la barre d'état en haut
// (heure, batterie, notifications) et la barre de navigation en bas. Une
// application installée en mode `standalone` — c'est le cas d'« Aide » — perd
// la barre d'adresse du navigateur, mais PAS ces deux-là.
//
// La seule chose qui les fasse disparaître depuis une page web est l'API
// Fullscreen. Elle ne cache pas seulement une barre d'outils : elle prend tout
// l'écran, bandes système comprises.
//
// ── Ce qui la rend capricieuse, et il faut le savoir ────────────────────────
//
// `requestFullscreen()` exige une ACTIVATION UTILISATEUR récente. Le navigateur
// refuse tout passage en plein écran qui ne descend pas d'un geste — sinon
// n'importe quelle page volerait l'écran toute seule.
//
// Or le voile tombe DE LUI-MÊME au bout d'une minute sans geste. Par
// construction, il n'y a alors plus aucune activation à dépenser : l'appel
// échoue, et c'est normal, pas une panne.
//
// D'où la façon dont c'est employé côté voile : on essaie à l'assombrissement —
// ça marche quand c'est le bouton 🌙 qui l'a demandé —, et on réessaie au
// premier toucher que le voile avale. Un toucher avalé reste un geste : il ne
// réveille pas l'écran, mais il rend l'activation qui manquait.
//
// Tout est enveloppé : Safari ne nomme pas ces fonctions pareil, Firefox refuse
// sans geste, et un plein écran refusé ne doit jamais interrompre une mesure.

interface ElementPlein extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface DocumentPlein extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

export function pleinEcranPossible(): boolean {
  if (typeof document === 'undefined') return false
  const e = document.documentElement as ElementPlein
  return typeof e.requestFullscreen === 'function' || typeof e.webkitRequestFullscreen === 'function'
}

export function enPleinEcran(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as DocumentPlein
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement)
}

/**
 * Demande le plein écran. Rend `true` si on y est après coup.
 *
 * `navigationUI: 'hide'` est une PRÉFÉRENCE, pas un ordre : la spécification
 * autorise le navigateur à garder sa barre de navigation. Chrome sur Android
 * l'écoute ; là où il ne l'écoute pas, on aura quand même perdu la barre
 * d'état, ce qui est déjà l'essentiel de la demande.
 */
export async function entrerPleinEcran(): Promise<boolean> {
  if (enPleinEcran()) return true
  const e = document.documentElement as ElementPlein
  try {
    if (typeof e.requestFullscreen === 'function') await e.requestFullscreen({ navigationUI: 'hide' })
    else if (typeof e.webkitRequestFullscreen === 'function') await e.webkitRequestFullscreen()
    else return false
  } catch {
    // Refusé faute de geste récent, ou interdit par la politique de permissions.
    return false
  }
  return enPleinEcran()
}

export async function sortirPleinEcran(): Promise<void> {
  if (!enPleinEcran()) return
  const d = document as DocumentPlein
  try {
    if (typeof d.exitFullscreen === 'function') await d.exitFullscreen()
    else if (typeof d.webkitExitFullscreen === 'function') await d.webkitExitFullscreen()
  } catch {
    /* déjà sorti, ou refusé : rien à rattraper */
  }
}
