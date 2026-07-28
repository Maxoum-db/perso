import { MUSCLE_LABELS } from './MuscleBodyDiagram'
import type { SuggestedSession } from '../lib/sessionBuilder'

// Aperçu de la séance composée automatiquement : on montre POURQUOI chaque
// exercice est là (muscle visé + son état de récupération) avant de la lancer.

function repos(jours: number): string {
  if (jours >= 99) return 'jamais travaillé'
  const j = Math.round(jours)
  return j <= 1 ? 'prêt' : `reposé ${j} j`
}

export function SuggestedSessionCard({
  suggestion,
  onLive,
  onManual,
  onRegenerate,
  onClose,
}: {
  suggestion: SuggestedSession | null
  onLive: () => void
  onManual: () => void
  onRegenerate: () => void
  onClose: () => void
}) {
  if (!suggestion) {
    return (
      <div className="card space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">🧠 Séance adaptée</span>
          <button onClick={onClose} className="text-xs text-copper">
            Fermer
          </button>
        </div>
        <p className="text-[11px] text-muted">
          Pas encore assez d'exercices exploitables au catalogue pour composer une séance. Enregistre une séance
          ou deux, ou ajoute des exercices avec leur groupe visé.
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-bold text-ink">🧠 {suggestion.name}</span>
        <button onClick={onClose} className="shrink-0 text-xs text-copper">
          Fermer
        </button>
      </div>

      <p className="text-[11px] text-muted">
        Composée à partir de ta récupération : ces muscles sont reposés, et les plus utiles au béhourd passent
        devant.
      </p>

      {suggestion.degrade ? (
        <p className="rounded-xl2 border border-clay/30 bg-clay/5 p-2 text-[11px] text-clay">
          ⚠️ Presque tout est encore en récupération. Cette séance reste jouable, mais en léger — ou repose-toi.
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {suggestion.exercises.map((s, i) => (
          <li key={s.exo.id} className="flex items-start gap-2 border-b border-line/40 pb-1.5 last:border-0">
            <span className="w-4 shrink-0 text-xs font-bold text-copper">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{s.exo.name}</div>
              <div className="text-[11px] text-muted">
                {s.exo.default_sets}×{s.exo.default_reps} ·{' '}
                {s.moteurs.slice(0, 3).map((r) => MUSCLE_LABELS[r].split(' (')[0]).join(', ')}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold text-sage-dark">
              {repos(s.reposMin)}
            </span>
          </li>
        ))}
      </ol>

      {suggestion.evites.length > 0 ? (
        <p className="text-[11px] text-muted">
          🚫 Écartés (encore en récup) :{' '}
          {suggestion.evites.slice(0, 5).map((r) => MUSCLE_LABELS[r].split(' (')[0]).join(', ')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onLive} className="btn-primary flex-1 py-2 text-sm">
          ▶️ Démarrer
        </button>
        <button onClick={onManual} className="btn-ghost px-3 py-2 text-sm">
          ✍️ Éditer
        </button>
        <button onClick={onRegenerate} className="btn-ghost px-3 py-2 text-sm" title="Autre proposition">
          🔄
        </button>
      </div>
    </div>
  )
}
