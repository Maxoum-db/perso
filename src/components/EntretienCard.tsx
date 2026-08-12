import { PESEES_FIABLES, deriveEntretien, entretienParMois } from '../lib/entretien'
import type { Profil } from '../lib/profil'
import type { MuscuSession } from '../lib/muscu'
import type { Weighin } from '../lib/workouts'

// L'apport d'entretien, mois par mois.
//
// La carte Balance le déduit pour maintenant et l'oublie aussitôt. Ici il
// s'accumule : c'est la seule mesure de fond disponible sans peser un aliment.
//
// Le nombre de pesées du mois est affiché à côté de chaque point, et ce n'est
// pas décoratif : un mois à trois pesées et un mois à vingt ne se lisent pas
// avec la même confiance, et rien d'autre à l'écran ne le dirait.

export function EntretienCard({
  sessions,
  weighins,
  profil,
  mois = 6,
}: {
  sessions: MuscuSession[]
  weighins: Weighin[]
  profil: Profil
  mois?: number
}) {
  const points = entretienParMois(sessions, weighins, profil, mois)
  const utiles = points.filter((m) => m.entretien !== null)
  const derive = deriveEntretien(points)
  const max = Math.max(1, ...utiles.map((m) => m.entretien!))
  const min = Math.min(...utiles.map((m) => m.entretien!), max)
  const amplitude = Math.max(200, max - min)

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-sm font-extrabold text-ink">🍽️ Ton entretien, mois par mois</h2>

      {utiles.length === 0 ? (
        <p className="rounded-xl2 border border-copper/30 bg-copper/5 p-2 text-[11px] text-ink">
          Il me faut un mois avec au moins trois pesées étalées sur une semaine, et ta taille et ton année de
          naissance renseignées.
        </p>
      ) : (
        <>
          <div>
            <div className="text-3xl font-extrabold text-ink">
              {utiles[utiles.length - 1].entretien!.toLocaleString('fr-FR')}{' '}
              <span className="text-lg font-bold text-muted">kcal/jour</span>
            </div>
            <div className="text-xs text-muted">
              ton entretien sur {utiles[utiles.length - 1].label}
              {/* Le mois en cours n'est pas fini : son chiffre est le plus utile
                  et le moins sûr à la fois, et rien dans un nombre en gros ne
                  le dirait. */}
              {utiles[utiles.length - 1].fiable ? null : (
                <span className="text-clay">
                  {' '}— {utiles[utiles.length - 1].pesees} pesée
                  {utiles[utiles.length - 1].pesees > 1 ? 's' : ''} seulement, à prendre avec des pincettes
                </span>
              )}
            </div>
            {derive ? (
              <div
                className={`text-xs font-semibold ${
                  Math.abs(derive.delta) < 100 ? 'text-muted' : derive.delta > 0 ? 'text-sage-dark' : 'text-clay'
                }`}
              >
                {derive.delta > 0 ? '+' : ''}
                {derive.delta.toLocaleString('fr-FR')} kcal/jour depuis {derive.de}
              </div>
            ) : null}
          </div>

          <ul className="space-y-1">
            {points.map((m) => {
              const largeur =
                m.entretien !== null ? 12 + ((m.entretien - min) / amplitude) * 78 : 0
              const sûr = m.fiable
              return (
                <li key={m.debut} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 truncate text-[11px] text-muted">{m.label}</span>
                  <span className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded bg-bg">
                    {m.entretien !== null ? (
                      <span
                        className="absolute inset-y-0 left-0 rounded"
                        style={{
                          width: `${largeur}%`,
                          background: sûr ? 'rgb(var(--copper))' : 'rgb(var(--copper) / .4)',
                        }}
                      />
                    ) : null}
                  </span>
                  <span className="w-24 shrink-0 text-right">
                    {m.entretien !== null ? (
                      <>
                        <b className="text-ink">{m.entretien.toLocaleString('fr-FR')}</b>
                        <span
                          className={`ml-1.5 text-[10px] ${sûr ? 'text-muted' : 'text-clay'}`}
                          title={`${m.pesees} pesée${m.pesees > 1 ? 's' : ''} dans le mois — ${
                            sûr ? 'assez pour conclure' : `il en faut ${PESEES_FIABLES}`
                          }`}
                        >
                          {m.pesees}&nbsp;⚖
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted">
                        {m.pesees === 0 ? 'aucune pesée' : `${m.pesees} pesée${m.pesees > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="text-[10px] leading-relaxed text-muted">
        Dépense estimée du mois, plus l'écart que trahit la pente de ta courbe de poids — la même règle que la
        Balance, appliquée à un mois révolu. Un point isolé ne veut pas dire grand-chose : sur quatre à huit
        pesées, l'incertitude de la pente vaut déjà <b>±165 kcal/jour</b>. C'est la <b>suite</b> des points qui se
        lit. Les barres pâles sont les mois à moins de {PESEES_FIABLES} pesées, et le chiffre à côté de chaque
        valeur dit combien il y en a eu.
      </p>
    </section>
  )
}
