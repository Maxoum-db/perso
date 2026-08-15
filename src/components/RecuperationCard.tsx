import { useMemo, useState } from 'react'
import { HORIZONS, chargesProjetees } from '../lib/charges'
import type { Courbatures } from '../lib/soreness'
import type { Nuits } from '../lib/sommeil'
import type { GroupLoad, MuscuSession } from '../lib/muscu'
import { tronquerZones, type MuscleRegion } from '../lib/muscles'
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
  journal,
  pourLaRecup,
  courbatures,
  nuits,
  loads,
  exclues,
  poidsCorps,
  sexe,
  onSoreness,
  onPret,
  onExercice,
  onSeance,
  bloquees,
  onBlocage,
}: {
  /**
   * Les séances du JOURNAL, pour l'historique affiché dans la fiche d'un
   * muscle — « quelles séances l'ont travaillé ». Cliquables : elles doivent
   * exister dans la liste à l'écran.
   */
  journal: MuscuSession[]
  /**
   * Les séances qui ENTRENT DANS LE CALCUL : décochages appliqués, sorties de
   * course converties comprises. Ce n'est pas la même liste que `journal`, et
   * c'est précisément là qu'était le défaut — la carte projetait à partir du
   * journal brut pendant que l'horizon « Auj. » lisait `loads`, calculé sur
   * celle-ci. Décocher une séance ne changeait donc rien à +12 h, et les
   * sorties de course n'y figuraient pas du tout.
   *
   * Les deux noms sont explicites pour que l'erreur ne se reproduise pas par
   * inattention : `sessions` avait l'air d'être la bonne liste.
   */
  pourLaRecup: MuscuSession[]
  courbatures: Courbatures
  /** Muscles au repos total : peints en noir, exclus des séances proposées. */
  bloquees?: Set<MuscleRegion>
  /** Pose ou lève un blocage. `heures` à 0 le lève. */
  onBlocage?: (region: MuscleRegion, heures: number) => void
  nuits: Nuits
  /** La récup réelle, déjà calculée par la page — l'horizon « Auj. ». */
  loads: Record<string, GroupLoad>
  /**
   * Nombre de séances décochées à la main (cf. `lib/comptage`).
   *
   * Affiché ici et pas seulement au journal : une donnée retirée du calcul doit
   * se voir DEPUIS le calcul. Sans ce bandeau, on décoche une séance pour
   * regarder l'effet, on passe à autre chose, et le mannequin ment en silence
   * pendant des jours sans qu'aucun écran ne le dise.
   */
  exclues: number
  /** Poids de corps, pour que la projection pèse les séries comme la page. */
  poidsCorps: number | null
  sexe: Sexe
  onSoreness: (region: MuscleRegion, extra: number) => void
  onPret: (region: MuscleRegion, pret: boolean) => void
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
    () =>
      projette
        ? chargesProjetees(pourLaRecup, courbatures, nuits, heures, Date.now(), poidsCorps)
        : loads,
    [projette, pourLaRecup, courbatures, nuits, heures, loads, poidsCorps],
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

  // Énumérées jusqu'à un point, puis comptées : une projection à deux jours peut
  // en faire passer une douzaine, et douze noms d'affilée dans un bandeau ne se
  // lisent pas — on retient « ça repart », pas la liste.
  const { visibles, reste } = tronquerZones(gagnees)
  const listeGagnees = visibles.join(', ') + (reste ? ` et ${reste} autre${reste > 1 ? 's' : ''}` : '')

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

      {exclues > 0 ? (
        <p className="rounded-xl2 bg-clay/10 px-2.5 py-1.5 text-[11px] leading-snug text-clay">
          ⚠️ <strong>{exclues} séance{exclues > 1 ? 's' : ''}</strong> décochée{exclues > 1 ? 's' : ''} au journal : ce corps est
          calculé sans elle{exclues > 1 ? 's' : ''}.
        </p>
      ) : null}

      {projette ? (
        <p className="rounded-xl2 bg-sage/10 px-2.5 py-1.5 text-[11px] leading-snug text-sage-dark">
          <strong>{horizon.phrase}</strong>, si tu ne t'entraînes pas d'ici là.{' '}
          {gagnees.length ? `${gagnees.length === 1 ? 'Passe' : 'Passent'} au vert : ${listeGagnees}.` : 'Rien de nouveau ne passe au vert.'}
        </p>
      ) : null}

      <MuscleBodyDiagram
        loads={affiches}
        sessions={journal}
        sexe={sexe}
        maintenant={maintenant}
        // Pas de déclaration sur un corps projeté : « j'ai des courbatures » se
        // dit du corps d'aujourd'hui, et l'enregistrer depuis l'image d'après-
        // demain l'aurait daté d'aujourd'hui sans le dire. On regarde, ou on
        // déclare — jamais les deux en même temps.
        onSoreness={projette ? undefined : onSoreness}
        onPret={projette ? undefined : onPret}
        // Le blocage, lui, se déclare AUSSI depuis un corps projeté : il ne
        // décrit pas l'état d'aujourd'hui mais une consigne datée qui vaut pour
        // les jours à venir, exactement ce que la projection regarde. Le peindre
        // sans pouvoir le poser aurait été une exclusion en lecture seule.
        bloquees={bloquees}
        onBlocage={onBlocage}
        onExercice={onExercice}
        onSeance={onSeance}
      />
    </section>
  )
}
