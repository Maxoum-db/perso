import { LECONS } from '../lib/solfege'
import { SAX_NOTES } from '../lib/saxophone'
import { PorteeNote } from './PorteeNote'

// Le cours, en accordéon : UNE leçon ouverte à la fois.
//
// Pas seize volets indépendants comme ailleurs dans la section : là on lit, on
// ne compare pas. Deux leçons ouvertes ensemble ne servent à rien et coûtent
// un écran de défilement chacune. Refermer en touchant le titre déjà ouvert
// reste possible — sinon on ne peut plus revoir la table des matières.
//
// Trois formes de texte, et elles ne se remplacent pas :
//   — les paragraphes, qui expliquent ;
//   — les listes (`points`), qui se mémorisent : mnémoniques, tableaux de
//     tempo, protocoles numérotés. Sur un téléphone, une liste noyée dans un
//     paragraphe ne se relit pas d'un coup d'œil, et c'est justement ce qu'on
//     lui demande ;
//   — l'encadré saxophone, qui raccorde à l'instrument.

export function CoursSolfege({
  ouverte,
  onOuvrir,
}: {
  ouverte: string | null
  onOuvrir: (id: string | null) => void
}) {
  return (
    // Seize lignes de sommaire tiennent presque dans l'écran d'un XCover 7 :
    // l'écart entre les cartes est resserré pour gagner les 30 px qui
    // manquaient, sans toucher à la hauteur des lignes — c'est elle qu'on
    // vise du pouce.
    <div className="space-y-1.5">
      {LECONS.map((l, i) => {
        const ouvert = ouverte === l.id
        const exemple = l.exemple ? SAX_NOTES.find((n) => n.id === l.exemple) : undefined
        return (
          <section key={l.id} className="card">
            <button
              onClick={() => onOuvrir(ouvert ? null : l.id)}
              aria-expanded={ouvert}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <span className="w-5 shrink-0 text-center text-[10px] font-bold text-muted">{i + 1}</span>
              <span className="shrink-0 text-sm">{l.icone}</span>
              <span className="min-w-0 flex-1 text-xs font-bold text-ink">{l.titre}</span>
              <span className="shrink-0 text-[10px] font-semibold text-copper">{ouvert ? '▴' : '▾'}</span>
            </button>

            {ouvert ? (
              <div className="space-y-2 px-3 pb-3">
                {/* La phrase à retenir d'abord : si on ne lit que ça, on a
                    l'essentiel, et le reste ne fait que l'expliquer. */}
                <p className="rounded-xl2 bg-copper/10 px-2.5 py-2 text-[12px] font-semibold leading-snug text-ink">
                  {l.cle}
                </p>

                {l.corps.map((p, j) => (
                  <p key={j} className="text-[12px] leading-relaxed text-muted">
                    {p}
                  </p>
                ))}

                {l.points?.map((bloc, j) => (
                  <div key={j} className="rounded-xl2 bg-white/[0.03] px-2.5 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{bloc.titre}</div>
                    <ul className="mt-1 space-y-1">
                      {bloc.lignes.map((ligne, k) => {
                        // Une ligne qui commence par « 3. » porte déjà son
                        // rang : lui ajouter une puce donne « • 3. », deux
                        // marqueurs pour une seule ligne. On promeut le
                        // numéro au rang de puce.
                        const numerotee = /^(\d+)\.\s+/.exec(ligne)
                        return (
                          <li key={k} className="flex gap-1.5 text-[12px] leading-snug text-ink">
                            <span className="w-3 shrink-0 text-right font-semibold text-copper">
                              {numerotee ? numerotee[1] : '•'}
                            </span>
                            <span className="min-w-0">{numerotee ? ligne.slice(numerotee[0].length) : ligne}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}

                {exemple ? (
                  <div className="rounded-xl2 border border-line/60 p-2">
                    <PorteeNote note={exemple} />
                    <p className="mt-1 text-center text-[10px] text-muted">{exemple.label}</p>
                  </div>
                ) : null}

                <div className="rounded-xl2 border border-copper/30 bg-copper/5 px-2.5 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-copper">Sur ton saxophone</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink">{l.saxophone}</p>
                </div>

                {/* Le renvoi au manuel en dernier, et en petit : il ne sert
                    qu'à celui qui veut creuser, et le manuel n'est pas dans
                    le téléphone. */}
                {l.renvoi ? (
                  <p className="text-right text-[10px] text-muted/70">Manuel · {l.renvoi}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
