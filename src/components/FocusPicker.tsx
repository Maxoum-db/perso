import { FOCUS, FOCUS_IDS, type FocusId } from '../lib/focus'

// Le point faible du moment. Il pèse sur le générateur de séance et rend
// l'alerte des muscles négligés plus impatiente sur ces muscles-là.

export function FocusPicker({ value, onChange }: { value: FocusId; onChange: (id: FocusId) => void }) {
  const actif = FOCUS[value]
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
      <p className="text-[11px] leading-relaxed text-muted">{actif.conseil}</p>
    </section>
  )
}
