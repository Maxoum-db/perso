import { Link } from 'react-router-dom'
import { Section, ExerciseTable, InfoBox } from '../components/training-ui'
import { MUSCU_PROGRAM } from '../data/behourd'

// Module dédié Basic Fit — séances Push / Pull / Legs / Core.
const ICON_BY_KEY: Record<string, string> = { push: '💪', pull: '🦾', legs: '🦵', core: '🧱' }

export function Musculation() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">💪 Musculation</h1>
        <p className="text-sm text-muted">Basic Fit · Push / Pull / Legs / Core</p>
      </div>

      <Link to="/carnet" className="btn-ghost inline-flex text-xs">
        📓 Carnet d'entraînement
      </Link>

      <p className="text-xs italic text-muted">
        Split classique 3-4 jours/semaine optimisé pour Basic Fit (équipement standard). Adapté préparation
        béhourd : force + endurance + core.
      </p>

      {Object.entries(MUSCU_PROGRAM).map(([key, prog]) => (
        <Section
          key={key}
          title={`${ICON_BY_KEY[key] ?? '🏋️'} ${prog.label}`}
          subtitle={`${prog.exercises.length} exos · ${prog.duration_min} min`}
          accent={prog.color}
          defaultOpen={key === 'push'}
        >
          <ExerciseTable exercises={prog.exercises} showMachine show1rm />
        </Section>
      ))}

      <InfoBox title="💡 Légende" tone="amber">
        <span className="text-[11px] text-ink">
          PdC = Poids du corps. % 1RM = pourcentage du Repetition Max. Pause : 90s pour la force (6-8 reps),
          60s pour l'hypertrophie (10-12).
        </span>
      </InfoBox>
    </div>
  )
}
