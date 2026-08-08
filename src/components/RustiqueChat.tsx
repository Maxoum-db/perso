import { useState } from 'react'
import { askRustique } from '../lib/rustique'

type Message = { role: 'user' | 'assistant'; content: string }

// Chat du deuxième cerveau — historique en mémoire seulement (pas de
// persistance en v1), une question = un appel à l'assistant Rustique.
export function RustiqueChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const question = input.trim()
    if (!question || sending) return
    setInput('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: question }])
    setSending(true)
    try {
      const res = await askRustique(question)
      if (res.status === 'not_configured') {
        setError("L'assistant n'est pas encore configuré (clé Anthropic manquante côté hub).")
      } else if (res.status === 'error') {
        setError(res.message ?? "L'assistant n'a pas pu répondre.")
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: res.answer }])
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-center text-xs text-muted">
          Pose une question qui croise le hub (apiculture, distillation, BPREA, recettes). 🧠
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m, i) => (
            <li key={i} className={`card p-3 text-sm ${m.role === 'user' ? 'bg-copper/10' : ''}`}>
              <div className="mb-1 text-[10px] font-bold uppercase text-muted">
                {m.role === 'user' ? 'Toi' : '🧠 Rustique'}
              </div>
              <div className="whitespace-pre-wrap text-ink">{m.content}</div>
            </li>
          ))}
        </ul>
      )}

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}
      {sending ? <p className="text-center text-xs text-muted">Rustique réfléchit…</p> : null}

      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Où en sont mes ruches ? Quelles recettes j'ai testées ?…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
        />
        <button onClick={send} disabled={sending || !input.trim()} className="btn-primary shrink-0 px-4 py-2">
          Envoyer
        </button>
      </div>
    </div>
  )
}
