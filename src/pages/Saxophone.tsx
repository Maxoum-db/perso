import { useEffect, useState, type ReactNode } from 'react'
import { ecrireCache, lireCache } from '../lib/cache'
import { SAX_NOTES, saxKey, type Registre } from '../lib/saxophone'
import { CLE_ACTIVE, SaxophoneDiagram } from '../components/SaxophoneDiagram'
import { PorteeNote } from '../components/PorteeNote'

// Le doigté est le même sur tous les saxophones (alto, ténor, soprano…) : la
// transposition change le son, jamais le mécanisme des clés. Une seule page
// sert donc à tout le monde, sans réglage d'instrument.
//
// Trois volets repliables plutôt qu'une longue page : portée et saxophone
// mis bout à bout dépassent l'écran d'un téléphone, et c'est justement ensemble
// qu'ils servent — on lit la note, on pose les doigts. Chacun se replie, et le
// bouton du haut les replie tous d'un coup.

type IdVolet = 'notes' | 'portee' | 'doigte'
const VOLETS: IdVolet[] = ['notes', 'portee', 'doigte']

interface Etat {
  note: string
  ouverts: Record<IdVolet, boolean>
}

const DEFAUT: Etat = { note: SAX_NOTES[0].id, ouverts: { notes: true, portee: true, doigte: true } }

const REGISTRES: Array<{ id: Registre; label: string }> = [
  { id: 'grave', label: 'Grave' },
  { id: 'médium', label: 'Médium' },
  { id: 'aigu', label: 'Aigu' },
]

/**
 * L'état relu du cache local, remis d'aplomb.
 *
 * Repris champ par champ et pas tel quel : ce qui est en mémoire vient d'une
 * version antérieure de la page, et une note supprimée du répertoire y
 * survivrait — l'écran s'ouvrirait alors sur un doigté introuvable.
 */
function etatInitial(): Etat {
  const brut = lireCache<Partial<Etat>>('saxophone', DEFAUT)
  return {
    note: SAX_NOTES.some((n) => n.id === brut.note) ? (brut.note as string) : DEFAUT.note,
    ouverts: { ...DEFAUT.ouverts, ...(brut.ouverts ?? {}) },
  }
}

export function Saxophone() {
  const [etat, setEtat] = useState<Etat>(etatInitial)
  useEffect(() => ecrireCache('saxophone', etat), [etat])

  const index = Math.max(
    0,
    SAX_NOTES.findIndex((n) => n.id === etat.note),
  )
  const note = SAX_NOTES[index]

  const choisir = (id: string) => setEtat((e) => ({ ...e, note: id }))
  const decaler = (pas: number) => {
    const suivante = SAX_NOTES[index + pas]
    if (suivante) choisir(suivante.id)
  }
  const basculer = (v: IdVolet) => setEtat((e) => ({ ...e, ouverts: { ...e.ouverts, [v]: !e.ouverts[v] } }))

  // Le bouton se règle sur « reste-t-il quelque chose d'ouvert ? » et non sur
  // « tout est-il ouvert ? » : avec la seconde règle, replier un seul volet
  // faisait basculer le bouton en « tout déplier », et il n'y avait plus aucun
  // moyen de replier le reste d'un geste — l'inverse du service rendu.
  const auMoinsUnOuvert = VOLETS.some((v) => etat.ouverts[v])
  const toutBasculer = () =>
    setEtat((e) => ({
      ...e,
      ouverts: { notes: !auMoinsUnOuvert, portee: !auMoinsUnOuvert, doigte: !auMoinsUnOuvert },
    }))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm font-extrabold text-ink">🎷 Clés du saxophone</h1>
        <button onClick={toutBasculer} className="btn-ghost shrink-0 px-2 py-1 text-[11px]">
          {auMoinsUnOuvert ? 'Tout replier ▴' : 'Tout déplier ▾'}
        </button>
      </div>

      {/* La note choisie reste visible même tous volets repliés, et les deux
          flèches suffisent à parcourir le chromatisme sans rouvrir la grille :
          replier ne doit pas coûter la navigation. */}
      <section className="card p-2">
        <div className="flex items-center gap-1">
          <Fleche sens="◀" onClick={() => decaler(-1)} inactive={index === 0} aide="Note précédente" />
          <button
            onClick={() => basculer('notes')}
            aria-expanded={etat.ouverts.notes}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl2 px-2 py-1.5 transition hover:bg-white/5"
          >
            <span className="truncate text-sm font-bold text-ink">{note.label}</span>
            <span className="shrink-0 text-[10px] text-copper">{etat.ouverts.notes ? '▴' : '▾'}</span>
          </button>
          <Fleche sens="▶" onClick={() => decaler(1)} inactive={index === SAX_NOTES.length - 1} aide="Note suivante" />
        </div>

        {etat.ouverts.notes ? (
          <div className="mt-2 space-y-1.5 border-t border-line/60 pt-2">
            {REGISTRES.map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="text-[10px] font-bold text-muted">{r.label}</div>
                <div className="flex flex-wrap gap-1">
                  {SAX_NOTES.filter((n) => n.registre === r.id).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => choisir(n.id)}
                      aria-pressed={n.id === note.id}
                      className={`chip text-[11px] font-semibold transition ${
                        n.id === note.id ? 'bg-copper text-white' : 'bg-white/5 text-muted hover:text-ink'
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <Volet titre="🎼 Sur la partition" ouvert={etat.ouverts.portee} onToggle={() => basculer('portee')}>
        <PorteeNote note={note} />
      </Volet>

      <Volet titre="🎷 Doigté" ouvert={etat.ouverts.doigte} onToggle={() => basculer('doigte')}>
        <SaxophoneDiagram keys={note.keys} />
        {note.keys.length === 0 ? (
          <p className="mt-2 text-center text-xs text-muted">Aucune clé : le saxophone reste entièrement ouvert.</p>
        ) : (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {note.keys.map((k) => (
              <span
                key={k}
                title={saxKey(k).aide}
                className="rounded-lg px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: `${CLE_ACTIVE}22`, color: CLE_ACTIVE }}
              >
                {saxKey(k).nom}
              </span>
            ))}
          </div>
        )}
      </Volet>

      <p className="px-2 text-center text-[10px] leading-snug text-muted">
        Registre standard, du Si♭ grave au Fa aigu. Doigtés courants — à recouper avec ta méthode pour les cas
        particuliers.
      </p>
    </div>
  )
}

function Fleche({
  sens,
  onClick,
  inactive,
  aide,
}: {
  sens: string
  onClick: () => void
  inactive: boolean
  aide: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={inactive}
      aria-label={aide}
      title={aide}
      className={`shrink-0 rounded-xl2 px-3 py-1.5 text-sm transition ${
        inactive ? 'text-muted/30' : 'text-copper hover:bg-white/5'
      }`}
    >
      {sens}
    </button>
  )
}

function Volet({
  titre,
  ouvert,
  onToggle,
  children,
}: {
  titre: string
  ouvert: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="card">
      <button
        onClick={onToggle}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-bold text-ink">{titre}</span>
        <span className="shrink-0 text-[10px] font-semibold text-copper">{ouvert ? 'replier ▴' : 'déplier ▾'}</span>
      </button>
      {ouvert ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  )
}
