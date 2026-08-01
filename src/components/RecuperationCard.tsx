import { useMemo, useState } from 'react'
import { HORIZONS, chargesProjetees } from '../lib/charges'
import type { Courbatures } from '../lib/soreness'
import type { Nuits } from '../lib/sommeil'
import type { GroupLoad, MuscuSession } from '../lib/muscu'
import type { MuscleRegion } from '../lib/muscles'
import { etatParZone, reposParMuscle } from '../lib/recuperation'
import type { Sexe } from '../lib/morphologie'
import { MuscleBodyDiagram } from './MuscleBodyDiagram'

// Le mannequin de récupération, et l'horloge qu'on peut avancer.
//
// La question à laquelle il répond n'est pas seulement « où j'en suis », c'est
// « quand est-ce que je pourrai retravailler ça ». Y répondre demandait de lire
// un délai muscle par muscle dans les fiches et de les recomposer de tête. Les
// crans +12 h / +1 j / +2 j posent la même image à la date voulue : ce qui aura
// viré au vert d'ici là se voit d'un coup d'œil, sur le corps entier.

export function RecuperationCard({
  sessions,
  courbatures,
  nuits,
  loads,
  sexe,
  onSoreness,
  onPret,
  onExercice,
  onSeance,
}: {
  sessions: MuscuSession[]
  courbatures: Courbatures
  nuits: Nuits
  /** La récup réelle, déjà calculée par la page — l'horizon « Auj. ». */
  loads: Record<string, GroupLoad>
  sexe: Sexe
  onSoreness: (group: string, extra: number, region: MuscleRegion) => void
  onPret: (group: string, pret: boolean, region: MuscleRegion) => void
  onExercice: (name: string) => void
  onSeance: (sessionId: string) => void
}) {
  const [heures, setHeures] = useState(0)
  const horizon = HORIZONS.find((h) => h.heures === heures) ?? HORIZONS[0]
  const projette = heures > 0

  // L'instant représenté. Relu à chaque rendu et NON mémoïsé sur `heures` :
  // gardé en cache, il figeait l'heure du dernier clic, et une page laissée
  // ouverte toute la soirée aurait fini par dater les fiches d'une demi-journée
  // en arrière pendant que le mannequin, lui, avançait.
  const maintenant = Date.now() + heures * 3600000

  // L'horizon « Auj. » réutilise le calcul de la page au lieu de le refaire :
  // c'est la même chose, et deux chemins pour le même état finissent toujours
  // par diverger d'une correction.
  const affiches = useMemo(
    () => (projette ? chargesProjetees(sessions, courbatures, nuits, heures) : loads),
    [projette, sessions, courbatures, nuits, heures, loads],
  )

  // Ce que la projection fait gagner, dit en clair : sans ce compte, il faut
  // comparer deux images de mémoire pour voir ce qui a changé.
  const gagnees = useMemo(() => {
    if (!projette) return []
    const avant = new Set(etatParZone(reposParMuscle(loads)).filter((z) => z.pret).map((z) => z.zone))
    return etatParZone(reposParMuscle(affiches))
      .filter((z) => z.pret && !avant.has(z.zone))
      .map((z) => z.zone)
  }, [projette, loads, affiches])

  return (
    <section className="card space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        {/* « Récupération » et non « Récupération musculaire » : le titre au
            complet poussait les crans à la ligne sur un écran de 375 px, et la
            demande était justement de les avoir SUR cette ligne. Sous un
            mannequin, « musculaire » ne levait aucune ambiguïté. */}
        <h2 className="text-sm font-bold text-ink">🫀 Récupération</h2>
        <div className="flex shrink-0 rounded-xl2 border border-line p-0.5 text-[11px] font-semibold">
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              onClick={() => setHeures(h.heures)}
              aria-pressed={h.heures === heures}
              className={`rounded-[9px] px-2 py-1.5 transition ${
                h.heures === heures ? 'bg-copper text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {h.court}
            </button>
          ))}
        </div>
      </div>

      {projette ? (
        <p className="rounded-xl2 bg-sage/10 px-2.5 py-1.5 text-[11px] leading-snug text-sage-dark">
          <strong>{horizon.phrase}</strong>, si tu ne t'entraînes pas d'ici là.{' '}
          {gagnees.length
            ? `${gagnees.length === 1 ? 'Passe' : 'Passent'} au vert : ${gagnees.join(', ')}.`
            : 'Rien de nouveau ne passe au vert.'}
        </p>
      ) : null}

      <MuscleBodyDiagram
        loads={affiches}
        sessions={sessions}
        sexe={sexe}
        maintenant={maintenant}
        // Pas de déclaration sur un corps projeté : « j'ai des courbatures » se
        // dit du corps d'aujourd'hui, et l'enregistrer depuis l'image d'après-
        // demain l'aurait daté d'aujourd'hui sans le dire. On regarde, ou on
        // déclare — jamais les deux en même temps.
        onSoreness={projette ? undefined : onSoreness}
        onPret={projette ? undefined : onPret}
        onExercice={onExercice}
        onSeance={onSeance}
      />
    </section>
  )
}
