import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchKv, saveKv, readKvCache } from '../lib/kv'
import { ArmorBodyDiagram, STATE_LABELS, pieceState, type PieceState } from '../components/ArmorBodyDiagram'
import { Section, Stat } from '../components/training-ui'
import { ARMOR_PIECES_TEMPLATE, type ArmorPiece } from '../data/behourd'
import { EntrainementBehourd } from '../components/EntrainementBehourd'
import { chargerOptionsMuscu } from '../lib/acces'
import { loadOptionsEteintes, optionActive, type OptionMuscu } from '../lib/optionsMuscu'

const ARMOR_KEY = 'behourd_armor'
/** Le volet de l'équipement, ouvert ou non. Retenu d'une visite à l'autre. */
const EQUIPEMENT_KEY = 'behourd_equipement_ouvert'

function freshArmor(): ArmorPiece[] {
  return ARMOR_PIECES_TEMPLATE.map((p) => ({ ...p, owned: false, weight_actual_kg: p.typical_weight_kg, notes_user: '' }))
}

// Page Béhourd : l'entraînement d'abord, l'armure ensuite.
//
// L'armure occupait toute la page : une bannière de précommande, quatre
// compteurs, un mannequin et vingt fiches de pièces. C'est un inventaire — on
// le met à jour quand une pièce arrive ou casse, donc quelques fois par an.
// L'entraînement, lui, c'est toutes les semaines, et il n'avait pas d'écran.
//
// Tout l'équipement est donc replié dans UN volet, et ce qui reste est un suivi
// d'entraînement : un chrono, le capteur, les zones qui ont pris. Le volet
// retient s'il était ouvert — replier un inventaire qu'on vient consulter
// chaque fois serait aussi pénible que l'inverse.
export function Behourd() {
  const { user } = useAuth()
  const [armor, setArmor] = useState<ArmorPiece[]>(() => readKvCache<ArmorPiece[]>(ARMOR_KEY, freshArmor()))
  const [loaded, setLoaded] = useState(false)
  const [equipementOuvert, setEquipementOuvert] = useState(() => readKvCache<boolean>(EQUIPEMENT_KEY, false))
  const [cardioActif, setCardioActif] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchKv<ArmorPiece[]>(user.id, ARMOR_KEY, freshArmor()).then((a) => {
      setArmor(a && a.length ? a : freshArmor())
      setLoaded(true)
    })
  }, [user])

  useEffect(() => {
    if (!user || !loaded) return
    saveKv(user.id, ARMOR_KEY, armor)
  }, [armor, user, loaded])

  useEffect(() => {
    if (!user) return
    fetchKv<boolean>(user.id, EQUIPEMENT_KEY, false).then(setEquipementOuvert).catch(() => {})
    // Le capteur suit la même autorisation que dans la musculation : c'est le
    // même brassard et le même réglage, il n'y a pas deux permissions à tenir.
    Promise.all([
      loadOptionsEteintes(user.id).catch(() => [] as OptionMuscu[]),
      chargerOptionsMuscu(user.id, user.email).catch(() => null),
    ])
      .then(([eteintes, autorisees]) => setCardioActif(optionActive('cardio', eteintes, autorisees)))
      .catch(() => {})
  }, [user])

  function basculerEquipement() {
    const next = !equipementOuvert
    setEquipementOuvert(next)
    if (user) saveKv(user.id, EQUIPEMENT_KEY, next)
  }

  const totalWeight = useMemo(() => armor.filter((p) => p.owned).reduce((s, p) => s + (Number(p.weight_actual_kg) || 0), 0), [armor])
  const totalSpent = useMemo(() => armor.filter((p) => p.owned && p.price_usd).reduce((s, p) => s + (Number(p.price_usd) || 0), 0), [armor])
  const totalPreOrder = useMemo(() => armor.filter((p) => p.pre_order && !p.owned).length, [armor])
  const preOrderWeight = useMemo(() => armor.filter((p) => p.pre_order && !p.owned).reduce((s, p) => s + (Number(p.weight_actual_kg) || 0), 0), [armor])
  const ownedCount = armor.filter((p) => p.owned).length
  const toRepair = useMemo(() => armor.filter((p) => pieceState(p) === 'repair'), [armor])

  const update = (idx: number, field: keyof ArmorPiece, value: unknown) =>
    setArmor((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))

  /** Les trois états du mannequin, traduits sur la pièce. */
  const setState = (idx: number, state: PieceState) =>
    setArmor((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, owned: state !== 'missing', needs_repair: state === 'repair' } : p,
      ),
    )

  const addCustom = () =>
    setArmor((prev) => [...prev, { slot: 'Pièce custom', icon: '🛡️', typical_weight_kg: 1, weight_actual_kg: 1, owned: true, must_have: false, notes: '', notes_user: '' }])
  const remove = (idx: number) => setArmor((prev) => prev.filter((_, i) => i !== idx))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🛡️ Béhourd</h1>
        <p className="text-sm text-muted">Entraînement et harnois</p>
      </div>

      <EntrainementBehourd userId={user?.id ?? ''} cardioActif={cardioActif} />

      {/* ── Tout l'équipement, sous un seul volet ──────────────────────────
          Bannière de précommande, compteurs, mannequin, réparations et fiches :
          c'est un inventaire, pas un écran de tous les jours. Replié, la page
          est ce qu'elle doit être la plupart du temps — un suivi
          d'entraînement. */}
      <button
        onClick={basculerEquipement}
        aria-expanded={equipementOuvert}
        className="card flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="inline-block h-3.5 w-1.5 shrink-0 rounded-full bg-clay" />
        <span className="min-w-0 flex-1 text-sm font-extrabold text-ink">🧰 Mon équipement</span>
        <span className="shrink-0 text-xs text-muted">
          {ownedCount}/{armor.length} · {totalWeight.toFixed(1)} kg
          {toRepair.length ? ` · 🔧 ${toRepair.length}` : ''} {equipementOuvert ? '▾' : '▸'}
        </span>
      </button>

      {!equipementOuvert ? null : (
        <>
      {totalPreOrder > 0 ? (
        <div className="rounded-xl2 border-l-[3px] border-sand bg-white/5 p-3 text-xs leading-relaxed text-ink">
          <div className="mb-1 font-extrabold text-ink">
            📦 {totalPreOrder} pièce{totalPreOrder > 1 ? 's' : ''} en cours de fabrication (Pavlo Kozak 🇺🇦)
          </div>
          Livraison prévue : <b>1er novembre 2026</b> · Poids attendu : <b>{preOrderWeight.toFixed(1)} kg</b>.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Poids actuel" value={`${totalWeight.toFixed(1)} kg`} sub={`+${preOrderWeight.toFixed(1)} kg attendus`} color="#ef4444" />
        <Stat label="Pièces OK" value={`${ownedCount - toRepair.length}/${armor.length}`} sub="prêtes à combattre" color="#22c55e" />
        <Stat label="À réparer" value={String(toRepair.length)} sub={toRepair.length ? toRepair.map((p) => p.slot.split(' ')[0]).join(', ') : 'rien à faire'} color="#f59e0b" />
        <Stat label="Investi possédé" value={`$${totalSpent}`} sub="~$6 055 attendu total" color="#a78bfa" />
      </div>

      <div className="rounded-xl2 border border-line bg-white/5 p-3">
        <div className="mb-2 text-sm font-extrabold text-ink">🧍 État de ton harnois</div>
        <ArmorBodyDiagram armorPieces={armor} onSetState={setState} />
      </div>

      {toRepair.length > 0 ? (
        <div className="rounded-xl2 border border-sand/40 bg-sand/5 p-3">
          <div className="mb-1.5 text-sm font-extrabold text-ink">🔧 À réparer avant le prochain combat</div>
          <ul className="space-y-1">
            {toRepair.map((p) => (
              <li key={p.slot} className="text-xs text-ink">
                <span className="mr-1">{p.icon}</span>
                <b>{p.slot}</b>
                {p.repair_notes ? <span className="text-muted"> — {p.repair_notes}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Ouverte d'office : elle est DÉJÀ dans le volet « Mon équipement ».
          Deux pliages l'un dans l'autre obligeaient à deux appuis pour voir
          une liste qu'on venait justement de déplier. */}
      <Section
        title="🛡️ Pièces d'armure"
        subtitle={`${ownedCount}/${armor.length} · ${totalWeight.toFixed(1)} kg`}
        accent="#ef4444"
        defaultOpen
      >
        <p className="mb-3 text-xs italic text-muted">
          Coche l'état de chaque pièce et ajuste son poids réel. Le total sert à dimensionner l'entraînement
          (port du harnois = +30 % d'effort cardiovasculaire).
        </p>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {armor.map((p, idx) => {
            const etat = pieceState(p)
            const bord = etat === 'ok' ? '#10B981' : etat === 'repair' ? '#F59E0B' : 'rgb(var(--line))'
            const fond =
              etat === 'ok' ? 'rgba(16,185,129,.10)' : etat === 'repair' ? 'rgba(245,158,11,.12)' : 'rgba(255,255,255,.04)'
            return (
              <div key={idx} className="rounded-xl2 border p-3 text-ink" style={{ borderColor: bord, background: fond }}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <span className="text-xs font-bold text-ink">{p.slot}</span>
                  {p.must_have ? <span className="rounded-full bg-clay px-1.5 py-0.5 text-[9px] text-white">obligatoire</span> : null}
                  {p.pre_order && !p.owned ? (
                    <span className="rounded-full bg-sand px-1.5 py-0.5 text-[9px] text-white">📦 {p.expected_delivery}</span>
                  ) : null}
                  <button onClick={() => remove(idx)} title="Supprimer" className="ml-auto text-muted hover:text-clay">
                    ✕
                  </button>
                </div>

                <div className="mb-1.5 flex gap-1">
                  {(['missing', 'repair', 'ok'] as PieceState[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => setState(idx, st)}
                      className="flex-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold transition"
                      style={{
                        background:
                          etat === st
                            ? st === 'ok'
                              ? '#10B981'
                              : st === 'repair'
                                ? '#F59E0B'
                                : '#EF4444'
                            : 'rgba(255,255,255,.05)',
                        color: etat === st ? '#fff' : 'rgb(var(--muted))',
                      }}
                    >
                      {STATE_LABELS[st]}
                    </button>
                  ))}
                </div>

                {etat === 'repair' ? (
                  <input
                    type="text"
                    value={p.repair_notes ?? ''}
                    onChange={(e) => update(idx, 'repair_notes', e.target.value)}
                    placeholder="Quoi réparer ? (rivet, sangle, bosse…)"
                    className="mb-1.5 w-full rounded border border-sand/50 bg-bg px-1.5 py-1 text-[11px] text-ink placeholder:text-muted/60"
                  />
                ) : null}

                <div className="mb-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={p.weight_actual_kg ?? 0}
                    onChange={(e) => update(idx, 'weight_actual_kg', Number(e.target.value) || 0)}
                    className="w-16 rounded border border-line bg-bg px-1.5 py-0.5 text-xs text-ink"
                  />
                  <span className="text-[10px] text-muted">kg (typique {p.typical_weight_kg} kg)</span>
                </div>
                <div className="text-[10px] leading-snug text-muted">{p.notes}</div>
                {p.manufacturer ? (
                  <div className="mt-1 text-[10px] font-bold text-muted">
                    🏭 {p.manufacturer}
                    {p.product_code ? ` · code ${p.product_code}` : ''}
                    {p.price_usd ? ` · $${p.price_usd}` : ''}
                  </div>
                ) : null}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] text-copper underline">
                    🔗 Voir la fiche
                  </a>
                ) : null}
                <input
                  type="text"
                  value={p.notes_user ?? ''}
                  onChange={(e) => update(idx, 'notes_user', e.target.value)}
                  placeholder="Notes perso (état, taille…)"
                  className="mt-1.5 w-full rounded border border-line bg-bg px-1.5 py-1 text-[10px] text-ink placeholder:text-muted/60"
                />
              </div>
            )
          })}
        </div>
        <button onClick={addCustom} className="btn bg-clay text-xs text-white">
          + Ajouter une pièce custom
        </button>
      </Section>
        </>
      )}
    </div>
  )
}
