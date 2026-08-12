import { INTENSITES, INTENSITE_IDS, type IntensiteId } from '../lib/intensite'

// L'allure d'UN exercice mesuré en temps ou en distance.
//
// Sur une série chiffrée, la charge dit l'effort. Sur un rameur, un gainage ou
// une marche du fermier, il n'y a rien à comparer : vingt minutes de rameur en
// récupération pesaient exactement autant que vingt minutes à fond.
//
// Même échelle que l'intensité de séance, délibérément — c'est la même question
// posée plus près. Deux échelles pour une seule question auraient fini par ne
// plus vouloir dire la même chose.
//
// Compact : il vit sur la ligne d'exercice, à la place d'un champ de charge qui
// n'a rien à recevoir. Quatre pastilles d'un caractère, et le mot en entier au
// survol — sur un téléphone, une ligne d'exercice n'a pas la place de quatre
// libellés.

export function AllurePicker({
  value,
  onChange,
  compact = false,
}: {
  value: IntensiteId | null | undefined
  onChange: (v: IntensiteId | null) => void
  /** Sur la ligne d'exercice : emoji seul. Ailleurs : emoji + libellé. */
  compact?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {INTENSITE_IDS.map((id) => {
        const it = INTENSITES[id]
        const actif = value === id
        return (
          <button
            key={id}
            // Recliquer sur le palier actif le retire : on revient à l'intensité
            // de la séance, qui reprend la main.
            onClick={() => onChange(actif ? null : id)}
            title={`${it.label} — ${it.aide}`}
            aria-label={it.label}
            aria-pressed={actif}
            className={`rounded-lg px-1.5 py-0.5 text-[11px] font-semibold transition ${
              actif ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
            }`}
          >
            {it.emoji}
            {compact ? '' : ` ${it.label}`}
          </button>
        )
      })}
    </div>
  )
}
