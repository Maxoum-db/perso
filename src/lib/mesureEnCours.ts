import { useEffect, useState } from 'react'

// « Quelque chose est en train de mesurer. »
//
// ── Pourquoi ce fil à part ──────────────────────────────────────────────────
//
// Le voile noir ne descend que pendant une mesure : c'est le seul moment où
// l'écran doit rester allumé sans qu'on le regarde. Jusqu'ici, « une mesure »
// voulait dire « le brassard est branché », et le voile lisait directement
// l'état du capteur cardiaque.
//
// Le GPS a exactement le même besoin et exactement la même contrainte — la
// page en arrière-plan, et tout s'arrête. Mais il ne vit pas dans un
// fournisseur : il est monté par l'écran qui enregistre, et le voile, qui vit
// dans la mise en page, ne peut pas le voir.
//
// Plutôt que de remonter le GPS dans un fournisseur — une chirurgie sur le
// chemin de la connexion, exactement là où une régression coûte cher — on pose
// un fil minuscule : un compteur de mesures en cours, que n'importe quoi peut
// incrémenter, et que le voile écoute.
//
// ── Pourquoi un COMPTEUR et pas un booléen ──────────────────────────────────
//
// Deux mesures peuvent tourner ensemble : on marche avec le brassard au bras.
// Un booléen remis à `false` par la première qui s'arrête éteindrait le voile
// alors que l'autre mesure encore. Le compteur ne retombe à zéro que quand la
// dernière a rendu son jeton.

let compteur = 0
const abonnes = new Set<(v: boolean) => void>()

function prevenir() {
  const v = compteur > 0
  for (const f of abonnes) f(v)
}

/**
 * Annonce une mesure, et rend de quoi l'annuler.
 *
 * Le jeton rendu est IDEMPOTENT : l'appeler deux fois ne décrémente qu'une
 * fois. Sans ça, un effet React démonté puis remonté — ce qui arrive en mode
 * strict — ferait passer le compteur sous zéro, et le voile ne descendrait
 * plus jamais.
 */
export function mesureDemarre(): () => void {
  compteur++
  prevenir()
  let rendu = false
  return () => {
    if (rendu) return
    rendu = true
    compteur--
    prevenir()
  }
}

export function mesureEnCours(): boolean {
  return compteur > 0
}

export function useMesureEnCours(): boolean {
  const [v, setV] = useState(mesureEnCours)
  useEffect(() => {
    // L'état est relu au montage : le compteur a pu bouger entre le premier
    // rendu et l'abonnement.
    setV(mesureEnCours())
    abonnes.add(setV)
    return () => {
      abonnes.delete(setV)
    }
  }, [])
  return v
}

/** Remet le fil à zéro — réservé aux contrôles. */
export function _remettreAZero(): void {
  compteur = 0
  prevenir()
}
