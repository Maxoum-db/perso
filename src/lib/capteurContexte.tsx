import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useCapteurCardio, type Capteur } from './capteurCardio'
import { fcMaxEstimee } from './cardio'
import { loadFcMaxRelevee } from './cardioSeance'
import { age, loadProfil, PROFIL_DEFAUT, type Profil } from './profil'
import { useAuth } from './auth'

// La liaison au brassard vit au-dessus des écrans.
//
// ── Pourquoi elle a déménagé ────────────────────────────────────────────────
//
// Elle était ouverte par l'écran de séance en cours. Ça paraissait logique —
// c'est là qu'on s'en sert — et ça ne l'était pas : `useCapteurCardio` coupe la
// liaison en se démontant, et l'écran de séance se démonte dès qu'on le réduit
// ou qu'on va voir autre chose. Regarder son journal pendant une séance
// débranchait donc le capteur, silencieusement, et il fallait le rebrancher à
// la main en revenant.
//
// Un brassard n'est pas une propriété d'un écran. C'est un appareil branché au
// téléphone, qui doit le rester tant qu'on ne demande pas le contraire. Il vit
// donc au niveau de l'application, et les écrans le CONSULTENT.
//
// ── Ce que ça permet, au passage ────────────────────────────────────────────
//
// La fréquence peut s'afficher partout — c'était la demande —, le verrou
// d'écran tient pendant la navigation, et l'accumulation des zones ne se remet
// plus à zéro quand on quitte l'écran une seconde.
//
// ── Une seule liaison, deux usages ──────────────────────────────────────────
//
// La séance veut des battements rafraîchis à la seconde ; la mesure au repos
// veut les intervalles Polar, qui dégradent ce rafraîchissement à cinq
// secondes. Les deux ne peuvent pas tourner en même temps, et ils n'ont plus
// chacun leur liaison : c'est `activerPpi` qui bascule, sur demande de la
// mesure au repos, et qui éteint en repartant.

interface ValeurContexte {
  capteur: Capteur
  /**
   * La fréquence maximale retenue — relevée si elle existe, estimée sinon.
   *
   * Exposée parce que tout écran qui affiche une fréquence a besoin de la même
   * pour en déduire la zone. La faire recharger par chacun donnerait des zones
   * différentes d'un écran à l'autre le temps que les requêtes reviennent.
   */
  fcMax: number | null
}

const Contexte = createContext<ValeurContexte | null>(null)

export function CapteurProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  const [relevee, setRelevee] = useState<number | null>(null)

  // La fréquence maximale découpe les zones. Elle est chargée ICI plutôt que
  // passée par chaque écran : c'est un réglage du compte, pas une propriété de
  // l'écran qui regarde, et la sonde de notification la relit à chaque trame.
  useEffect(() => {
    if (!user) return
    loadProfil(user.id).then(setProfil).catch(() => {})
    loadFcMaxRelevee(user.id).then(setRelevee).catch(() => {})
  }, [user])

  const fcMax = relevee ?? fcMaxEstimee(age(profil))
  const capteur = useCapteurCardio(fcMax)
  return <Contexte.Provider value={{ capteur, fcMax }}>{children}</Contexte.Provider>
}

/**
 * Le capteur partagé.
 *
 * Lève si le fournisseur manque, plutôt que de rendre un capteur mort : un
 * écran qui croit avoir un brassard et n'en a pas afficherait « — bpm » pour
 * toujours sans que rien n'explique pourquoi.
 */
export function useCapteur(): Capteur {
  return useContexteCapteur().capteur
}

/** La fréquence maximale retenue, pour traduire un battement en zone. */
export function useFcMax(): number | null {
  return useContexteCapteur().fcMax
}

function useContexteCapteur(): ValeurContexte {
  const c = useContext(Contexte)
  if (!c) throw new Error('useCapteur hors de CapteurProvider')
  return c
}
