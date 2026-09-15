import { useState, type ReactNode } from 'react'

// Une section de réglages, repliée par défaut.
//
// ── Pourquoi tout replier ───────────────────────────────────────────────────
//
// L'écran des réglages a quatorze sections et fait plusieurs milliers de pixels
// de haut. On y vient pour UNE chose — changer la taille du texte, éteindre le
// capteur, partager une séance — et on la cherche en faisant défiler.
//
// Replié, l'écran redevient ce qu'il devrait être : une table des matières. On
// voit les quatorze titres d'un coup, on ouvre celui qu'on veut.
//
// ── Ce que l'ouverture retient, et où ───────────────────────────────────────
//
// Dans le stockage local, pas en base. C'est une commodité d'affichage propre à
// l'appareil : rouvrir le même volet sur le téléphone n'a pas à décider de ce
// que montre l'ordinateur. Et une préférence d'affichage ne mérite pas un
// aller-retour réseau à chaque pliage.

const CLE = 'reglages_volets_ouverts'

function ouverts(): string[] {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '[]')
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // Stockage refusé (navigation privée, réglage du navigateur) : tout est
    // replié, et rien ne casse. Le pliage marche, il ne se souvient pas.
    return []
  }
}

function retenir(id: string, ouvert: boolean): void {
  try {
    const set = new Set(ouverts())
    if (ouvert) set.add(id)
    else set.delete(id)
    localStorage.setItem(CLE, JSON.stringify([...set]))
  } catch {
    /* tant pis pour la mémoire */
  }
}

export function VoletReglage({
  id,
  titre,
  resume,
  children,
}: {
  /** Identifiant stable : c'est lui qu'on retient, pas le titre. */
  id: string
  titre: string
  /**
   * Ce qu'on lit sans ouvrir — un compte, un état.
   *
   * Un volet replié qui ne dit rien de son contenu oblige à l'ouvrir pour
   * vérifier, donc à ne jamais le replier.
   */
  resume?: ReactNode
  children: ReactNode
}) {
  const [ouvert, setOuvert] = useState(() => ouverts().includes(id))
  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => {
          const suivant = !ouvert
          setOuvert(suivant)
          retenir(id, suivant)
        }}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1 text-sm font-bold text-ink">{titre}</span>
        {resume ? <span className="shrink-0 text-[11px] text-muted">{resume}</span> : null}
        <span className="shrink-0 text-[11px] font-semibold text-copper">{ouvert ? '▾' : '▸'}</span>
      </button>
      {ouvert ? <div className="px-4 pb-4">{children}</div> : null}
    </section>
  )
}
