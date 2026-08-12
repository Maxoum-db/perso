import { useState, type ReactNode } from 'react'
import {
  FENETRE_RECOMPO,
  evaluerRecomposition,
  manqueRecompo,
  penteTaille,
} from '../lib/recomposition'
import { moyenneGlissante, tendancePoids } from '../lib/profil'
import type { Mensuration } from '../lib/mensurations'
import type { Weighin } from '../lib/workouts'

// Le poids et le tour de taille : une seule carte.
//
// Il y en avait deux, et elles traçaient la même courbe de poids l'une
// au-dessus de l'autre. La tendance du poids n'a d'intérêt qu'à côté de celle
// du tour de taille, de toute façon : seule, la balance ne distingue pas un
// kilo de muscle d'un kilo de gras.
//
// Une échelle verticale par série, chacune calée sur SA propre amplitude. Les
// hauteurs ne sont donc pas comparables — c'est la seule façon de rendre
// lisibles deux centimètres à côté de trois kilos — mais les pentes le sont, et
// ce sont elles qui portent l'information.
//
// La fenêtre est celle du verdict, pas une autre : le graphique montre
// exactement ce que le verdict a lu.
//
// Les deux chiffres sont des BOUTONS : cliquer sur les kilos déplie la saisie
// des pesées, cliquer sur les centimètres celle du tour de taille. Les deux
// formulaires vivaient en cartes séparées sous celle-ci — trois cartes pour un
// seul sujet, dont deux qu'on n'ouvre qu'une fois tous les trois jours. On les
// range là où on les cherche : sous la donnée qu'ils alimentent.

const TONS = {
  bon: 'text-sage-dark',
  neutre: 'text-ink',
  attention: 'text-clay',
} as const

const W = 300
const H = 116

export function RecompositionCard({
  weighins,
  mensurations,
  jours = FENETRE_RECOMPO,
  saisiePoids,
  saisieTaille,
}: {
  weighins: Weighin[]
  mensurations: Mensuration[]
  jours?: number
  /** Dépliée en cliquant sur les kilos. */
  saisiePoids?: ReactNode
  /** Dépliée en cliquant sur les centimètres. */
  saisieTaille?: ReactNode
}) {
  const [ouvert, setOuvert] = useState<'poids' | 'taille' | null>(null)
  const recompo = evaluerRecomposition(weighins, mensurations, jours)

  const limite = new Date()
  limite.setHours(0, 0, 0, 0)
  limite.setDate(limite.getDate() - jours)
  const limiteStr = limite.toLocaleDateString('en-CA')

  const pesees = weighins.filter((w) => w.date >= limiteStr).sort((a, b) => a.date.localeCompare(b.date))
  const tailles = mensurations.filter((m) => m.date >= limiteStr).sort((a, b) => a.date.localeCompare(b.date))

  const lisse = moyenneGlissante(pesees.map((w) => ({ date: w.date, weight_kg: w.weight_kg })), 7)
  const pentePoids = tendancePoids(weighins, jours)
  // La ligne du tour de taille ne se trace que si sa pente est lisible : une
  // ligne plate entre deux points affirmerait « ta taille est stable », qui est
  // précisément ce qu'on refuse de dire sans les mesures pour l'appuyer.
  const pT = penteTaille(mensurations, jours)

  return (
    <section className="card space-y-2.5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">⚖️ Poids et tour de taille</h2>
        <span className="text-[11px] text-muted">
          {pesees.length} pesée{pesees.length > 1 ? 's' : ''} · {jours} j
        </span>
      </div>

      <div className="flex gap-6">
        <Chiffre
          valeur={lisse.length ? `${lisse[lisse.length - 1].value.toFixed(1)} kg` : '—'}
          aide="lissé"
          pente={pentePoids}
          unite="kg"
          couleur="text-copper"
          actif={ouvert === 'poids'}
          onClick={saisiePoids ? () => setOuvert(ouvert === 'poids' ? null : 'poids') : undefined}
        />
        <Chiffre
          valeur={tailles.length ? `${tailles[tailles.length - 1].waist_cm.toFixed(1)} cm` : '—'}
          aide="taille"
          pente={pT}
          unite="cm"
          couleur="text-sage-dark"
          actif={ouvert === 'taille'}
          onClick={saisieTaille ? () => setOuvert(ouvert === 'taille' ? null : 'taille') : undefined}
        />
      </div>

      {ouvert === 'poids' ? saisiePoids : ouvert === 'taille' ? saisieTaille : null}

      {recompo ? (
        <div>
          <div className={`text-sm font-extrabold ${TONS[recompo.ton]}`}>{recompo.titre}</div>
          <p className="text-[11px] leading-snug text-muted">{recompo.explication}</p>
        </div>
      ) : (
        <p className="text-[11px] text-muted">{manqueRecompo(weighins, mensurations, jours)}</p>
      )}

      {pesees.length >= 2 ? (
        <Courbe pesees={pesees} lisse={lisse} tailles={tailles} tracerTaille={pT !== null} jours={jours} />
      ) : null}
    </section>
  )
}

function Chiffre({
  valeur,
  aide,
  pente,
  unite,
  couleur,
  actif = false,
  onClick,
}: {
  valeur: string
  aide: string
  pente: number | null
  unite: string
  couleur: string
  actif?: boolean
  onClick?: () => void
}) {
  const dedans = (
    <>
      <div className={`text-2xl font-extrabold ${couleur}`}>{valeur}</div>
      <div className="text-[11px] text-muted">
        {aide}
        {pente !== null ? (
          <>
            {' · '}
            <b className="text-ink">
              {pente > 0 ? '+' : ''}
              {pente.toFixed(2)} {unite}/sem
            </b>
          </>
        ) : null}
      </div>
    </>
  )
  // Sans saisie à déplier, ce n'est qu'un chiffre : pas de bouton, pas de
  // curseur qui promet une action qui n'existe pas.
  if (!onClick) return <div>{dedans}</div>
  return (
    <button
      onClick={onClick}
      aria-expanded={actif}
      className={`-m-1 rounded-xl2 p-1 text-left transition ${actif ? 'bg-white/5' : 'hover:bg-white/5'}`}
    >
      {dedans}
      <span className="text-[10px] text-copper">{actif ? '▾ fermer' : '▸ saisir'}</span>
    </button>
  )
}

function Courbe({
  pesees,
  lisse,
  tailles,
  tracerTaille,
  jours,
}: {
  pesees: Weighin[]
  lisse: Array<{ date: string; value: number }>
  tailles: Mensuration[]
  tracerTaille: boolean
  jours: number
}) {
  const jour = (d: string) => Date.parse(d + 'T00:00:00') / 86400000
  const fin = jour(new Date().toLocaleDateString('en-CA'))
  const debut = fin - jours
  const px = (d: string) => ((jour(d) - debut) / jours) * (W - 8) + 4

  // Plancher d'amplitude : sans lui, trois pesées à trente grammes d'écart
  // rempliraient toute la hauteur et donneraient à voir une montagne là où il
  // n'y a que du bruit.
  const echelle = (valeurs: number[], plancher: number) => {
    const min = Math.min(...valeurs)
    const max = Math.max(...valeurs)
    const amplitude = Math.max(plancher, max - min)
    return { min, max, py: (v: number) => H - 14 - ((v - min) / amplitude) * (H - 30) }
  }

  const eP = echelle([...lisse.map((p) => p.value), ...pesees.map((w) => w.weight_kg)], 0.8)
  const eT = tailles.length ? echelle(tailles.map((m) => m.waist_cm), 1.5) : null

  const ligne = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Poids et tour de taille">
        {/* Pesées brutes : le bruit quotidien, en fond. */}
        <polyline
          points={ligne(pesees.map((w) => ({ x: px(w.date), y: eP.py(w.weight_kg) })))}
          fill="none"
          stroke="rgb(var(--muted))"
          strokeWidth="1"
          strokeOpacity="0.4"
        />
        <polyline
          points={ligne(lisse.map((p) => ({ x: px(p.date), y: eP.py(p.value) })))}
          fill="none"
          stroke="rgb(var(--copper))"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {eT && tracerTaille ? (
          <polyline
            points={ligne(tailles.map((m) => ({ x: px(m.date), y: eT.py(m.waist_cm) })))}
            fill="none"
            stroke="rgb(var(--sage-dark))"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeDasharray="5 3"
          />
        ) : null}
        {eT
          ? tailles.map((m) => (
              <circle key={m.date} cx={px(m.date)} cy={eT.py(m.waist_cm)} r="2.4" fill="rgb(var(--sage-dark))" />
            ))
          : null}
        <text x="2" y="9" fill="rgb(var(--copper))" fontSize="8">
          {eP.max.toFixed(1)}
        </text>
        <text x="2" y={H - 2} fill="rgb(var(--copper))" fontSize="8">
          {eP.min.toFixed(1)}
        </text>
        {/* Pas de graduation quand toutes les mesures sont identiques : deux
            fois le même nombre se lit comme un bug, et un seul posé au milieu
            tombe en travers de la courbe. Le chiffre est déjà en titre. */}
        {eT && eT.max !== eT.min ? (
          <>
            <text x={W - 2} y="9" fill="rgb(var(--sage-dark))" fontSize="8" textAnchor="end">
              {eT.max.toFixed(1)}
            </text>
            <text x={W - 2} y={H - 2} fill="rgb(var(--sage-dark))" fontSize="8" textAnchor="end">
              {eT.min.toFixed(1)}
            </text>
          </>
        ) : null}
      </svg>

      <div className="flex justify-center gap-3 text-[10px] text-muted">
        <Pastille couleur="rgb(var(--copper))" texte="poids lissé" />
        <Pastille couleur="rgb(var(--muted))" texte="brut" />
        {tailles.length ? (
          // Un rond quand on ne trace pas de ligne : la légende ne doit pas
          // annoncer une courbe qui n'existe pas.
          <Pastille couleur="rgb(var(--sage-dark))" texte="tour de taille" rond={!tracerTaille} />
        ) : null}
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-muted">
        Échelles indépendantes : les hauteurs ne se comparent pas, les <b>pentes</b> si.
      </p>
    </div>
  )
}

function Pastille({ couleur, texte, rond = false }: { couleur: string; texte: string; rond?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={rond ? 'inline-block h-1.5 w-1.5 rounded-full' : 'inline-block h-0.5 w-4 rounded'}
        style={{ background: couleur }}
      />
      {texte}
    </span>
  )
}
