import { useState } from 'react'
import {
  CUMUL_MAX,
  CUMUL_MIN,
  NUIT_REFERENCE,
  dernieresNuits,
  dette,
  effetNuit,
  fmtHeures,
  moyenneNet,
  qualifieNuit,
  poserNuit,
  saveNuits,
  sommeilNet,
  type Nuit,
  type Nuits,
} from '../lib/sommeil'
import { fmtAjust } from '../lib/soreness'

// Onglet Sommeil.
//
// Il vit dans Musculation et pas ailleurs parce que c'est là qu'il sert : le
// mannequin de récupération lit ces nuits. Une nuit courte ou hachée retarde le
// retour au vert, une nuit pleine l'avance un peu.

const today = () => new Date().toLocaleDateString('en-CA')

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Couleur de l'effet : vert quand la nuit aide, argile quand elle coûte. */
function couleurEffet(effet: number): string {
  if (effet > 0.02) return 'rgb(var(--sage-dark))'
  if (effet < -0.02) return 'rgb(var(--clay))'
  return 'rgb(var(--muted))'
}

export function Sommeil({
  userId,
  nuits,
  onChange,
}: {
  userId: string
  nuits: Nuits
  /** Remonte les nuits à la page : le mannequin les relit aussitôt. */
  onChange: (n: Nuits) => void
}) {
  const [date, setDate] = useState(today())
  const existante = nuits[date]
  const [heures, setHeures] = useState(String(existante?.heures ?? 8))
  const [reveils, setReveils] = useState(String(existante?.reveils ?? 0))
  const [minutes, setMinutes] = useState(String(existante?.minutesEveille ?? 0))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Changer de date recharge le formulaire sur la nuit de cette date : sans ça
  // on écrirait les chiffres d'hier sur avant-hier sans s'en apercevoir.
  function changerDate(d: string) {
    setDate(d)
    const n = nuits[d]
    setHeures(String(n?.heures ?? 8))
    setReveils(String(n?.reveils ?? 0))
    setMinutes(String(n?.minutesEveille ?? 0))
  }

  const brouillon: Nuit = {
    heures: Math.max(0, Math.min(16, parseFloat(heures.replace(',', '.')) || 0)),
    reveils: Math.max(0, Math.min(20, parseInt(reveils, 10) || 0)),
    minutesEveille: Math.max(0, Math.min(600, parseInt(minutes, 10) || 0)),
  }
  const net = sommeilNet(brouillon)
  const effet = effetNuit(brouillon)

  // L'écran d'abord, le réseau ensuite — comme les courbatures et les intensités.
  // Attendre l'écriture avant d'afficher faisait perdre la saisie dès que le
  // réseau lâchait, alors que le KV garde de toute façon un cache local.
  function enregistrer(n: Nuit | null) {
    const next = poserNuit(nuits, date, n)
    onChange(next)
    setErr(null)
    if (!userId) return
    setBusy(true)
    saveNuits(userId, next)
      .catch((e) => setErr(`Pas encore synchronisé : ${(e as Error).message}`))
      .finally(() => setBusy(false))
  }

  const liste = dernieresNuits(nuits, 14)
  const moyenne = moyenneNet(nuits, 7)
  const detteSemaine = dette(nuits, 7)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink">😴 Sommeil</h2>
        <p className="text-sm text-muted">
          Le muscle se répare la nuit. Ce que tu notes ici décale le mannequin de récupération.
        </p>
      </div>

      {/* ── Saisie ───────────────────────────────────────────────────────── */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="field max-w-[60%]"
            value={date}
            max={today()}
            onChange={(e) => changerDate(e.target.value)}
          />
          <span className="text-[11px] text-muted">matin du réveil</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Champ label="Au lit" unite="h" value={heures} onChange={setHeures} step="0.5" />
          <Champ label="Réveils" unite="fois" value={reveils} onChange={setReveils} step="1" />
          <Champ label="Éveillé" unite="min" value={minutes} onChange={setMinutes} step="5" />
        </div>

        {/* Le calcul, à découvert : on voit ce que la saisie produit avant
            d'enregistrer, et pourquoi. */}
        <div className="rounded-xl2 border border-line/60 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-ink">
              {fmtHeures(net)} dormi
              {brouillon.minutesEveille > 0 ? (
                <span className="font-normal text-muted"> ({fmtHeures(brouillon.heures)} au lit)</span>
              ) : null}
            </span>
            <span className="shrink-0 text-sm font-bold" style={{ color: couleurEffet(effet) }}>
              {effet === 0 ? 'neutre' : fmtAjust(effet)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {qualifieNuit(brouillon)} · référence {NUIT_REFERENCE} h
            {brouillon.reveils > 0
              ? ` · ${brouillon.reveils} réveil${brouillon.reveils > 1 ? 's' : ''} comptent en plus du temps perdu`
              : ''}
          </div>
        </div>

        {err ? <div className="rounded-xl2 bg-clay/10 p-2 text-xs text-clay">{err}</div> : null}

        <div className="flex items-center gap-2">
          <button onClick={() => enregistrer(brouillon)} disabled={busy} className="btn-primary flex-1">
            {busy ? '…' : existante ? 'Mettre à jour' : 'Enregistrer'}
          </button>
          {existante ? (
            <button onClick={() => enregistrer(null)} disabled={busy} className="btn border border-clay/50 text-clay">
              Supprimer
            </button>
          ) : null}
        </div>
      </div>

      {/* ── La semaine ───────────────────────────────────────────────────── */}
      {moyenne !== null ? (
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">7 derniers jours</div>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <div className="text-2xl font-extrabold text-ink">{fmtHeures(moyenne)}</div>
              <div className="text-[11px] text-muted">par nuit renseignée</div>
            </div>
            <div>
              <div
                className="text-2xl font-extrabold"
                style={{ color: detteSemaine > 0.5 ? 'rgb(var(--clay))' : 'rgb(var(--sage-dark))' }}
              >
                {detteSemaine > 0 ? '−' : '+'}
                {fmtHeures(Math.abs(detteSemaine))}
              </div>
              <div className="text-[11px] text-muted">{detteSemaine > 0 ? 'de dette' : 'd’avance'}</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            L’effet cumulé sur un muscle est borné à {fmtAjust(CUMUL_MIN)} / {fmtAjust(CUMUL_MAX)} : une mauvaise
            semaine retarde la récupération, elle ne la bloque pas indéfiniment.
          </p>
        </div>
      ) : null}

      {/* ── Historique ───────────────────────────────────────────────────── */}
      {liste.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Aucune nuit notée. Renseigne celle de cette nuit : le mannequin en tiendra compte dès maintenant. 😴
        </div>
      ) : (
        <ul className="space-y-2">
          {liste.map(([d, n]) => {
            const e = effetNuit(n)
            return (
              <li key={d}>
                <button
                  onClick={() => changerDate(d)}
                  className={`card flex w-full items-center gap-3 p-3 text-left transition hover:shadow-lift ${
                    d === date ? 'border-copper/50' : ''
                  }`}
                >
                  <span className="w-24 shrink-0 text-xs font-semibold text-copper">{frDate(d)}</span>
                  <span className="shrink-0 text-sm font-bold text-ink">{fmtHeures(sommeilNet(n))}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {qualifieNuit(n)}
                    {n.reveils > 0 ? ` · ${n.reveils}×` : ''}
                  </span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: couleurEffet(e) }}>
                    {e === 0 ? '—' : fmtAjust(e)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Champ({
  label,
  unite,
  value,
  onChange,
  step,
}: {
  label: string
  unite: string
  value: string
  onChange: (v: string) => void
  step: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted">
        {label} <span className="font-normal">({unite})</span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min="0"
        className="field text-center"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
