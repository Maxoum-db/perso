import { useEffect, useState, type ReactNode } from 'react'
import {
  ecrireEtatSax,
  groupesDeNotes,
  lireEtatSax,
  SAX_NOTES,
  saxKey,
  VOLETS,
  type EtatSax,
  type IdVolet,
} from '../lib/saxophone'
import { CLE_ACTIVE, SaxophoneDiagram } from '../components/SaxophoneDiagram'
import { PorteeNote } from '../components/PorteeNote'

// Le doigté est le même sur tous les saxophones (alto, ténor, soprano…) : la
// transposition change le son, jamais le mécanisme des clés. Une seule page
// sert donc à tout le monde, sans réglage d'instrument.
//
// Tout est replié ou dépliable, et rien n'est empilé sans raison : sur un
// téléphone, la place perdue se paie en défilement.
//
// La portée est posée À CÔTÉ du saxophone et non au-dessus : le saxophone est
// haut et étroit, il laissait une colonne vide sur toute sa hauteur pendant
// que la portée occupait une carte à elle. Côte à côte, les deux tiennent dans
// la hauteur du seul saxophone — et c'est ensemble qu'ils servent, on lit la
// note et on pose les doigts.

export function Saxophone() {
  const [etat, setEtat] = useState<EtatSax>(lireEtatSax)
  useEffect(() => ecrireEtatSax(etat), [etat])

  const index = Math.max(
    0,
    SAX_NOTES.findIndex((n) => n.id === etat.note),
  )
  const note = SAX_NOTES[index]
  const groupes = groupesDeNotes(etat.classement)

  const choisir = (id: string) => setEtat((e) => ({ ...e, note: id }))
  const decaler = (pas: number) => {
    const suivante = SAX_NOTES[index + pas]
    if (suivante) choisir(suivante.id)
  }
  const basculer = (v: IdVolet) => setEtat((e) => ({ ...e, ouverts: { ...e.ouverts, [v]: !e.ouverts[v] } }))
  const basculerGroupe = (cle: string) =>
    setEtat((e) => ({
      ...e,
      groupesReplies: e.groupesReplies.includes(cle)
        ? e.groupesReplies.filter((c) => c !== cle)
        : [...e.groupesReplies, cle],
    }))

  // Le bouton se règle sur « reste-t-il quelque chose d'ouvert ? » et non sur
  // « tout est-il ouvert ? » : avec la seconde règle, replier un seul volet
  // faisait basculer le bouton en « tout déplier », et il n'y avait plus aucun
  // moyen de replier le reste d'un geste — l'inverse du service rendu.
  const auMoinsUnOuvert = VOLETS.some((v) => etat.ouverts[v])
  const toutBasculer = () =>
    setEtat((e) => ({
      ...e,
      ouverts: { notes: !auMoinsUnOuvert, doigte: !auMoinsUnOuvert },
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
          <div className="mt-2 space-y-2 border-t border-line/60 pt-2">
            {groupes.map((g) => {
              const replie = etat.groupesReplies.includes(g.cle)
              const contientLaNote = g.notes.some((n) => n.id === note.id)
              return (
                <div key={g.cle} className="space-y-1">
                  <button
                    onClick={() => basculerGroupe(g.cle)}
                    aria-expanded={!replie}
                    className="flex w-full items-baseline gap-1 text-left"
                  >
                    <span className="shrink-0 text-[10px] text-copper">{replie ? '▸' : '▾'}</span>
                    <span className="shrink-0 text-[10px] font-bold text-ink">{g.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
                      {replie ? `— ${g.notes.length} notes` : `— ${g.aide}`}
                    </span>
                    {/* Un paquet replié qui contient la note choisie le dit :
                        sinon elle disparaît de l'écran sans laisser de trace de
                        l'endroit où la retrouver. */}
                    {replie && contientLaNote ? (
                      <span className="shrink-0 text-[10px] font-bold text-copper">• {note.label}</span>
                    ) : null}
                  </button>
                  {replie ? null : (
                    <div className="flex flex-wrap gap-1">
                      {g.notes.map((n) => (
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
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </section>

      <Volet titre="🎼 Partition et doigté" ouvert={etat.ouverts.doigte} onToggle={() => basculer('doigte')}>
        {/* Deux colonnes : le saxophone est haut et étroit, la portée est basse
            et large. L'une remplit exactement le vide laissé par l'autre.
            Sans les noms des clés, la colonne de droite se vide : on y centre
            alors la portée plutôt que de la laisser en haut d'un trou. */}
        <div className={`flex gap-2 ${etat.doigtsVisibles ? 'items-start' : 'items-center'}`}>
          <div className="w-[46%] shrink-0">
            <SaxophoneDiagram keys={note.keys} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <PorteeNote note={note} />
            {!etat.doigtsVisibles ? null : note.keys.length === 0 ? (
              <p className="text-center text-[11px] leading-snug text-muted">
                Aucune clé : le saxophone reste entièrement ouvert.
              </p>
            ) : (
              <div className="flex flex-wrap justify-center gap-1">
                {note.keys.map((k) => (
                  <span
                    key={k}
                    title={saxKey(k).aide}
                    className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${CLE_ACTIVE}22`, color: CLE_ACTIVE }}
                  >
                    {saxKey(k).nom}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Volet>

      {/* Les deux réglages de présentation vivent dans l'écran des réglages, à
          l'écrou de l'en-tête. On le dit ici : déplacer une commande sans
          laisser d'adresse, c'est la supprimer pour qui s'en servait. */}
      <p className="px-2 text-center text-[10px] leading-snug text-muted">
        Classement des notes et liste des doigts : à l’écrou, en haut à droite.
        <br />
        Note écrite en clé de sol — mêmes doigtés sur tous les saxophones. Registre standard, du Si♭ grave au Fa aigu ;
        doigtés courants, à recouper avec ta méthode.
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
