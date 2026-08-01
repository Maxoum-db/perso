import { MUSCLE_LABELS } from '../lib/muscles'
import { TON_STYLE } from '../lib/charge'
import { fmtFamiliarite } from '../lib/familiarite'
import { FormeCard } from './FormeCard'
import type { Forme } from '../lib/forme'
import type { SuggestedSession } from '../lib/sessionBuilder'

// Aperçu de la séance composée automatiquement : on montre POURQUOI chaque
// exercice est là (muscle visé + son état de récupération) avant de la lancer.

function repos(jours: number): string {
  if (jours >= 99) return 'jamais travaillé'
  const j = Math.round(jours)
  return j <= 1 ? 'prêt' : `reposé ${j} j`
}

/** En mode récupération, on annonce l'état de courbature plutôt que le repos. */
function courbature(jours: number): string {
  if (jours >= 99) return 'frais'
  if (jours <= 2) return 'courbaturé'
  if (jours <= 4) return 'sensible'
  return 'frais'
}

export function SuggestedSessionCard({
  suggestion,
  forme,
  onLive,
  onManual,
  onRegenerate,
  onClose,
}: {
  suggestion: SuggestedSession | null
  /** État de forme ayant dicté le volume et les charges de cette séance. */
  forme?: Forme
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
        <span className="min-w-0 truncate text-sm font-bold text-ink">
          {suggestion.recuperation ? '🧊' : '🧠'} {suggestion.name}
        </span>
        <button onClick={onClose} className="shrink-0 text-xs text-copper">
          Fermer
        </button>
      </div>

      <p className="text-[11px] text-muted">
        {suggestion.recuperation
          ? 'Étirements et mobilité ciblés sur ce qui est encore courbaturé — la logique est inversée : on va chercher le chaud.'
          : 'Composée à partir de ta récupération : ces muscles sont reposés, et les plus utiles au béhourd passent devant.'}
      </p>

      {forme ? <FormeCard forme={forme} compact /> : null}

      {suggestion.degrade && !suggestion.recuperation ? (
        <p className="rounded-xl2 border border-clay/30 bg-clay/5 p-2 text-[11px] text-clay">
          ⚠️ Presque tout est encore en récupération. Cette séance reste jouable, mais en léger — ou repose-toi.
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {suggestion.exercises.map((s, i) => (
          <li key={s.exo.id} className="flex items-start gap-2 border-b border-line/40 pb-1.5 last:border-0">
            <span className="w-4 shrink-0 text-xs font-bold text-copper">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">
                {s.exo.name}
                {s.charge.weight !== null ? (
                  <span className="ml-1.5 font-extrabold text-copper">{s.charge.weight} kg</span>
                ) : null}
              </div>
              <div className="text-[11px] text-muted">
                {s.exo.default_sets}×{s.exo.default_reps} ·{' '}
                {s.moteurs.slice(0, 3).map((r) => MUSCLE_LABELS[r].split(' (')[0]).join(', ')}
              </div>
              {/* Pourquoi CET exercice-là : parce qu'il vise le point faible
                  déclaré, parce qu'on progresse dessus, ou parce qu'il a fait son
                  temps et qu'on commence à tourner. Sans ces mots, la rotation
                  ressemblerait à de l'instabilité du générateur. */}
              {!suggestion.recuperation && (s.focus || s.etire || s.familiarite > 0) ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]">
                  {s.focus ? <span className="font-semibold text-copper">🎯 point faible</span> : null}
                  {s.etire ? (
                    <span className="text-sage-dark" title="Charge le muscle en position allongée : plus de croissance par série">
                      🫱 étiré
                    </span>
                  ) : null}
                  {s.familiarite > 0 ? (
                    <span className={s.rotation ? 'font-semibold text-plum' : 'text-muted'}>
                      {s.rotation ? '🔄 ' : '📈 '}
                      {fmtFamiliarite(s.familiarite)}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {s.charge.raison ? (
                <div className={`text-[11px] font-semibold ${TON_STYLE[s.charge.ton].classe}`}>
                  {TON_STYLE[s.charge.ton].icone} {s.charge.raison}
                </div>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                suggestion.recuperation ? 'bg-clay/15 text-clay' : 'bg-sage/15 text-sage-dark'
              }`}
            >
              {suggestion.recuperation ? courbature(s.reposMin) : repos(s.reposMin)}
            </span>
          </li>
        ))}
      </ol>

      {/* Ce que la séance pèse. Sans cette ligne, les budgets de volume et de
          fatigue resteraient invisibles, et une séance courte passerait pour un
          générateur en panne alors qu'elle est au bout de son budget. */}
      {!suggestion.recuperation ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line/40 pt-1.5 text-[10px] text-muted">
          <span>
            <b className="text-ink">{suggestion.bilan.series}</b> séries
          </span>
          <span title="Soulevés, squats et portages coûtent au système nerveux, et ça se cumule">
            charge nerveuse{' '}
            <b className={suggestion.bilan.cout >= suggestion.bilan.budget ? 'text-copper' : 'text-ink'}>
              {suggestion.bilan.cout}/{suggestion.bilan.budget}
            </b>
          </span>
          {suggestion.bilan.poussees + suggestion.bilan.tirages > 0 ? (
            <span title="Au moins autant de tirages que de poussées — pour l’épaule">
              pousser/tirer{' '}
              <b className="text-ink">
                {suggestion.bilan.poussees}:{suggestion.bilan.tirages}
              </b>
            </span>
          ) : null}
        </div>
      ) : null}

      {suggestion.evites.length > 0 ? (
        <p className="text-[11px] text-muted">
          🚫 Écartés (encore en récup) :{' '}
          {suggestion.evites.slice(0, 5).map((r) => MUSCLE_LABELS[r].split(' (')[0]).join(', ')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onLive} className="btn-primary flex-1 py-2 text-sm">
          ▶️ {suggestion.recuperation ? 'Lancer la récup' : 'Démarrer'}
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
