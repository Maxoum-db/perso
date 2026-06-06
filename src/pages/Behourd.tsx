import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { fetchKv, saveKv, readKvCache } from '../lib/kv'
import { ArmorBodyDiagram } from '../components/ArmorBodyDiagram'
import {
  ARMOR_PIECES_TEMPLATE,
  BEHOURD_CALENDAR_CFG,
  BEHOURD_TRAINING,
  MUSCU_PROGRAM,
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

  // Sauvegarde à chaque modification (une fois le chargement initial fait).
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
        <p className="text-sm text-muted">Armure · Entraînement TANK · Musculation · Calendriers dédiés</p>
      </div>

      {/* ───────── Armure ───────── */}
      <Section title="🛡️ Armure & entraînement" subtitle={`${ownedCount} pièce(s) · ${totalWeight.toFixed(1)} kg`} accent="#DC2626" defaultOpen>
        <p className="mb-3 text-xs italic text-muted">
          Coche les pièces que tu possèdes et ajuste leur poids réel. Le total t'aide à dimensionner ton
          entraînement (port harnois = +30 % d'effort cardiovasculaire).
        </p>

        {totalPreOrder > 0 ? (
          <div className="mb-3 rounded-xl2 border-2 border-dashed border-sand bg-sand/15 p-3 text-xs leading-relaxed text-[#78350F]">
            <div className="mb-1 font-extrabold text-[#92400E]">
              📦 {totalPreOrder} pièce{totalPreOrder > 1 ? 's' : ''} en cours de fabrication (Pavlo Kozak 🇺🇦)
            </div>
            Livraison prévue : <b>1er novembre 2026</b> · Poids attendu : <b>{preOrderWeight.toFixed(1)} kg</b>.<br />
            D'ici là : travailler la <b>condition physique + technique sec</b> (sans armure) au club + à Basic Fit.
          </div>
        ) : null}

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Poids actuel" value={`${totalWeight.toFixed(1)} kg`} sub={`+${preOrderWeight.toFixed(1)} kg attendus`} color="#DC2626" />
          <Stat label="Investi possédé" value={`$${totalSpent}`} sub="~$6 055 attendu total" color="#10B981" />
          <Stat label="À acheter" value={String(totalToBuy)} sub="hache + bocle" color="#F59E0B" />
          <Stat label="Fournisseur" value="Pavlo Kozak 🇺🇦" sub="acier 30 HGSA" color="#7C3AED" />
        </div>

        <div className="mb-4 rounded-xl2 border border-line bg-[#FAFAFA] p-3">
          <div className="mb-2 text-sm font-extrabold text-ink">🧍 Vue corporelle de ton équipement</div>
          <ArmorBodyDiagram armorPieces={armor} />
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {armor.map((p, idx) => (
            <div
              key={idx}
              className="rounded-xl2 border p-3"
              style={{
                borderColor: p.owned ? '#DC2626' : p.pre_order ? '#F59E0B' : '#E5E7EB',
                background: p.owned ? '#FEE2E280' : p.pre_order ? '#FEF3C7' : '#F9FAFB',
                opacity: p.owned ? 1 : p.pre_order ? 0.9 : 0.75,
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
                  className="w-16 rounded border border-line px-1.5 py-0.5 text-xs"
                />
                <span className="text-[10px] text-muted">kg (typique {p.typical_weight_kg} kg)</span>
              </div>
              <div className="text-[10px] leading-snug text-muted">{p.notes}</div>
              {p.manufacturer ? (
                <div className="mt-1 text-[10px] font-bold text-plum">
                  🏭 {p.manufacturer}
                  {p.product_code ? ` · code ${p.product_code}` : ''}
                  {p.price_usd ? ` · $${p.price_usd}` : ''}
                </div>
              ) : null}
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline">
                  🔗 Voir la fiche
                </a>
              ) : null}
              <input
                type="text"
                value={p.notes_user ?? ''}
                onChange={(e) => update(idx, 'notes_user', e.target.value)}
                placeholder="Notes perso (état, taille…)"
                className="mt-1.5 w-full rounded border border-line px-1.5 py-1 text-[10px]"
              />
            </div>
          ))}
        </div>
        <button onClick={addCustom} className="btn bg-clay text-white text-xs">
          + Ajouter une pièce custom
        </button>

        <InfoBox title="📋 Entraînement spécifique Béhourd" tone="amber" className="mt-4">
          <BulletGroup label="Préparation physique" items={BEHOURD_TRAINING.physical_focus} />
          <BulletGroup label="Drills techniques" items={BEHOURD_TRAINING.specific_drills} />
          <BulletGroup label="Prévention blessures" items={BEHOURD_TRAINING.injury_prevention} />
        </InfoBox>

        <InfoBox title="📅 Template hebdo (béhourd + muscu)" tone="violet" className="mt-3">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(BEHOURD_TRAINING.weekly_template).map(([day, plan]) => (
                <tr key={day} className="border-b border-plum/20">
                  <td className="w-24 py-1 pr-2 font-bold">{day}</td>
                  <td className="py-1">{plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InfoBox>
      </Section>

      {/* ───────── Programme TANK ───────── */}
      <Section title="⚔️ Programme TANK Béhourd" subtitle="100 kg / 180 cm · body recomp + force" accent="#7F1D1D">
        <p className="mb-3 rounded-xl2 bg-sand/15 p-2 text-xs italic text-[#7F1D1D]">{TANK_BEHOURD_PROGRAM.description}</p>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl2 bg-plum/10 p-3 text-xs leading-relaxed text-[#4C1D95]">
            <div className="mb-1 font-bold text-[#5B21B6]">📊 Ton profil</div>
            Poids : <b>{TANK_BEHOURD_PROGRAM.user_profile.poids_kg} kg</b> · Taille : <b>{TANK_BEHOURD_PROGRAM.user_profile.taille_cm} cm</b>
            <br />
            IMC : <b>{TANK_BEHOURD_PROGRAM.user_profile.IMC}</b> — {TANK_BEHOURD_PROGRAM.user_profile.classification}
            <br />
            Objectif : <b>{TANK_BEHOURD_PROGRAM.user_profile.objectif}</b>
            <br />
            Durée : <b>{TANK_BEHOURD_PROGRAM.user_profile.duree_programme}</b>
          </div>
          <div className="rounded-xl2 bg-sage/10 p-3 text-[11px] text-sage-dark">
            <div className="mb-1 font-bold">📅 Split hebdomadaire</div>
            <table className="w-full">
              <tbody>
                {Object.entries(TANK_BEHOURD_PROGRAM.weekly_split).map(([day, info]) => (
                  <tr key={day} className="border-b border-sage/20">
                    <td className="w-28 py-0.5 pr-1 font-bold">{day}</td>
                    <td className="py-0.5">{info.type}</td>
                    <td className="w-12 py-0.5 text-right">{info.duration_min > 0 ? info.duration_min + ' min' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {Object.entries(TANK_BEHOURD_PROGRAM.sessions).map(([key, s]) => (
          <div key={key} className="mb-3 rounded-xl2 border-2 p-3" style={{ borderColor: s.color, background: s.color + '10' }}>
            <div className="mb-1 text-sm font-extrabold" style={{ color: s.color }}>
              {s.icon} {s.label} · ⏱ {s.duration_min} min
            </div>
            <div className="mb-2 text-[11px] italic text-ink">
              <b>🔥 Échauffement :</b> {s.warmup}
            </div>
            <ExerciseTable color={s.color} exercises={s.exercises} showRest show1rm />
            <div className="mt-2 text-[10px] italic text-ink">
              <b>🧊 Retour au calme :</b> {s.cooldown}
            </div>
          </div>
        ))}

        <InfoBox title="🍽️ Nutrition body recomp (gras → muscle)" tone="amber">
          <div className="text-[11px] leading-relaxed text-[#78350F]">
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
            <div className="text-[10px] leading-relaxed">
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
            <ul className="ml-4 list-disc text-[10px] leading-relaxed">
              {TANK_BEHOURD_PROGRAM.measurements_to_track.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </InfoBox>
        </div>
      </Section>

      {/* ───────── Musculation ───────── */}
      <Section title="💪 Musculation Basic Fit" subtitle="Push / Pull / Legs / Core" accent="#0E7490">
        <p className="mb-3 text-xs italic text-muted">
          Split classique 3-4 jours/semaine optimisé pour Basic Fit. Adapté préparation béhourd : force +
          endurance + core.
        </p>
        {Object.entries(MUSCU_PROGRAM).map(([key, prog]) => (
          <div key={key} className="mb-3 rounded-xl2 border p-3" style={{ borderColor: prog.color + '60', background: prog.color + '10' }}>
            <div className="mb-1 text-sm font-extrabold" style={{ color: prog.color }}>
              {prog.icon} {prog.label} · ⏱ {prog.duration_min} min
            </div>
            <ExerciseTable color={prog.color} exercises={prog.exercises} showMachine show1rm />
          </div>
        ))}
        <InfoBox title="💡 Légende" tone="amber">
          <span className="text-[10px] text-[#78350F]">
            PdC = Poids du corps. % 1RM = pourcentage du Repetition Max. Pause : 90s pour force (6-8 reps), 60s
            pour hypertrophie (10-12).
          </span>
        </InfoBox>
      </Section>

      {/* ───────── Calendriers ───────── */}
      <Section title="🛡️ Calendrier Béhourd dédié" subtitle={`${BEHOURD_CALENDAR_CFG.event_categories.length} catégories`} accent="#DC2626">
        <CalendarHelp cfg={BEHOURD_CALENDAR_CFG} />
        {BEHOURD_CALENDAR_CFG.weekly_recurring ? (
          <InfoBox title="🔁 Récurrences hebdo à créer" tone="amber" className="mt-2">
            <table className="w-full text-[11px] text-[#78350F]">
              <tbody>
                {BEHOURD_CALENDAR_CFG.weekly_recurring.map((r, i) => (
                  <tr key={i} className="border-b border-sand/40">
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

      <Section title="📅 Calendrier perso" subtitle={`${PERSO_CALENDAR_CFG.event_categories.length} catégories — muscu, yoga, privé`} accent="#5B21B6">
        <CalendarHelp cfg={PERSO_CALENDAR_CFG} />
        <CategoryGrid cfg={PERSO_CALENDAR_CFG} />
      </Section>
    </div>
  )
}

// ───────── Sous-composants ─────────

function Section({
  title,
  subtitle,
  accent,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  accent: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl2 border bg-card shadow-soft" style={{ borderColor: accent + '40' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        style={{ background: accent + '12' }}
      >
        <span className="text-sm font-extrabold" style={{ color: accent }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: accent }}>
          {open ? '▾' : '▸'} {subtitle}
        </span>
      </button>
      {open ? <div className="p-4">{children}</div> : null}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded p-2" style={{ background: color + '15', borderLeft: `3px solid ${color}` }}>
      <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>
        {label}
      </div>
      <div className="text-base font-extrabold text-ink">{value}</div>
      <div className="text-[9px] italic text-muted">{sub}</div>
    </div>
  )
}

const TONES: Record<string, { bg: string; border: string; title: string }> = {
  amber: { bg: '#FEF3C7', border: '#F59E0B', title: '#92400E' },
  violet: { bg: '#F5F3FF', border: '#C4B5FD', title: '#5B21B6' },
  blue: { bg: '#EFF6FF', border: '#3B82F6', title: '#1E40AF' },
}

function InfoBox({
  title,
  tone,
  className,
  children,
}: {
  title: string
  tone: keyof typeof TONES
  className?: string
  children: ReactNode
}) {
  const t = TONES[tone]
  return (
    <div className={`rounded-xl2 border p-3 ${className ?? ''}`} style={{ background: t.bg, borderColor: t.border }}>
      <div className="mb-1.5 text-xs font-bold" style={{ color: t.title }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function BulletGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-1">
      <b>{label} :</b>
      <ul className="ml-4 list-disc">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

function ExerciseTable({
  color,
  exercises,
  showRest,
  showMachine,
  show1rm,
}: {
  color: string
  exercises: { name: string; sets: number; reps: string; weight_pct_1rm: number; rest_s?: number; machine: string; notes: string }[]
  showRest?: boolean
  showMachine?: boolean
  show1rm?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] text-ink">
        <thead>
          <tr className="text-left font-bold" style={{ color, borderBottom: `1px solid ${color}40` }}>
            <th className="px-1.5 py-1">Exercice</th>
            <th className="px-1.5 py-1">Séries</th>
            <th className="px-1.5 py-1">Reps</th>
            {show1rm ? <th className="px-1.5 py-1">% 1RM</th> : null}
            {showRest ? <th className="px-1.5 py-1">Repos</th> : null}
            {showMachine ? <th className="px-1.5 py-1">Machine</th> : null}
            <th className="px-1.5 py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {exercises.map((ex, i) => (
            <tr key={i} className="border-b border-dashed border-line">
              <td className="px-1.5 py-1 font-semibold">{ex.name}</td>
              <td className="px-1.5 py-1">{ex.sets}</td>
              <td className="px-1.5 py-1">{ex.reps}</td>
              {show1rm ? <td className="px-1.5 py-1">{ex.weight_pct_1rm > 0 ? ex.weight_pct_1rm + '%' : 'PdC'}</td> : null}
              {showRest ? <td className="px-1.5 py-1">{ex.rest_s}s</td> : null}
              {showMachine ? <td className="px-1.5 py-1">{ex.machine}</td> : null}
              <td className="px-1.5 py-1 italic">{ex.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CalendarHelp({ cfg }: { cfg: typeof BEHOURD_CALENDAR_CFG }) {
  return (
    <div className="rounded-xl2 border p-3 text-[11px] leading-relaxed" style={{ borderColor: cfg.recommended_color, background: cfg.recommended_color + '12' }}>
      <div className="mb-1 font-bold" style={{ color: cfg.recommended_color }}>
        📅 Calendrier Google dédié : « {cfg.name} »
      </div>
      <div className="text-ink">{cfg.description}</div>
      <div className="mt-2">
        <b>Comment configurer :</b>
        <ol className="ml-4 list-decimal">
          <li>
            Va sur <b>calendar.google.com</b> → ⚙ → Add other calendars → Create new
          </li>
          <li>
            Nom : <code>{cfg.name}</code>
          </li>
          <li>Couleur recommandée : {cfg.recommended_color}</li>
          <li>Ajoute tes événements (ils apparaîtront aussi dans l'onglet Agenda du Hub)</li>
        </ol>
      </div>
    </div>
  )
}

function CategoryGrid({ cfg }: { cfg: typeof BEHOURD_CALENDAR_CFG }) {
  return (
    <div className="mt-2">
      <div className="mb-1.5 text-xs font-bold text-ink">📋 Catégories d'événements</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cfg.event_categories.map((cat) => (
          <div key={cat.id} className="rounded p-2" style={{ background: cat.color + '15', border: `1px solid ${cat.color}60` }}>
            <div className="text-[11px] font-bold" style={{ color: cat.color }}>
              {cat.label}
            </div>
            <div className="text-[9px] text-muted">
              Durée typique : {cat.duration_typ_min} min{cat.default_recurrence ? ` · 🔁 ${cat.default_recurrence}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
