import { useState } from 'react'
import { SAX_NOTES, saxKey, type Registre } from '../lib/saxophone'
import { SaxophoneDiagram } from '../components/SaxophoneDiagram'

const REGISTRES: Array<{ id: Registre; label: string }> = [
  { id: 'grave', label: 'Grave' },
  { id: 'médium', label: 'Médium' },
  { id: 'aigu', label: 'Aigu' },
]

// Le doigté est le même sur tous les saxophones (alto, ténor, soprano…) : la
// transposition change le son, jamais le mécanisme des clés. Une seule page
// sert donc à tout le monde, sans réglage d'instrument.
export function Saxophone() {
  const [selected, setSelected] = useState(SAX_NOTES[0].id)
  const note = SAX_NOTES.find((n) => n.id === selected) ?? SAX_NOTES[0]

  return (
    <div className="space-y-3">
      <div className="card space-y-1 p-3">
        <h1 className="text-lg font-extrabold text-ink">🎷 Clés du saxophone</h1>
        <p className="text-xs text-muted">
          Touche une note pour voir les clés à presser. Registre standard, du Sib grave au Fa aigu — doigtés
          courants, à recouper avec ta méthode pour les cas particuliers.
        </p>
      </div>

      <div className="card space-y-2 p-3">
        {REGISTRES.map((r) => (
          <div key={r.id} className="space-y-1">
            <div className="text-[11px] font-bold text-muted">{r.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {SAX_NOTES.filter((n) => n.registre === r.id).map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                  aria-pressed={n.id === selected}
                  className={`chip text-xs font-semibold transition ${
                    n.id === selected ? 'bg-copper text-white' : 'bg-white/5 text-muted hover:text-ink'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card space-y-3 p-3">
        <div className="text-center text-sm font-bold text-ink">{note.label}</div>
        <SaxophoneDiagram keys={note.keys} />
        <p className="text-center text-xs text-muted">
          {note.keys.length === 0
            ? 'Aucune clé : le saxophone entièrement ouvert.'
            : note.keys.map((k) => saxKey(k).aide.split(' — ')[0]).join(', ')}
        </p>
      </div>
    </div>
  )
}
