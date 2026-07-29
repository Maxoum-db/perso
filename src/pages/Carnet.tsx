import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { SubTabs } from '../components/SubTabs'
import { addWeighin, deleteWeighin, listWeighins, type Weighin } from '../lib/workouts'
import { listSessions, type MuscuSession } from '../lib/muscu'
import { CaloriesCard } from '../components/CaloriesCard'
import { EnergieCard } from '../components/EnergieCard'
import { PoidsCourbe } from '../components/PoidsCourbe'
import { TourDeTaille } from '../components/TourDeTaille'
import { ChargeHebdo, ObjectifKcal } from '../components/ChargeEtObjectif'
import { PROFIL_DEFAUT, loadProfil, saveProfil, type Profil } from '../lib/profil'
import { loadMensurations, saveMensurations, type Mensuration } from '../lib/mensurations'
import { OBJECTIF_DEFAUT, loadObjectif, saveObjectif } from '../lib/trainingLoad'

const today = () => new Date().toISOString().slice(0, 10)

type Page = 'energie' | 'corps' | 'charge'

// Onglet « ⚖️ Poids » du module Musculation, en trois pages :
//   ⚡ Énergie  — ce que tu dépenses, et ce que ta courbe dit de ton apport
//   ⚖️ Corps    — poids lissé et tour de taille, les deux lectures d'une recomp
//   📊 Charge   — rythme d'entraînement et objectif de la semaine
export function Poids() {
  const { user } = useAuth()
  const [page, setPage] = useState<Page>('energie')
  const [weighins, setWeighins] = useState<Weighin[]>([])
  const [sessions, setSessions] = useState<MuscuSession[]>([])
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  const [mensurations, setMensurations] = useState<Mensuration[]>([])
  const [objectif, setObjectif] = useState(OBJECTIF_DEFAUT)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!user) return
    try {
      const [w, s, p, m, o] = await Promise.all([
        listWeighins(user.id),
        listSessions(user.id, 80).catch(() => []),
        loadProfil(user.id).catch(() => PROFIL_DEFAUT),
        loadMensurations(user.id).catch(() => []),
        loadObjectif(user.id).catch(() => OBJECTIF_DEFAUT),
      ])
      setWeighins(w)
      setSessions(s)
      setProfil(p)
      setMensurations(m)
      setObjectif(o)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const poids = weighins[0]?.weight_kg ?? null

  function majProfil(p: Profil) {
    setProfil(p)
    if (user) saveProfil(user.id, p).catch(() => {})
  }
  function majMensurations(m: Mensuration[]) {
    setMensurations(m)
    if (user) saveMensurations(user.id, m).catch(() => {})
  }
  function majObjectif(v: number) {
    setObjectif(v)
    if (user) saveObjectif(user.id, v).catch(() => {})
  }

  return (
    <div className="space-y-3">
      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <SubTabs
        tabs={[
          { id: 'energie', label: '⚡ Énergie' },
          { id: 'corps', label: '⚖️ Corps' },
          { id: 'charge', label: '📊 Charge' },
        ]}
        active={page}
        onChange={(id) => setPage(id as Page)}
      />

      {page === 'energie' ? (
        <>
          <EnergieCard sessions={sessions} weighins={weighins} profil={profil} onProfil={majProfil} />
          <CaloriesCard sessions={sessions} bodyWeight={poids} />
        </>
      ) : page === 'corps' ? (
        <>
          <PoidsCourbe weighins={weighins} />
          <SaisiePoids weighins={weighins} onChange={reload} />
          <TourDeTaille mensurations={mensurations} heightCm={profil.heightCm} onChange={majMensurations} />
          <p className="text-center text-[11px] text-muted">
            💡 À poids stable, un tour de taille qui baisse = du gras échangé contre du muscle. C'est exactement
            l'objectif.
          </p>
        </>
      ) : (
        <>
          <ChargeHebdo sessions={sessions} />
          <ObjectifKcal sessions={sessions} bodyWeight={poids} objectif={objectif} onObjectif={majObjectif} />
        </>
      )}
    </div>
  )
}

// ── Saisie et historique des pesées ─────────────────────────────────────────

function SaisiePoids({ weighins, onChange }: { weighins: Weighin[]; onChange: () => void }) {
  const { user } = useAuth()
  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)

  const latest = weighins[0]
  const delta = useMemo(
    () => (weighins.length >= 2 ? weighins[0].weight_kg - weighins[1].weight_kg : null),
    [weighins],
  )

  async function add() {
    const w = parseFloat(weight.replace(',', '.'))
    if (!user || !Number.isFinite(w)) return
    setBusy(true)
    try {
      await addWeighin(user.id, { date, weight_kg: w })
      setWeight('')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-extrabold text-ink">⚖️ Poids de corps</h2>

      <div className="mb-3 flex items-end gap-4">
        <div>
          <div className="text-3xl font-extrabold text-ink">{latest ? `${latest.weight_kg} kg` : '—'}</div>
          {delta !== null ? (
            <div className={`text-xs font-semibold ${delta <= 0 ? 'text-sage-dark' : 'text-clay'}`}>
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} kg vs précédent
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className="field"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <button onClick={add} disabled={busy} className="btn-primary shrink-0 px-4 py-2">
          +
        </button>
      </div>

      {weighins.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {weighins.slice(0, 8).map((w) => (
            <li key={w.id} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-muted">{frDate(w.date)}</span>
              <span className="font-semibold text-ink">{w.weight_kg} kg</span>
              <button onClick={() => deleteWeighin(w.id).then(onChange)} className="ml-auto text-muted hover:text-clay">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[10px] text-muted">
        Le matin à jeun, mêmes conditions à chaque fois. Plusieurs pesées par semaine rendent la moyenne lissée
        beaucoup plus fiable.
      </p>
    </section>
  )
}

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
