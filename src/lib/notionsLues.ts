import { useState } from 'react'

// Suivi de lecture des notions (Apprentissage + Arborescence) : une coche
// PUREMENT locale, librement réversible — pas d'appel FSRS. Cocher puis
// décocher pour rattraper un mis-clic ne doit rien écrire côté hub ; noter
// une carte reste un geste à part, délibéré (Quiz, Notion du jour), pas une
// case qu'on peut toucher par erreur en survolant la liste.

const CLE = 'perso_notions_lues'

function lire(): Set<string> {
  try {
    const raw = localStorage.getItem(CLE)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function ecrire(s: Set<string>) {
  localStorage.setItem(CLE, JSON.stringify([...s]))
}

export function useNotionsLues() {
  const [lues, setLues] = useState<Set<string>>(() => lire())

  function toggle(cardId: string) {
    setLues((s) => {
      const n = new Set(s)
      if (n.has(cardId)) n.delete(cardId)
      else n.add(cardId)
      ecrire(n)
      return n
    })
  }

  return { lues, toggle }
}
