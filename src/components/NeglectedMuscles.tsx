import { EXERCISE_LIBRARY } from '../data/exercises'
import { parseGroupEntries, type GroupLoad } from '../lib/muscu'
import { MUSCLE_LABELS, regionsForGroup, type MuscleRegion } from './MuscleBodyDiagram'

// Le mannequin dit ce qui est FRAIS. Cette carte dit ce qui est OUBLIÉ —
// l'autre moitié de l'information, et celle qui coûte cher en béhourd.
//
// L'ordre de priorité suit ce qui compte réellement en combat en armure, et
// les points faibles connus du profil (épaule AC droite, rotules).

const SEUIL_JOURS = 10

interface Priorite {
  rang: number
  pourquoi: string
  /** Exercice conseillé imposé, quand du matériel perso fait mieux que la salle. */
  exo?: string
}

const PRIORITE_BEHOURD: Partial<Record<MuscleRegion, Priorite>> = {
  neck: { rang: 1, pourquoi: 'encaisse les frappes sous heaume — prévention commotion' },
  forearmFlex: {
    rang: 2,
    pourquoi: 'tient l’arme et le bouclier : souvent le vrai facteur limitant',
    exo: 'Anneau de préhension 40 kg',
  },
  trapsUpper: { rang: 3, pourquoi: 'porte les 33 kg du harnois' },
  erectors: { rang: 4, pourquoi: 'soutient la brigantine et protège les lombaires' },
  obliques: { rang: 5, pourquoi: 'porte les frappes en rotation' },
  gluteMax: { rang: 6, pourquoi: 'puissance de poussée en mêlée' },
  deltPost: { rang: 7, pourquoi: 'contre l’épaule tombante (AC droite)' },
  lats: { rang: 8, pourquoi: 'contrôle de l’adversaire et rappel du bras' },
  vastusMed: { rang: 9, pourquoi: 'stabilise la rotule (dysplasie)' },
  gluteMed: { rang: 10, pourquoi: 'stabilité latérale du genou' },
  vastusLat: { rang: 11, pourquoi: 'déplacement sous charge' },
  soleus: { rang: 12, pourquoi: 'endurance de déplacement en armure' },
  rectus: { rang: 13, pourquoi: 'transmet la force entre haut et bas du corps' },
  forearmExt: { rang: 14, pourquoi: 'équilibre la préhension — prévention épicondylite' },
}

/** Premier exercice de la bibliothèque qui vise ce muscle en moteur principal. */
function exerciceSuggere(region: MuscleRegion): string | null {
  for (const exo of EXERCISE_LIBRARY) {
    for (const g of parseGroupEntries(exo.groups)) {
      if (g.intensity >= 1 && regionsForGroup(g.name).includes(region)) return exo.name
    }
  }
  return null
}

export function NeglectedMuscles({ loads }: { loads: Record<string, GroupLoad> }) {
  // Ancienneté réelle (pas pondérée) du dernier travail de chaque muscle.
  const joursParMuscle: Partial<Record<MuscleRegion, number>> = {}
  for (const [group, load] of Object.entries(loads)) {
    for (const region of regionsForGroup(group)) {
      const cur = joursParMuscle[region]
      if (cur === undefined || load.days < cur) joursParMuscle[region] = load.days
    }
  }

  const negliges = (Object.entries(PRIORITE_BEHOURD) as Array<[MuscleRegion, Priorite]>)
    .map(([region, prio]) => ({ region, prio, jours: joursParMuscle[region] }))
    .filter((m) => m.jours === undefined || m.jours >= SEUIL_JOURS)
    .sort((a, b) => a.prio.rang - b.prio.rang)
    .slice(0, 4)

  if (negliges.length === 0) {
    return (
      <p className="text-center text-[11px] text-muted">
        ✅ Aucun muscle clé du béhourd laissé de côté — tout a été travaillé dans les {SEUIL_JOURS} derniers jours.
      </p>
    )
  }

  return (
    <section className="card space-y-2 p-3">
      <h2 className="text-sm font-bold text-ink">⚔️ Points faibles béhourd</h2>
      <p className="text-[11px] text-muted">
        Muscles importants pour le combat en armure, sans travail depuis au moins {SEUIL_JOURS} jours.
      </p>
      <ul className="space-y-2">
        {negliges.map(({ region, prio, jours }) => {
          const suggestion = prio.exo ?? exerciceSuggere(region)
          return (
            <li key={region} className="rounded-xl2 border border-clay/30 bg-clay/5 p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{MUSCLE_LABELS[region]}</span>
                <span className="shrink-0 text-[11px] font-semibold text-clay">
                  {jours === undefined ? 'jamais' : `il y a ${jours} j`}
                </span>
              </div>
              <p className="text-[11px] text-muted">{prio.pourquoi}</p>
              {suggestion ? (
                <p className="mt-1 text-[11px] text-copper">→ {suggestion}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
