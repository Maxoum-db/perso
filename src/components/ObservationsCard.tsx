import { useState } from 'react'
import {
  MIN_OBSERVATIONS,
  bilanParZone,
  fmtEcart,
  type Observations,
} from '../lib/observations'
import { MUSCLE_LABELS } from '../lib/muscles'
import { fmtAjust } from '../lib/soreness'

// La base des ressentis déclarés, rendue lisible.
//
// Ce n'est pas un historique décoratif : c'est la matière première du prochain
// réglage du barème. D'où ce qui est affiché — l'écart moyen par zone, le nombre
// d'observations qui le soutient, et la vitesse que ces observations suggèrent.
//
// Deux règles de présentation, tenues :
//
//   • en dessous de MIN_OBSERVATIONS, aucune suggestion. Trois déclarations sur
//     un muscle ne distinguent pas une tendance d'une mauvaise semaine, et
//     afficher un chiffre donnerait à du bruit l'allure d'une mesure ;
//   • l'export brut est accessible. Le jour où on affine vraiment le barème, ce
//     sera à partir de ces lignes-là, pas à partir d'un résumé.

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function ObservationsCard({ observations }: { observations: Observations }) {
  const [ouvert, setOuvert] = useState(false)
  const [copie, setCopie] = useState(false)
  const bilan = bilanParZone(observations)
  const mures = bilan.filter((b) => b.n >= MIN_OBSERVATIONS)

  async function copier() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(observations, null, 2))
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      /* pas de presse-papier : le bouton ne fait rien, ce n'est pas grave */
    }
  }

  return (
    <div className="card p-4">
      <button onClick={() => setOuvert((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          🔬 Ressentis enregistrés
        </span>
        <span className="ml-auto shrink-0 text-xs font-bold text-copper">
          {observations.length}
          {observations.length > 0 ? ` · ${bilan.length} zone${bilan.length > 1 ? 's' : ''}` : ''}
        </span>
        <span className="shrink-0 text-xs text-muted">{ouvert ? '▴' : '▾'}</span>
      </button>

      {observations.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">
          Chaque fois que tu corriges le ressenti d’un muscle sur le mannequin, la correction est
          enregistrée ici avec ce que le barème prévoyait. C’est cette base qui servira à affiner les
          temps de récupération.
        </p>
      ) : null}

      {ouvert && observations.length > 0 ? (
        <div className="mt-3 space-y-3">
          {/* ── Ce que la base dit déjà ─────────────────────────────────── */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold text-ink">Écart du barème, par zone</div>
            <ul className="space-y-1">
              {bilan.map((b) => {
                const mur = b.n >= MIN_OBSERVATIONS
                const bouge = mur && Math.abs(b.vitesseSuggeree - b.vitesse) >= 0.05
                return (
                  <li key={b.region} className="flex items-baseline gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-ink">{b.label}</span>
                    <span className="shrink-0 text-muted">{b.n}×</span>
                    <span
                      className="w-32 shrink-0 text-right"
                      style={{
                        color:
                          Math.abs(b.ecart) < 0.15
                            ? 'rgb(var(--muted))'
                            : b.ecart > 0
                              ? 'rgb(var(--clay))'
                              : 'rgb(var(--sage-dark))',
                      }}
                    >
                      {fmtEcart(b.ecart)}
                    </span>
                    <span className="w-24 shrink-0 text-right font-semibold text-muted">
                      {bouge ? (
                        <span style={{ color: 'rgb(var(--copper))' }}>
                          ×{b.vitesse} → ×{b.vitesseSuggeree}
                        </span>
                      ) : mur ? (
                        `×${b.vitesse} tenu`
                      ) : (
                        `${MIN_OBSERVATIONS - b.n} à venir`
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-1.5 text-[10px] text-muted">
              « Trop optimiste » = tu déclares plus de courbatures que prévu, la zone est plus lente
              qu’on ne le croit. Une suggestion n’apparaît qu’au-delà de {MIN_OBSERVATIONS} observations,
              et ne bouge la vitesse que de la moitié de l’écart constaté — une base de ressentis ne
              justifie pas de réécrire un barème d’un coup.
            </p>
          </div>

          {/* ── Les dernières lignes brutes ─────────────────────────────── */}
          <div className="border-t border-line/60 pt-2">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-bold text-ink">Dernières déclarations</span>
              <button onClick={copier} className="ml-auto shrink-0 text-[10px] font-semibold text-copper">
                {copie ? '✓ copié' : '⧉ exporter en JSON'}
              </button>
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {[...observations]
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 30)
                .map((o) => (
                  <li key={o.at + o.region} className="flex items-baseline gap-2 text-[10px]">
                    <span className="w-12 shrink-0 text-muted">{frDate(o.at)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{MUSCLE_LABELS[o.region]}</span>
                    <span className="shrink-0 text-muted">
                      prévu {o.prevu.toFixed(1).replace('.', ',')} j
                    </span>
                    <span
                      className="w-20 shrink-0 text-right font-bold"
                      style={{
                        color: o.pret
                          ? 'rgb(var(--sage-dark))'
                          : o.ajustement === 0
                            ? 'rgb(var(--muted))'
                            : o.ajustement > 0
                              ? 'rgb(var(--clay))'
                              : 'rgb(var(--sage))',
                      }}
                    >
                      {o.pret ? '✅ tout bon' : o.ajustement === 0 ? 'juste' : fmtAjust(o.ajustement)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {mures.length === 0 ? (
            <p className="text-[10px] text-muted">
              Aucune zone n’a encore assez d’observations pour qu’une suggestion veuille dire quelque
              chose. Continue de corriger le mannequin quand il se trompe : c’est exactement ce qui
              alimente cette base.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
