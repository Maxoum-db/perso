import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { SubTabs } from '../components/SubTabs'
import { addWeighin, deleteWeighin, listWeighins, type Weighin } from '../lib/workouts'
import { listSessions, type MuscuSession } from '../lib/muscu'
import { CaloriesCard } from '../components/CaloriesCard'
import { EnergieCard } from '../components/EnergieCard'
import { EntretienCard } from '../components/EntretienCard'
import { RecompositionCard } from '../components/RecompositionCard'
import { TourDeTaille } from '../components/TourDeTaille'
import { ChargeHebdo, ObjectifKcal } from '../components/ChargeEtObjectif'
import { FormeCard } from '../components/FormeCard'
import { evaluerForme } from '../lib/forme'
import { PROFIL_DEFAUT, loadProfil, saveProfil, type Profil } from '../lib/profil'
import { loadMensurations, saveMensurations, type Mensuration } from '../lib/mensurations'
import { OBJECTIF_DEFAUT, loadObjectif, saveObjectif } from '../lib/trainingLoad'

const today = () => new Date().toISOString().slice(0, 10)

type Page = 'energie' | 'corps'

// Onglet « ⚖️ Poids » du module Musculation, en DEUX pages :
//   ⚡ Énergie  — ce que tu dépenses, ce que ça pèse, et à quel rythme
//   ⚖️ Corps    — poids lissé et tour de taille, les deux lectures d'une recomp
//
// Il y en avait trois : « Charge » vivait à part. Or les kilocalories et les
// MET-minutes sont deux lectures du MÊME effort — la charge est littéralement
// calculée à partir du MET des calories depuis qu'on a supprimé sa formule en
// double. Les séparer obligeait à changer d'onglet pour savoir si les 3 274 kcal
// du jour étaient beaucoup ou peu.
//
// L'ordre va du verdict au détail : l'état de forme d'abord, parce que c'est
// lui qui règle le générateur de séances ; le reste explique d'où il sort.
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
          { id: 'energie', label: '⚡ Énergie & charge' },
          { id: 'corps', label: '⚖️ Corps' },
        ]}
        active={page}
        onChange={(id) => setPage(id as Page)}
      />

      {page === 'energie' ? (
        <>
          <FormeCard forme={evaluerForme(sessions, weighins)} />
          <p className="text-center text-[11px] text-muted">
            👆 C'est cet état qui règle le volume et les charges de « 🧠 Composer une séance selon ma récup ».
          </p>
          <EnergieCard sessions={sessions} weighins={weighins} profil={profil} onProfil={majProfil} />
          <CaloriesCard sessions={sessions} bodyWeight={poids} weighins={weighins} />
          <ObjectifKcal sessions={sessions} bodyWeight={poids} weighins={weighins} objectif={objectif} onObjectif={majObjectif} />
          <ChargeHebdo sessions={sessions} />
          <EntretienCard sessions={sessions} weighins={weighins} profil={profil} />
        </>
      ) : (
        <RecompositionCard
          weighins={weighins}
          mensurations={mensurations}
          // Les deux saisies vivent SOUS la donnée qu'elles alimentent, dépliées
          // au clic. Elles étaient deux cartes de plus sous celle-ci, ouvertes
          // en permanence pour un geste qu'on fait tous les trois jours.
          saisiePoids={<SaisiePoids weighins={weighins} onChange={reload} nu />}
          saisieTaille={
            <TourDeTaille
              mensurations={mensurations}
              heightCm={profil.heightCm}
              onChange={majMensurations}
              nu
            />
          }
        />
      )}
    </div>
  )
}

// ── Saisie et historique des pesées ─────────────────────────────────────────

function SaisiePoids({
  weighins,
  onChange,
  nu = false,
}: {
  weighins: Weighin[]
  onChange: () => void
  /** Déplié dans une autre carte : ni cadre, ni titre, ni grand nombre. */
  nu?: boolean
}) {
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

  const Cadre = nu ? 'div' : 'section'
  return (
    <Cadre className={nu ? 'space-y-2 border-t border-line/60 pt-2.5' : 'card p-4'}>
      {nu ? null : <h2 className="mb-2 text-sm font-extrabold text-ink">⚖️ Poids de corps</h2>}

      <div className={nu ? '' : 'mb-3 flex items-end gap-4'}>
        <div>
          {nu ? null : (
            <div className="text-3xl font-extrabold text-ink">{latest ? `${latest.weight_kg} kg` : '—'}</div>
          )}
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

      <p className="mt-2 text-[10px] leading-snug text-muted">
        Le matin à jeun, mêmes conditions. Plusieurs par semaine rendent la moyenne lissée bien plus fiable.
      </p>
    </Cadre>
  )
}

function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
