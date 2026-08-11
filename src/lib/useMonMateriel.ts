// Le matériel coché, partagé par tout l'écran.
//
// Il y a DEUX endroits qui s'en servent en même temps : le sélecteur
// d'exercice, qui filtre ce qu'on peut ajouter à la main, et le bouton
// « proposer des exercices », qui compose une séance type sous la même
// contrainte. Chacun avec son état local, ils ont divergé immédiatement — la
// recherche montrait des haltères pendant que la proposition sortait une poulie,
// et rien à l'écran ne disait pourquoi.
//
// D'où ce magasin minuscule : une valeur, des abonnés, et l'écriture en base.
// La règle du projet vaut ici comme ailleurs — une seule définition. Un état
// recopié dans deux composants est une seconde vérité.
//
// Le calcul, lui, ne connaît pas ce module : `lib/monMateriel` reste pur et
// c'est lui que le générateur emploie. React s'arrête à la porte.

import { useEffect, useState } from 'react'
import { useAuthEventuel } from './auth'
import { loadMateriel, saveMateriel, type MonMateriel } from './monMateriel'

let courant: MonMateriel = []
/** Le compte pour lequel la valeur a été lue : changer d'utilisateur relit. */
let luPour: string | null = null
const abonnes = new Set<() => void>()

function diffuser() {
  for (const f of abonnes) f()
}

export function useMonMateriel(): { outils: MonMateriel; choisir: (o: MonMateriel) => void } {
  // `useAuthEventuel` et non `useAuth` : sans compte, le filtre marche quand
  // même — il ne s'enregistre simplement pas. Un sélecteur de matériel n'a
  // aucune raison de faire tomber l'éditeur de séance.
  const user = useAuthEventuel()?.user ?? null
  const [, redessiner] = useState(0)

  useEffect(() => {
    const f = () => redessiner((n) => n + 1)
    abonnes.add(f)
    return () => {
      abonnes.delete(f)
    }
  }, [])

  useEffect(() => {
    if (!user || luPour === user.id) return
    luPour = user.id
    loadMateriel(user.id)
      .then((m) => {
        courant = m
        diffuser()
      })
      .catch(() => {
        // Relire au prochain montage plutôt que de rester sur une liste vide
        // qu'on croirait choisie.
        luPour = null
      })
  }, [user])

  return {
    outils: courant,
    choisir: (o: MonMateriel) => {
      courant = o
      diffuser()
      if (user) saveMateriel(user.id, o).catch(() => {})
    },
  }
}
