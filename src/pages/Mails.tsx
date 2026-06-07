import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  GoogleAuthError,
  createTask,
  hasFreshGoogleToken,
  listRecentEmails,
  listTaskLists,
  type GMessage,
} from '../lib/google'
import { createNote } from '../lib/notes'
import { ReconnectGoogle } from '../components/ReconnectGoogle'

// Filtres intelligents : ce sont des requêtes Gmail (gratuit, aucune IA).
const FILTERS = [
  { id: 'in:inbox', label: '📥 Boîte' },
  { id: 'is:unread category:primary', label: '✉️ À répondre' },
  {
    id:
      '(subject:(commande OR livraison OR colis OR suivi OR "expédié" OR order OR shipped OR delivery OR tracking OR facture) ' +
      'OR from:(amazon OR colissimo OR chronopost OR dhl OR ups OR mondialrelay OR fedex)) newer_than:90d',
    label: '📦 Commandes',
  },
  { id: 'is:important', label: '⭐ Importants' },
  { id: 'category:promotions', label: '📣 Promos' },
]

// Détection côté app (règles) du type d'un mail, pour afficher un badge.
const ORDER_RE =
  /(commande|livraison|colis|exp[ée]di[ée]|tracking|num[ée]ro de suivi|suivi de (commande|colis)|order (confirmation|shipped|placed)|shipped|out for delivery|delivery|facture|invoice)/i
const REPLY_RE =
  /(\?|peux-tu|pouvez-vous|peux tu|merci de bien vouloir|relance|en attente de|waiting for|please reply|rsvp|réponds|réponse attendue)/i
const PROMO_RE = /(unsubscribe|se désinscrire|désabonner|promo|soldes|-\d+\s?%|offre|newsletter|deal)/i

type MailType = 'order' | 'reply' | 'promo' | null
function classify(m: GMessage): MailType {
  const hay = `${m.subject} ${m.snippet} ${m.from}`
  if (ORDER_RE.test(hay)) return 'order'
  if (m.unread && REPLY_RE.test(hay)) return 'reply'
  if (PROMO_RE.test(hay)) return 'promo'
  return null
}

const BADGE: Record<Exclude<MailType, null>, { label: string; cls: string }> = {
  order: { label: '📦 Commande', cls: 'bg-copper/20 text-copper' },
  reply: { label: '✉️ À répondre', cls: 'bg-sand/20 text-sand' },
  promo: { label: '📣 Promo', cls: 'bg-muted/15 text-muted' },
}

// Détecte une date FR/num (jj/mm[/aaaa] ou "le 12 juin") pour en faire une échéance.
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
function detectDueDate(text: string): string | undefined {
  const t = text.toLowerCase()
  let y: number | undefined
  let mo: number | undefined
  let d: number | undefined
  const num = t.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/)
  if (num) {
    d = +num[1]
    mo = +num[2]
    y = num[3] ? (num[3].length === 2 ? 2000 + +num[3] : +num[3]) : undefined
  } else {
    const fr = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_FR.join('|')})`, 'i'))
    if (fr) {
      d = +fr[1]
      mo = MONTHS_FR.indexOf(fr[2].toLowerCase()) + 1
    }
  }
  if (!d || !mo || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  const now = new Date()
  if (!y) {
    // année implicite : si la date est déjà bien passée, on prend l'an prochain.
    y = now.getFullYear()
    const candidate = new Date(y, mo - 1, d)
    if (candidate.getTime() < now.getTime() - 7 * 86400000) y += 1
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(mo)}-${pad(d)}T00:00:00.000Z`
}

export function Mails() {
  const { user } = useAuth()
  const [needAuth, setNeedAuth] = useState(!hasFreshGoogleToken())
  const [filter, setFilter] = useState('in:inbox')
  const [mails, setMails] = useState<GMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!hasFreshGoogleToken()) {
      setNeedAuth(true)
      return
    }
    setMails(null)
    setError(null)
    listRecentEmails(filter, 20)
      .then(setMails)
      .catch((e) => (e instanceof GoogleAuthError ? setNeedAuth(true) : setError((e as Error).message)))
  }, [filter])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function toNote(m: GMessage) {
    if (!user) return
    try {
      await createNote(user.id, {
        title: m.subject,
        body: `📧 De : ${m.from}\n\n${m.snippet}`,
        category: 'autre',
        pinned: false,
      })
      flash('Note créée ✓')
    } catch (e) {
      flash('Erreur : ' + (e as Error).message)
    }
  }

  async function makeTask(title: string, due?: string) {
    const lists = await listTaskLists()
    const listId = lists[0]?.id
    if (!listId) {
      flash('Aucune liste de tâches')
      return
    }
    await createTask(listId, title, due)
  }

  async function toTask(m: GMessage) {
    try {
      await makeTask(m.subject)
      flash('Tâche créée ✓')
    } catch (e) {
      flash('Erreur : ' + (e as Error).message)
    }
  }

  async function trackOrder(m: GMessage) {
    try {
      const due = detectDueDate(`${m.subject} ${m.snippet}`)
      await makeTask(`📦 ${m.from} — ${m.subject}`, due)
      flash(due ? 'Tâche créée avec échéance ✓' : 'Tâche de suivi créée ✓')
    } catch (e) {
      flash('Erreur : ' + (e as Error).message)
    }
  }

  if (needAuth) return <ReconnectGoogle />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">📧 Mails</h1>
        <p className="text-sm text-muted">Tri intelligent + suivi des commandes en un geste.</p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="chip shrink-0 border transition"
            style={{
              borderColor: filter === f.id ? 'rgb(var(--copper))' : 'rgb(var(--line))',
              background: filter === f.id ? 'rgb(var(--copper) / .25)' : 'transparent',
              color: 'rgb(var(--ink))',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="card whitespace-pre-line break-words border-clay/40 bg-clay/5 p-3 text-sm text-clay">
          {error}
        </div>
      ) : null}
      {mails === null && !error ? <div className="animate-pulse text-sm text-muted">Chargement…</div> : null}
      {mails && mails.length === 0 ? <div className="card p-6 text-center text-sm text-muted">Aucun mail. 📭</div> : null}

      <ul className="space-y-2">
        {(mails || []).map((m) => {
          const type = classify(m)
          return (
            <li key={m.id} className="card p-3">
              <div className="flex items-baseline gap-2">
                {m.unread ? <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-copper" /> : null}
                <span className={`truncate text-xs ${m.unread ? 'font-bold text-ink' : 'text-muted'}`}>{m.from}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted">{shortDate(m.date)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                {type ? <span className={`chip shrink-0 ${BADGE[type].cls}`}>{BADGE[type].label}</span> : null}
                <span className={`truncate text-sm ${m.unread ? 'font-bold text-ink' : 'text-ink'}`}>{m.subject}</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-muted">{m.snippet}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={`https://mail.google.com/mail/u/0/#all/${m.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost px-2.5 py-1 text-xs"
                >
                  Ouvrir
                </a>
                {type === 'order' ? (
                  <button onClick={() => trackOrder(m)} className="btn-ghost px-2.5 py-1 text-xs text-copper">
                    📦 Suivre
                  </button>
                ) : null}
                <button onClick={() => toNote(m)} className="btn-ghost px-2.5 py-1 text-xs">
                  📝 Note
                </button>
                <button onClick={() => toTask(m)} className="btn-ghost px-2.5 py-1 text-xs">
                  ✅ Tâche
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bg shadow-lift">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function shortDate(d?: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
