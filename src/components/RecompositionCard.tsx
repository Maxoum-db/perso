import {
  FENETRE_RECOMPO,
  evaluerRecomposition,
  manqueRecompo,
} from '../lib/recomposition'
import { moyenneGlissante } from '../lib/profil'
import type { Mensuration } from '../lib/mensurations'
import type { Weighin } from '../lib/workouts'

// Le poids et le tour de taille sur le même graphique, et le verdict qui en
// sort.
//
// Deux unités sur un seul cadre : chaque série a sa propre échelle verticale,
// calée sur SON amplitude. Les hauteurs ne sont donc pas comparables entre
// elles — c'est la seule façon de rendre lisibles deux centimètres de taille à
// côté de trois kilos de poids —, mais les PENTES le sont, et ce sont elles qui
// portent toute l'information.

const TONS: Record<'bon' | 'neutre' | 'attention', { couleur: string; fond: string }> = {
  bon: { couleur: 'text-sage-dark', fond: 'border-sage-dark/40 bg-sage-dark/5' },
  neutre: { couleur: 'text-ink', fond: 'border-line bg-white/5' },
  attention: { couleur: 'text-clay', fond: 'border-clay/40 bg-clay/5' },
}

const W = 300
const H = 116

export function RecompositionCard({
  weighins,
  mensurations,
  jours = FENETRE_RECOMPO,
}: {
  weighins: Weighin[]
  mensurations: Mensuration[]
  jours?: number
}) {
  const recompo = evaluerRecomposition(weighins, mensurations, jours)

  const limite = new Date()
  limite.setHours(0, 0, 0, 0)
  limite.setDate(limite.getDate() - jours)
  const limiteStr = limite.toLocaleDateString('en-CA')

  const pesees = weighins.filter((w) => w.date >= limiteStr).sort((a, b) => a.date.localeCompare(b.date))
  const tailles = mensurations.filter((m) => m.date >= limiteStr).sort((a, b) => a.date.localeCompare(b.date))

  // La courbe demande les deux séries ; le verdict, lui, a ses propres
  // exigences et peut manquer alors que le tracé, lui, tient debout.
  const traçable = pesees.length >= 2 && tailles.length >= 2

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-sm font-extrabold text-ink">🔀 Poids et tour de taille</h2>

      {recompo ? (
        <div className={`rounded-xl2 border p-3 ${TONS[recompo.ton].fond}`}>
          <div className={`text-sm font-extrabold ${TONS[recompo.ton].couleur}`}>{recompo.titre}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-muted">
            {recompo.pentePoids > 0 ? '+' : ''}
            {recompo.pentePoids.toFixed(2)} kg/sem · {recompo.penteTaille > 0 ? '+' : ''}
            {recompo.penteTaille.toFixed(2)} cm/sem
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{recompo.explication}</p>
        </div>
      ) : (
        <p className="rounded-xl2 border border-copper/30 bg-copper/5 p-2 text-[11px] text-ink">
          {manqueRecompo(weighins, mensurations, jours)}
        </p>
      )}

      {traçable ? <Courbe pesees={pesees} tailles={tailles} jours={jours} /> : null}

      <p className="text-[10px] leading-relaxed text-muted">
        Chaque courbe a sa propre échelle : les hauteurs ne se comparent pas, les <b>pentes</b> si. C'est leur
        croisement qui tranche — la balance seule ne distingue pas un kilo de muscle d'un kilo de gras, et à poids
        constant elle affiche exactement la même chose qu'on progresse ou qu'on stagne.
      </p>
    </section>
  )
}

function Courbe({
  pesees,
  tailles,
  jours,
}: {
  pesees: Weighin[]
  tailles: Mensuration[]
  jours: number
}) {
  const jour = (d: string) => Date.parse(d + 'T00:00:00') / 86400000
  const fin = jour(new Date().toLocaleDateString('en-CA'))
  const debut = fin - jours
  const px = (d: string) => ((jour(d) - debut) / jours) * (W - 8) + 4

  // Une échelle par série, calée sur sa propre amplitude, avec un plancher
  // d'amplitude : sans lui, trois pesées à 30 g d'écart rempliraient toute la
  // hauteur et donneraient à voir une montagne là où il n'y a que du bruit.
  const echelle = (valeurs: number[], plancher: number) => {
    const min = Math.min(...valeurs)
    const max = Math.max(...valeurs)
    const amplitude = Math.max(plancher, max - min)
    return { min, max, py: (v: number) => H - 14 - ((v - min) / amplitude) * (H - 30) }
  }

  // Le poids se lit lissé — ±1,5 kg de bruit quotidien —, le tour de taille
  // brut : deux mesures par mois ne se moyennent pas sur sept jours, la moyenne
  // glissante ne ferait que recopier le dernier point.
  const lisse = moyenneGlissante(pesees.map((w) => ({ date: w.date, weight_kg: w.weight_kg })), 7)
  const eP = echelle(lisse.map((p) => p.value), 0.8)
  const eT = echelle(tailles.map((m) => m.waist_cm), 1.5)

  const ligne = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Poids et tour de taille">
        <polyline
          points={ligne(lisse.map((p) => ({ x: px(p.date), y: eP.py(p.value) })))}
          fill="none"
          stroke="rgb(var(--copper))"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <polyline
          points={ligne(tailles.map((m) => ({ x: px(m.date), y: eT.py(m.waist_cm) })))}
          fill="none"
          stroke="rgb(var(--sage-dark))"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeDasharray="5 3"
        />
        {tailles.map((m) => (
          <circle key={m.date} cx={px(m.date)} cy={eT.py(m.waist_cm)} r="2.2" fill="rgb(var(--sage-dark))" />
        ))}
        <text x="2" y="9" fill="rgb(var(--copper))" fontSize="8">
          {eP.max.toFixed(1)} kg
        </text>
        <text x="2" y={H - 2} fill="rgb(var(--copper))" fontSize="8">
          {eP.min.toFixed(1)} kg
        </text>
        <text x={W - 2} y="9" fill="rgb(var(--sage-dark))" fontSize="8" textAnchor="end">
          {eT.max.toFixed(1)} cm
        </text>
        <text x={W - 2} y={H - 2} fill="rgb(var(--sage-dark))" fontSize="8" textAnchor="end">
          {eT.min.toFixed(1)} cm
        </text>
      </svg>

      <div className="mt-1 flex justify-center gap-4 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: 'rgb(var(--copper))' }} /> poids
          lissé
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ background: 'rgb(var(--sage-dark))' }}
          />{' '}
          tour de taille
        </span>
        <span>{jours} j</span>
      </div>
    </div>
  )
}
