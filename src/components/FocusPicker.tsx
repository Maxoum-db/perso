import { FOCUS, FOCUS_IDS, FOCUS_RECUP, type FocusId } from '../lib/focus'

// Le point faible du moment, et le mode béhourd. Deux réglages distincts et
// cumulables : le premier dit QUEL groupe pousser, le second POUR QUOI on
// s'entraîne. Ils vivent ensemble parce qu'on les règle ensemble.

export function FocusPicker({
  value,
  onChange,
  behourd,
  onBehourd,
}: {
  value: FocusId
  onChange: (id: FocusId) => void
  behourd: boolean
  onBehourd: (on: boolean) => void
}) {
  // En mode récupération, le générateur compose avec des étirements : le béhourd
  // n'y a pas de sens, et laisser la case active la ferait mentir.
  const recup = value === FOCUS_RECUP

  return (
    <section className="card space-y-2 p-3">
      <h2 className="text-sm font-bold text-ink">🎯 Point faible à rattraper</h2>
      <div className="flex flex-wrap gap-1.5">
        {FOCUS_IDS.map((id) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`chip flex items-center gap-1 ${
              id === value ? 'bg-copper/20 text-copper ring-1 ring-copper' : 'bg-bg text-muted'
            }`}
          >
            <span>{FOCUS[id].emoji}</span>
            {FOCUS[id].label}
          </button>
        ))}
      </div>

      <label
        className={`flex items-start gap-2 rounded-xl2 border p-2 transition ${
          recup ? 'border-line/40 opacity-50' : behourd ? 'border-copper/50 bg-copper/10' : 'border-line/60'
        }`}
      >
        <input
          type="checkbox"
          checked={behourd && !recup}
          disabled={recup}
          onChange={(e) => onBehourd(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-ink">⚔️ Spécial béhourd</span>
          <span className="block text-[10px] text-muted">
            {recup
              ? 'Sans effet en mode récupération : la séance est faite d’étirements.'
              : behourd
                ? 'Cou, préhension, trapèzes, érecteurs et ceinture abdominale passent devant, et un tiers de la séance leur est réservé.'
                : 'Ces muscles comptent déjà un peu. Coche pour qu’ils décident vraiment de la séance.'}
          </span>
        </span>
      </label>
    </section>
  )
}
