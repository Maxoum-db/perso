type SubTab = { id: string; label: string }

/** Petite barre d'onglets internes pour regrouper plusieurs outils dans une même page. */
export function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTab[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl2 border border-line bg-card p-1 text-sm font-semibold">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 whitespace-nowrap rounded-[10px] px-3 py-1.5 transition ${
            active === t.id ? 'bg-copper text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
