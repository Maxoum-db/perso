import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchKv, saveKv, readKvCache } from '../lib/kv'
import { ArmorBodyDiagram } from '../components/ArmorBodyDiagram'
import {
  Section,
  Stat,
  InfoBox,
  BulletGroup,
  ExerciseTable,
  CalendarHelp,
  CategoryGrid,
} from '../components/training-ui'
import {
  ARMOR_PIECES_TEMPLATE,
  BEHOURD_CALENDAR_CFG,
  BEHOURD_TRAINING,
  PERSO_CALENDAR_CFG,
  TANK_BEHOURD_PROGRAM,
  type ArmorPiece,
} from '../data/behourd'

const ARMOR_KEY = 'behourd_armor'

function freshArmor(): ArmorPiece[] {
  return ARMOR_PIECES_TEMPLATE.map((p) => ({ ...p, owned: false, weight_actual_kg: p.typical_weight_kg, notes_user: '' }))
}

export function Behourd() {
  const { user } = useAuth()
  const [armor, setArmor] = useState<ArmorPiece[]>(() => readKvCache<ArmorPiece[]>(ARMOR_KEY, freshArmor()))
  const [loaded, setLoaded] = useState(false)

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

  const totalWeight = useMemo(() => armor.filter((p) => p.owned).reduce((s, p) => s + (Number(p.weight_actual_kg) || 0), 0), [armor])
  const totalSpent = useMemo(() => armor.filter((p) => p.owned && p.price_usd).reduce((s, p) => s + (Number(p.price_usd) || 0), 0), [armor])
  const totalToBuy = useMemo(() => armor.filter((p) => !p.owned && !p.pre_order && p.must_have).length, [armor])
  const totalPreOrder = useMemo(() => armor.filter((p) => p.pre_order && !p.owned).length, [armor])
  const preOrderWeight = useMemo(() => armor.filter((p) => p.pre_order && !p.owned).reduce((s, p) => s + (Number(p.weight_actual_kg) || 0), 0), [armor])
  const ownedCount = armor.filter((p) => p.owned).length

  const update = (idx: number, field: keyof ArmorPiece, value: unknown) =>
    setArmor((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  const addCustom = () =>
    setArmor((prev) => [...prev, { slot: 'Pièce custom', icon: '🛡️', typical_weight_kg: 1, weight_actual_kg: 1, owned: true, must_have: false, notes: '', notes_user: '' }])
  const remove = (idx: number) => setArmor((prev) => prev.filter((_, i) => i !== idx))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🛡️ Béhourd</h1>
        <p className="text-sm text-muted">Armure · Entraînement TANK · Calendriers dédiés</p>
      </div>

      {/* ───────── Armure ───────── */}
      <Section title="🛡️ Armure & entraînement" subtitle={`${ownedCount} pièce(s) · ${totalWeight.toFixed(1)} kg`} accent="#ef4444" defaultOpen>
        <p className="mb-3 text-xs italic text-muted">
          Coche les pièces que tu possèdes et ajuste leur poids réel. Le total t'aide à dimensionner ton
          entraînement (port harnois = +30 % d'effort cardiovasculaire).
        </p>

        {totalPreOrder > 0 ? (
          <div className="mb-3 rounded-xl2 border-l-[3px] border-sand bg-white/5 p-3 text-xs leading-relaxed text-ink">
            <div className="mb-1 font-extrabold text-ink">
              📦 {totalPreOrder} pièce{totalPreOrder > 1 ? 's' : ''} en cours de fabrication (Pavlo Kozak 🇺🇦)
            </div>
            Livraison prévue : <b>1er novembre 2026</b> · Poids attendu : <b>{preOrderWeight.toFixed(1)} kg</b>.<br />
            D'ici là : travailler la <b>condition physique + technique sec</b> (sans armure) au club + à la muscu.
          </div>
        ) : null}

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Poids actuel" value={`${totalWeight.toFixed(1)} kg`} sub={`+${preOrderWeight.toFixed(1)} kg attendus`} color="#ef4444" />
          <Stat label="Investi possédé" value={`$${totalSpent}`} sub="~$6 055 attendu total" color="#22c55e" />
          <Stat label="À acheter" value={String(totalToBuy)} sub="hache + bocle" color="#f59e0b" />
          <Stat label="Fournisseur" value="Pavlo Kozak 🇺🇦" sub="acier 30 HGSA" color="#a78bfa" />
        </div>

        <div className="mb-4 rounded-xl2 border border-line bg-white/5 p-3">
          <div className="mb-2 text-sm font-extrabold text-ink">🧍 Vue corporelle de ton équipement</div>
          <ArmorBodyDiagram armorPieces={armor} />
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {armor.map((p, idx) => (
            <div
              key={idx}
              className="rounded-xl2 border p-3 text-ink"
              style={{
                borderColor: p.owned ? '#ef4444' : p.pre_order ? '#f59e0b' : 'rgb(var(--line))',
                background: p.owned ? 'rgba(239,68,68,.12)' : p.pre_order ? 'rgba(245,158,11,.12)' : 'rgba(255,255,255,.04)',
              }}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <input type="checkbox" checked={!!p.owned} onChange={(e) => update(idx, 'owned', e.target.checked)} />
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
          ))}
        </div>
        <button onClick={addCustom} className="btn bg-clay text-xs text-white">
          + Ajouter une pièce custom
        </button>

        <InfoBox title="📋 Entraînement spécifique Béhourd" tone="amber" className="mt-4">
          <BulletGroup label="Préparation physique" items={BEHOURD_TRAINING.physical_focus} />
          <BulletGroup label="Drills techniques" items={BEHOURD_TRAINING.specific_drills} />
          <BulletGroup label="Prévention blessures" items={BEHOURD_TRAINING.injury_prevention} />
        </InfoBox>

        <InfoBox title="📅 Template hebdo (béhourd + muscu)" tone="violet" className="mt-3">
          <table className="w-full text-xs text-ink">
            <tbody>
              {Object.entries(BEHOURD_TRAINING.weekly_template).map(([day, plan]) => (
                <tr key={day} className="border-b border-line/50">
                  <td className="w-24 py-1 pr-2 font-bold">{day}</td>
                  <td className="py-1">{plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InfoBox>
      </Section>

      {/* ───────── Programme TANK ───────── */}
      <Section title="⚔️ Programme TANK Béhourd" subtitle="100 kg / 180 cm · body recomp + force" accent="#f87171">
        <p className="mb-3 rounded-xl2 bg-white/5 p-2 text-xs italic text-muted">{TANK_BEHOURD_PROGRAM.description}</p>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <InfoBox title="📊 Ton profil" tone="violet">
            <div className="text-xs leading-relaxed text-ink">
              Poids : <b>{TANK_BEHOURD_PROGRAM.user_profile.poids_kg} kg</b> · Taille :{' '}
              <b>{TANK_BEHOURD_PROGRAM.user_profile.taille_cm} cm</b>
              <br />
              IMC : <b>{TANK_BEHOURD_PROGRAM.user_profile.IMC}</b> — {TANK_BEHOURD_PROGRAM.user_profile.classification}
              <br />
              Objectif : <b>{TANK_BEHOURD_PROGRAM.user_profile.objectif}</b>
              <br />
              Durée : <b>{TANK_BEHOURD_PROGRAM.user_profile.duree_programme}</b>
            </div>
          </InfoBox>
          <InfoBox title="📅 Split hebdomadaire" tone="green">
            <table className="w-full text-[11px] text-ink">
              <tbody>
                {Object.entries(TANK_BEHOURD_PROGRAM.weekly_split).map(([day, info]) => (
                  <tr key={day} className="border-b border-line/50">
                    <td className="w-28 py-0.5 pr-1 font-bold">{day}</td>
                    <td className="py-0.5">{info.type}</td>
                    <td className="w-12 py-0.5 text-right text-muted">{info.duration_min > 0 ? info.duration_min + ' min' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </InfoBox>
        </div>

        {Object.entries(TANK_BEHOURD_PROGRAM.sessions).map(([key, s]) => (
          <div key={key} className="mb-3 rounded-xl2 border bg-white/5 p-3" style={{ borderLeft: `3px solid ${s.color}`, borderColor: s.color + '55' }}>
            <div className="mb-1 text-sm font-extrabold text-ink">
              {s.icon} {s.label} · ⏱ {s.duration_min} min
            </div>
            <div className="mb-2 text-[11px] italic text-muted">
              <b>🔥 Échauffement :</b> {s.warmup}
            </div>
            <ExerciseTable exercises={s.exercises} showRest show1rm />
            <div className="mt-2 text-[10px] italic text-muted">
              <b>🧊 Retour au calme :</b> {s.cooldown}
            </div>
          </div>
        ))}

        <InfoBox title="🍽️ Nutrition body recomp (gras → muscle)" tone="amber">
          <div className="text-[11px] leading-relaxed text-ink">
            <b>Calories :</b> {TANK_BEHOURD_PROGRAM.nutrition.calories_jour}
            <br />
            <b>Protéines :</b> {TANK_BEHOURD_PROGRAM.nutrition.proteines_g_jour}g/jour — {TANK_BEHOURD_PROGRAM.nutrition.proteines_sources.join(', ')}
            <br />
            <b>Glucides :</b> {TANK_BEHOURD_PROGRAM.nutrition.glucides_g_jour}g/jour — {TANK_BEHOURD_PROGRAM.nutrition.glucides_sources.join(', ')}
            <br />
            <b>Lipides :</b> {TANK_BEHOURD_PROGRAM.nutrition.lipides_g_jour}g/jour — {TANK_BEHOURD_PROGRAM.nutrition.lipides_sources.join(', ')}
            <br />
            <b>Hydratation :</b> {TANK_BEHOURD_PROGRAM.nutrition.hydratation_L} L/jour
            <br />
            <b>Timing :</b> {TANK_BEHOURD_PROGRAM.nutrition.timing}
            <BulletGroup label="Suppléments optionnels" items={TANK_BEHOURD_PROGRAM.nutrition.supplements_optionnels} />
          </div>
        </InfoBox>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <InfoBox title="📈 Progression" tone="blue">
            <div className="text-[10px] leading-relaxed text-ink">
              <b>Sem 1-4 :</b> {TANK_BEHOURD_PROGRAM.progression.semaine_1_4}
              <br />
              <b>Sem 5-8 :</b> {TANK_BEHOURD_PROGRAM.progression.semaine_5_8}
              <br />
              <b>Sem 9-12 :</b> {TANK_BEHOURD_PROGRAM.progression.semaine_9_12}
              <br />
              <b>Sem 12+ :</b> {TANK_BEHOURD_PROGRAM.progression.semaine_12_plus}
            </div>
          </InfoBox>
          <InfoBox title="📏 Mesures à tracker" tone="violet">
            <ul className="ml-4 list-disc text-[10px] leading-relaxed text-ink">
              {TANK_BEHOURD_PROGRAM.measurements_to_track.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </InfoBox>
        </div>
      </Section>

      {/* ───────── Calendriers ───────── */}
      <Section title="🛡️ Calendrier Béhourd dédié" subtitle={`${BEHOURD_CALENDAR_CFG.event_categories.length} catégories`} accent="#ef4444">
        <CalendarHelp cfg={BEHOURD_CALENDAR_CFG} />
        {BEHOURD_CALENDAR_CFG.weekly_recurring ? (
          <InfoBox title="🔁 Récurrences hebdo à créer" tone="amber" className="mt-2">
            <table className="w-full text-[11px] text-ink">
              <tbody>
                {BEHOURD_CALENDAR_CFG.weekly_recurring.map((r, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-0.5 pr-2 font-bold">{r.day}</td>
                    <td className="py-0.5 pr-2">{r.time}</td>
                    <td className="py-0.5">{r.event}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </InfoBox>
        ) : null}
        <CategoryGrid cfg={BEHOURD_CALENDAR_CFG} />
      </Section>

      <Section title="📅 Calendrier perso" subtitle={`${PERSO_CALENDAR_CFG.event_categories.length} catégories — yoga, privé`} accent="#a78bfa">
        <CalendarHelp cfg={PERSO_CALENDAR_CFG} />
        <CategoryGrid cfg={PERSO_CALENDAR_CFG} />
      </Section>
    </div>
  )
}
