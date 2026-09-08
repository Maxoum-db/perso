import { LECONS } from '../lib/solfege'
import { SAX_NOTES } from '../lib/saxophone'
import { PorteeNote } from './PorteeNote'

// Le cours, en accordéon : UNE leçon ouverte à la fois.
//
// Pas dix volets indépendants comme ailleurs dans la section : là on lit, on
// ne compare pas. Deux leçons ouvertes ensemble ne servent à rien et coûtent
// un écran de défilement chacune. Refermer en touchant le titre déjà ouvert
// reste possible — sinon on ne peut plus revoir la table des matières.

export function CoursSolfege({
  ouverte,
  onOuvrir,
}: {
  ouverte: string | null
  onOuvrir: (id: string | null) => void
}) {
  return (
    <div className="space-y-2">
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
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
