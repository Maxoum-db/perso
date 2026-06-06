import { useState, type ReactNode } from 'react'
import type { CalendarCfg, Exercise } from '../data/behourd'

// Composants d'affichage communs (Béhourd + Musculation), pensés pour le thème
// sombre : texte clair (text-ink / text-muted), couleurs d'accent réservées aux
// bordures, fonds subtils et pastilles — jamais en texte sur fond clair.

export function Section({
  title,
  subtitle,
  accent,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  accent: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl2 border bg-card shadow-soft" style={{ borderColor: accent + '55' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        style={{ background: accent + '20' }}
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <span className="inline-block h-3.5 w-1.5 rounded-full" style={{ background: accent }} />
          {title}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {open ? '▾' : '▸'} {subtitle}
        </span>
      </button>
      {open ? <div className="p-4 text-ink">{children}</div> : null}
    </div>
  )
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl2 bg-white/5 p-2" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-base font-extrabold text-ink">{value}</div>
      <div className="text-[9px] italic text-muted">{sub}</div>
    </div>
  )
}

const TONE_ACCENT: Record<string, string> = {
  amber: '#f59e0b',
  violet: '#8b5cf6',
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
}

export function InfoBox({
  title,
  tone,
  className,
  children,
}: {
  title: string
  tone: keyof typeof TONE_ACCENT
  className?: string
  children: ReactNode
}) {
  const accent = TONE_ACCENT[tone]
  return (
    <div
      className={`rounded-xl2 border bg-white/5 p-3 text-ink ${className ?? ''}`}
      style={{ borderColor: accent + '66', borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="mb-1.5 text-xs font-bold text-ink">{title}</div>
      {children}
    </div>
  )
}

export function BulletGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-1 text-ink">
      <b>{label} :</b>
      <ul className="ml-4 list-disc">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

export function ExerciseTable({
  exercises,
  showRest,
  showMachine,
  show1rm,
}: {
  exercises: Exercise[]
  showRest?: boolean
  showMachine?: boolean
  show1rm?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] text-ink">
        <thead>
          <tr className="border-b border-line text-left font-bold text-muted">
            <th className="px-1.5 py-1">Exercice</th>
            <th className="px-1.5 py-1">Séries</th>
            <th className="px-1.5 py-1">Reps</th>
            {show1rm ? <th className="px-1.5 py-1">% 1RM</th> : null}
            {showRest ? <th className="px-1.5 py-1">Repos</th> : null}
            {showMachine ? <th className="px-1.5 py-1">Machine</th> : null}
            <th className="px-1.5 py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {exercises.map((ex, i) => (
            <tr key={i} className="border-b border-line/50">
              <td className="px-1.5 py-1 font-semibold text-ink">{ex.name}</td>
              <td className="px-1.5 py-1">{ex.sets}</td>
              <td className="px-1.5 py-1">{ex.reps}</td>
              {show1rm ? <td className="px-1.5 py-1">{ex.weight_pct_1rm > 0 ? ex.weight_pct_1rm + '%' : 'PdC'}</td> : null}
              {showRest ? <td className="px-1.5 py-1">{ex.rest_s}s</td> : null}
              {showMachine ? <td className="px-1.5 py-1 text-muted">{ex.machine}</td> : null}
              <td className="px-1.5 py-1 italic text-muted">{ex.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CalendarHelp({ cfg }: { cfg: CalendarCfg }) {
  return (
    <div
      className="rounded-xl2 border bg-white/5 p-3 text-[11px] leading-relaxed text-ink"
      style={{ borderColor: cfg.recommended_color + '66', borderLeftWidth: 3, borderLeftColor: cfg.recommended_color }}
    >
      <div className="mb-1 font-bold text-ink">📅 Calendrier Google dédié : « {cfg.name} »</div>
      <div className="text-muted">{cfg.description}</div>
      <div className="mt-2">
        <b>Comment configurer :</b>
        <ol className="ml-4 list-decimal">
          <li>
            Va sur <b>calendar.google.com</b> → ⚙ → Add other calendars → Create new
          </li>
          <li>
            Nom : <code className="text-ink">{cfg.name}</code>
          </li>
          <li>Couleur recommandée : {cfg.recommended_color}</li>
          <li>Ajoute tes événements (ils apparaîtront aussi dans l'onglet Agenda du Hub)</li>
        </ol>
      </div>
    </div>
  )
}

export function CategoryGrid({ cfg }: { cfg: CalendarCfg }) {
  return (
    <div className="mt-2">
      <div className="mb-1.5 text-xs font-bold text-ink">📋 Catégories d'événements</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cfg.event_categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-2 rounded-xl2 bg-white/5 p-2"
            style={{ borderLeft: `3px solid ${cat.color}` }}
          >
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: cat.color }} />
            <div>
              <div className="text-[11px] font-bold text-ink">{cat.label}</div>
              <div className="text-[9px] text-muted">
                Durée typique : {cat.duration_typ_min} min{cat.default_recurrence ? ` · 🔁 ${cat.default_recurrence}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
