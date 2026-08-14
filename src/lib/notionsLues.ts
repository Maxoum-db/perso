import { useEffect, useState } from 'react'
import { useAuth } from './auth'
import { fetchKv, readKvCache, saveKv } from './kv'

// Suivi de lecture des notions (Apprentissage + Arborescence) : une coche
// librement réversible — pas d'appel FSRS. Cocher puis décocher pour rattraper
// un mis-clic ne doit rien écrire côté hub ; noter une carte reste un geste à
// part, délibéré (Quiz, Notion du jour), pas une case qu'on peut toucher par
// erreur en survolant la liste.
//
// ── Pourquoi ce n'est plus purement local ───────────────────────────────────
//
// La coche vivait dans le localStorage, donc dans un seul navigateur. Cocher
// une notion sur l'ordinateur la laissait décochée sur le téléphone, et vider
// le cache effaçait des mois de lecture sans prévenir. « Purement local » était
// un choix défendable pour un réglage d'affichage ; ça n'en est pas un pour la
// trace de ce qu'on a lu d'un programme qui court jusqu'en 2028.
//
// Elle passe donc dans `perso_kv`, comme les courbatures et l'armure : cache
// local pour l'affichage immédiat, écriture réseau derrière. Ce qui était déjà
// coché est repris au premier chargement.

const CLE = 'rustique_notions_lues_v1'
const ANCIENNE_CLE_LOCALE = 'perso_notions_lues'

function lireLocal(): string[] {
  try {
    const raw = localStorage.getItem(ANCIENNE_CLE_LOCALE)
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function useNotionsLues() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  // Le cache rend la liste tout de suite : une coche ne doit pas clignoter le
  // temps d'un aller-retour réseau.
  const [lues, setLues] = useState<Set<string>>(() => new Set(readKvCache<string[]>(CLE, [])))

  useEffect(() => {
    if (!userId) return
    let vivant = true
    fetchKv<string[]>(userId, CLE, []).then(async (distantes) => {
      if (!vivant) return
      const local = lireLocal()
      // Reprise de l'ancien stockage : on FUSIONNE plutôt que de choisir une
      // source. Deux appareils ont pu cocher chacun de leur côté avant la
      // bascule, et une coche perdue ne se remarque pas — on ne saurait même
      // pas qu'il y a eu perte.
      const fusion = new Set([...(Array.isArray(distantes) ? distantes : []), ...local])
      setLues(fusion)
      if (local.length > 0) {
        await saveKv(userId, CLE, [...fusion])
        try {
          localStorage.removeItem(ANCIENNE_CLE_LOCALE)
        } catch {
          // Sans gravité : la fusion est idempotente, elle peut se rejouer.
        }
      }
    })
    return () => {
      vivant = false
    }
  }, [userId])

  function toggle(cardId: string) {
    setLues((s) => {
      const n = new Set(s)
      if (n.has(cardId)) n.delete(cardId)
      else n.add(cardId)
      if (userId) void saveKv(userId, CLE, [...n])
      return n
    })
  }

  return { lues, toggle }
}
