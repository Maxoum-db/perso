import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { Section, Stat } from '../components/training-ui'
import {
  allure,
  allureCorrigee,
  chargeSortie,
  deleteSortie,
  distanceEquivalente,
  efficacite,
  formatAllure,
  formatDuree,
  lireDuree,
  lireSplits,
  listSorties,
  rapportCharge,
  records,
  saveSortie,
  semaines,
  TYPES_SORTIE,
  vdot,
  vdotRecent,
  vma,
  VERDICTS_COURSE,
  type Sortie,
  type TypeSortie,
} from '../lib/course'

// Page Course à pied : le journal des sorties et ce qu'on en lit.
//
// Elle remplace l'onglet Béhourd quand la discipline choisie dans les réglages
// est la course. Deux personnes utilisent l'application, et l'une court.
//
// Le parti pris de la saisie : l'essentiel tient en trois champs (date,
// distance, temps) et tout le reste est replié. Un journal qu'on ne remplit pas
// ne sert à rien, et un formulaire de quinze champs ne se remplit pas. Mais les
// quinze champs sont là pour qui veut les remplir — c'est ce qui permet, un an
// plus tard, de dire pourquoi une sortie a été dure.

const VIDE = (): Omit<Sortie, 'id'> & { id?: string } => ({
  date: new Date().toLocaleDateString('en-CA'),
  heure: null,
  type: 'endurance',
  distance_km: 0,
  duree_s: 0,
  denivele_pos_m: null,
  denivele_neg_m: null,
  fc_moy: null,
  fc_max: null,
  cadence_spm: null,
  rpe: null,
  surface: null,
  meteo: null,
  temperature_c: null,
  chaussures: null,
  splits_s: [],
  fractions: [],
  ressenti: null,
  notes: '',
})

const SURFACES = ['Route', 'Chemin', 'Piste', 'Tapis', 'Sable', 'Neige']

export function Course() {
  const { user } = useAuth()
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [edition, setEdition] = useState<(Omit<Sortie, 'id'> & { id?: string }) | null>(null)

  async function recharger() {
    if (!user) return
    try {
      setSorties(await listSorties(user.id))
    } catch (e) {
      setErreur((e as Error).message)
    }
  }
  useEffect(() => {
    recharger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const sem = useMemo(() => semaines(sorties, 12), [sorties])
  const semaine = sem[sem.length - 1]
  const charge = useMemo(() => rapportCharge(sorties), [sorties])
  const perso = useMemo(() => records(sorties), [sorties])
  const cylindree = useMemo(() => vdotRecent(sorties), [sorties])

  async function enregistrer(s: Omit<Sortie, 'id'> & { id?: string }) {
    if (!user) return
    try {
      await saveSortie(user.id, s)
      setEdition(null)
      await recharger()
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer cette sortie ?')) return
    try {
      await deleteSortie(id)
      await recharger()
    } catch (e) {
      setErreur((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">🏃 Course à pied</h1>
          <p className="text-sm text-muted">Journal des sorties et progression</p>
        </div>
        <button onClick={() => setEdition(VIDE())} className="btn ml-auto bg-clay text-xs text-white">
          + Nouvelle sortie
        </button>
      </div>

      {erreur ? <p className="rounded-xl2 bg-clay/15 p-2 text-xs text-clay">{erreur}</p> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Cette semaine"
          value={`${semaine.km.toFixed(1)} km`}
          sub={`${semaine.sorties} sortie${semaine.sorties > 1 ? 's' : ''} · ${formatDuree(semaine.duree_s)}`}
          color="#3b82f6"
        />
        <Stat
          label="Dénivelé"
          value={`${Math.round(semaine.denivele_m)} m`}
          sub="cumulé cette semaine"
          color="#d97706"
        />
        <Stat
          label="Charge"
          value={charge.ratio ? charge.ratio.toFixed(2) : '—'}
          sub={VERDICTS_COURSE[charge.verdict].label}
          color={VERDICTS_COURSE[charge.verdict].couleur}
        />
        <Stat
          label="VMA estimée"
          value={cylindree ? `${vma(cylindree).toFixed(1)} km/h` : '—'}
          sub={cylindree ? `VO₂max ~${cylindree.toFixed(0)}` : 'à venir'}
          color="#8b5cf6"
        />
      </div>

      {charge.verdict !== 'repos' ? (
        <div
          className="rounded-xl2 border-l-[3px] bg-white/5 p-3 text-xs leading-relaxed text-ink"
          style={{ borderColor: VERDICTS_COURSE[charge.verdict].couleur }}
        >
          <b>{VERDICTS_COURSE[charge.verdict].label}</b> — {VERDICTS_COURSE[charge.verdict].conseil}
          <div className="mt-1 text-muted">
            Semaine écoulée {Math.round(charge.aigue)} contre {Math.round(charge.chronique)} en moyenne sur quatre
            semaines.
          </div>
        </div>
      ) : null}

      {edition ? (
        <Formulaire
          valeur={edition}
          onAnnuler={() => setEdition(null)}
          onEnregistrer={enregistrer}
        />
      ) : null}

      <VolumeHebdo semaines={sem} />

      <Section title="🏅 Records personnels" subtitle={`${perso.length} distances`} accent="#eab308" defaultOpen>
        {perso.length === 0 ? (
          <p className="text-xs text-muted">
            Aucun repère pour l'instant. Un record apparaît dès qu'une sortie tombe sur une distance de référence, ou
            dès que les temps au kilomètre sont saisis — le meilleur 5 km se trouve souvent À L'INTÉRIEUR d'un 10 km,
            pas sur sa ligne d'arrivée.
          </p>
        ) : (
          <table className="w-full text-xs text-ink">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="pb-1">Distance</th>
                <th className="pb-1">Temps</th>
                <th className="pb-1">Allure</th>
                <th className="pb-1">Quand</th>
              </tr>
            </thead>
            <tbody>
              {perso.map((r) => (
                <tr key={r.label} className="border-t border-line/50">
                  <td className="py-1 font-bold">{r.label}</td>
                  <td className="py-1 tabular-nums">{formatDuree(r.duree_s)}</td>
                  <td className="py-1 tabular-nums text-muted">{formatAllure(r.duree_s / r.km)}</td>
                  <td className="py-1 text-muted">
                    {r.date}
                    {r.extrait ? <span className="ml-1 text-[9px] italic">extrait d'une sortie</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Efficacite sorties={sorties} />

      <Section title="📒 Journal" subtitle={`${sorties.length} sorties`} accent="#3b82f6" defaultOpen>
        {sorties.length === 0 ? (
          <p className="text-xs text-muted">Rien encore. « + Nouvelle sortie » pour commencer.</p>
        ) : (
          <div className="space-y-2">
            {sorties.map((s) => (
              <Ligne key={s.id} s={s} onEditer={() => setEdition({ ...s })} onSupprimer={() => supprimer(s.id)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Une sortie dans le journal ──────────────────────────────────────────────

function Ligne({ s, onEditer, onSupprimer }: { s: Sortie; onEditer: () => void; onSupprimer: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const t = TYPES_SORTIE.find((x) => x.id === s.type) ?? TYPES_SORTIE[1]
  const a = allure(s)
  const ac = allureCorrigee(s)
  const corrige = Math.abs(ac - a) > 3
  const eff = efficacite(s)
  const v = vdot(distanceEquivalente(s), s.duree_s)

  return (
    <div className="rounded-xl2 border border-line bg-white/5 p-2.5">
      <button onClick={() => setOuvert((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="text-lg">{t.icone}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <b className="text-ink">{s.distance_km.toFixed(2)} km</b>
            <span className="tabular-nums text-ink">{formatDuree(s.duree_s)}</span>
            <span className="tabular-nums text-copper">{formatAllure(a)}</span>
            {corrige ? (
              <span className="tabular-nums text-[10px] text-muted" title="Allure corrigée du dénivelé">
                ≈ {formatAllure(ac)} à plat
              </span>
            ) : null}
          </div>
          <div className="text-[10px] text-muted">
            {s.date} · {t.label}
            {s.denivele_pos_m ? ` · ${s.denivele_pos_m} m D+` : ''}
            {s.fc_moy ? ` · ${s.fc_moy} bpm` : ''}
            {s.rpe ? ` · RPE ${s.rpe}` : ''}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted">{ouvert ? '▾' : '▸'}</span>
      </button>

      {ouvert ? (
        <div className="mt-2 space-y-2 border-t border-line/60 pt-2 text-[11px] text-ink">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
            {s.heure ? <Detail k="Heure" v={s.heure} /> : null}
            {s.denivele_pos_m || s.denivele_neg_m ? (
              <Detail k="Dénivelé" v={`+${s.denivele_pos_m ?? 0} / −${s.denivele_neg_m ?? 0} m`} />
            ) : null}
            {s.fc_moy ? <Detail k="FC moyenne" v={`${s.fc_moy} bpm`} /> : null}
            {s.fc_max ? <Detail k="FC max" v={`${s.fc_max} bpm`} /> : null}
            {s.cadence_spm ? <Detail k="Cadence" v={`${s.cadence_spm} pas/min`} /> : null}
            {s.rpe ? <Detail k="Effort perçu" v={`${s.rpe}/10`} /> : null}
            {s.surface ? <Detail k="Surface" v={s.surface} /> : null}
            {s.meteo || s.temperature_c !== null ? (
              <Detail k="Météo" v={[s.meteo, s.temperature_c !== null ? `${s.temperature_c} °C` : null].filter(Boolean).join(' · ')} />
            ) : null}
            {s.chaussures ? <Detail k="Chaussures" v={s.chaussures} /> : null}
            {eff ? <Detail k="Efficacité" v={`${eff.toFixed(2)} m/min/bpm`} /> : null}
            {v > 0 ? <Detail k="VDOT de la sortie" v={v.toFixed(1)} /> : null}
            <Detail k="Charge" v={Math.round(chargeSortie(s)).toString()} />
          </div>

          {s.splits_s.length > 0 ? <Splits splits={s.splits_s} /> : null}

          {s.fractions.length > 0 ? (
            <div>
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Fractions</div>
              <ul className="space-y-0.5">
                {s.fractions.map((f, i) => (
                  <li key={i}>
                    {f.nb} ×{' '}
                    {f.distance_m > 0 ? `${f.distance_m} m` : formatDuree(f.duree_s)}
                    {f.recup_s > 0 ? ` · récup ${formatDuree(f.recup_s)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {s.ressenti ? <p className="italic text-muted">« {s.ressenti} »</p> : null}
          {s.notes ? <p className="text-muted">📝 {s.notes}</p> : null}

          <div className="flex gap-2 pt-1">
            <button onClick={onEditer} className="btn-ghost text-[11px]">
              Modifier
            </button>
            <button onClick={onSupprimer} className="btn-ghost text-[11px] text-clay">
              Supprimer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase tracking-wide text-muted">{k}</span>
      <div className="tabular-nums">{v}</div>
    </div>
  )
}

/**
 * Les kilomètres, en barres.
 *
 * L'allure moyenne ne distingue pas un départ trop vite d'une course bien
 * gérée : les deux peuvent donner 5:10/km. C'est la FORME du profil qui le dit,
 * et elle ne se lit qu'en voyant les kilomètres côte à côte.
 */
function Splits({ splits }: { splits: number[] }) {
  const min = Math.min(...splits)
  const max = Math.max(...splits)
  const moy = splits.reduce((a, b) => a + b, 0) / splits.length
  const premiere = splits.slice(0, Math.floor(splits.length / 2))
  const seconde = splits.slice(Math.ceil(splits.length / 2))
  const negatif =
    seconde.length > 0 &&
    premiere.length > 0 &&
    seconde.reduce((a, b) => a + b, 0) / seconde.length < premiere.reduce((a, b) => a + b, 0) / premiere.length
  return (
    <div>
      <div className="mb-0.5 flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Kilomètre par kilomètre</span>
        <span className="text-[10px] text-muted">
          {splits.length > 3 ? (negatif ? '↘ seconde moitié plus rapide' : '↗ seconde moitié plus lente') : ''}
        </span>
      </div>
      <div className="flex items-end gap-[2px]">
        {splits.map((v, i) => {
          const h = max > min ? 6 + ((max - v) / (max - min)) * 26 : 20
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-[1px]" title={`km ${i + 1} — ${formatAllure(v)}`}>
              <div
                className="w-full rounded-sm"
                style={{ height: h, background: v <= moy ? '#22c55e' : '#f59e0b', opacity: 0.85 }}
              />
              <span className="text-[7px] text-muted">{i + 1}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-0.5 text-[10px] text-muted">
        Plus rapide {formatAllure(min)} · plus lent {formatAllure(max)} · moyenne {formatAllure(moy)}
      </div>
    </div>
  )
}

// ── Volume hebdomadaire ─────────────────────────────────────────────────────

function VolumeHebdo({ semaines: sem }: { semaines: ReturnType<typeof semaines> }) {
  const max = Math.max(1, ...sem.map((s) => s.km))
  const total = sem.reduce((n, s) => n + s.km, 0)
  return (
    <Section title="📊 Volume hebdomadaire" subtitle={`${total.toFixed(0)} km sur 12 semaines`} accent="#3b82f6" defaultOpen>
      <p className="mb-2 text-[11px] italic text-muted">
        La règle la plus ancienne de la course à pied : pas plus de 10 % de volume en plus d'une semaine à l'autre.
        C'est le BOND qui blesse, pas le volume installé.
      </p>
      {/* `min-w-0` sur chaque colonne : sans lui, l'étiquette de date impose sa
          largeur, les douze colonnes débordent du cadre et les trois dernières
          semaines — les seules qui intéressent — sortent de l'écran. Et une
          semaine sur deux étiquetée, parce que douze dates à 7 px se
          chevauchent de toute façon. */}
      <div className="flex items-end gap-1 overflow-hidden" style={{ height: 90 }}>
        {sem.map((s, i) => (
          <div key={s.debut} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={`${s.debut} — ${s.km.toFixed(1)} km · ${s.sorties} sorties`}>
            <span className="text-[8px] tabular-nums text-muted">{s.km > 0 ? s.km.toFixed(0) : ''}</span>
            <div
              className="w-full rounded-t"
              style={{ height: `${(s.km / max) * 62}px`, background: '#3b82f6', opacity: 0.8, minHeight: s.km > 0 ? 2 : 0 }}
            />
            <span className="whitespace-nowrap text-[7px] text-muted">
              {i % 2 === 0 ? s.debut.slice(5).replace('-', '/') : ''}
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

/**
 * L'efficacité : mètres par minute et par battement de cœur.
 *
 * C'est le signe de progrès le plus lisible en endurance — et le seul qui ne
 * demande pas de courir vite pour se mesurer. Deux sorties à la même allure,
 * celle où le cœur bat moins vite est la meilleure.
 */
function Efficacite({ sorties }: { sorties: Sortie[] }) {
  const points = sorties
    .map((s) => ({ date: s.date, v: efficacite(s) }))
    .filter((p): p is { date: string; v: number } => p.v !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Section title="❤️ Efficacité cardiaque" subtitle={points.length ? `${points.length} sorties mesurées` : 'FC manquante'} accent="#ef4444">
      {points.length < 3 ? (
        <p className="text-xs text-muted">
          Il faut la fréquence cardiaque moyenne d'au moins trois sorties. Sans elle, on ne peut comparer que des
          allures — et une allure ne dit pas ce qu'elle a coûté. C'est la mesure de progrès la plus fiable en
          endurance : à allure égale, un cœur qui bat moins vite est un cœur qui a progressé.
        </p>
      ) : (
        <>
          <Courbe points={points} />
          <p className="mt-1 text-[11px] text-muted">
            Mètres parcourus par minute et par battement, sur la distance corrigée du dénivelé. Une courbe qui monte
            est un progrès, quelle que soit l'allure du jour.
          </p>
        </>
      )}
    </Section>
  )
}

function Courbe({ points }: { points: Array<{ date: string; v: number }> }) {
  const jour = (d: string) => Date.parse(d + 'T00:00:00') / 86400000
  const x0 = jour(points[0].date)
  const x1 = jour(points[points.length - 1].date)
  const span = Math.max(1, x1 - x0)
  const vals = points.map((p) => p.v)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const amp = Math.max(0.05, max - min)
  const W = 300
  const H = 100
  const px = (d: string) => ((jour(d) - x0) / span) * (W - 8) + 4
  const py = (v: number) => H - 12 - ((v - min) / amp) * (H - 26)
  const ligne = points.map((p) => `${px(p.date).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Efficacité cardiaque">
      <polyline points={ligne} fill="none" stroke="#ef4444" strokeWidth="1.6" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.date + p.v} cx={px(p.date)} cy={py(p.v)} r="1.8" fill="#ef4444" />
      ))}
      <text x="4" y="9" fontSize="8" fill="rgb(var(--muted))">
        {max.toFixed(2)}
      </text>
      <text x="4" y={H - 2} fontSize="8" fill="rgb(var(--muted))">
        {min.toFixed(2)}
      </text>
    </svg>
  )
}

// ── Saisie ──────────────────────────────────────────────────────────────────

function Formulaire({
  valeur,
  onAnnuler,
  onEnregistrer,
}: {
  valeur: Omit<Sortie, 'id'> & { id?: string }
  onAnnuler: () => void
  onEnregistrer: (s: Omit<Sortie, 'id'> & { id?: string }) => void
}) {
  const [s, setS] = useState(valeur)
  const [tempsTexte, setTempsTexte] = useState(valeur.duree_s ? formatDuree(valeur.duree_s) : '')
  const [splitsTexte, setSplitsTexte] = useState(valeur.splits_s.map(formatDuree).join(' '))
  const [detail, setDetail] = useState(false)

  const maj = <K extends keyof Sortie>(k: K, v: Sortie[K]) => setS((p) => ({ ...p, [k]: v }))
  const nombre = (v: string) => (v.trim() === '' ? null : Number(v))
  const duree = lireDuree(tempsTexte)
  const splits = lireSplits(splitsTexte)
  const apercu = { ...s, duree_s: duree, splits_s: splits } as Sortie

  return (
    <div className="rounded-xl2 border border-copper/40 bg-white/5 p-3">
      <div className="mb-2 text-sm font-extrabold text-ink">{s.id ? 'Modifier la sortie' : 'Nouvelle sortie'}</div>

      <div className="mb-2 flex flex-wrap gap-1">
        {TYPES_SORTIE.map((t) => (
          <button
            key={t.id}
            onClick={() => maj('type', t.id as TypeSortie)}
            title={t.aide}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold transition"
            style={{
              background: s.type === t.id ? t.couleur : 'rgba(255,255,255,.05)',
              color: s.type === t.id ? '#fff' : 'rgb(var(--muted))',
            }}
          >
            {t.icone} {t.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[10px] italic text-muted">
        {TYPES_SORTIE.find((t) => t.id === s.type)?.aide}
      </p>

      {/* L'essentiel : trois champs. Un journal qu'on ne remplit pas ne sert à
          rien, et un formulaire de quinze champs ne se remplit pas.
          Deux colonnes sur téléphone : à trois, le sélecteur de date natif est
          rogné et on ne lit plus l'année. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Champ label="Date">
          <input type="date" value={s.date} onChange={(e) => maj('date', e.target.value)} className="field text-xs" />
        </Champ>
        <Champ label="Distance (km)">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={s.distance_km || ''}
            onChange={(e) => maj('distance_km', Number(e.target.value) || 0)}
            className="field text-xs"
          />
        </Champ>
        <Champ label="Temps">
          <input
            type="text"
            inputMode="numeric"
            placeholder="52:30"
            value={tempsTexte}
            onChange={(e) => setTempsTexte(e.target.value)}
            className="field text-xs"
          />
        </Champ>
      </div>

      {duree > 0 && s.distance_km > 0 ? (
        <p className="mt-1.5 text-xs text-copper">
          {formatAllure(allure(apercu))}
          {Math.abs(allureCorrigee(apercu) - allure(apercu)) > 3
            ? ` · ≈ ${formatAllure(allureCorrigee(apercu))} à plat`
            : ''}
          {vdot(distanceEquivalente(apercu), duree) > 0
            ? ` · VDOT ${vdot(distanceEquivalente(apercu), duree).toFixed(1)}`
            : ''}
        </p>
      ) : null}

      <button onClick={() => setDetail((d) => !d)} className="mt-2 text-[11px] text-muted underline">
        {detail ? 'Masquer le détail' : 'Ajouter du détail (dénivelé, cardio, ressenti…)'}
      </button>

      {detail ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Champ label="Heure">
              <input type="time" value={s.heure ?? ''} onChange={(e) => maj('heure', e.target.value || null)} className="field text-xs" />
            </Champ>
            <Champ label="D+ (m)">
              <input type="number" inputMode="numeric" value={s.denivele_pos_m ?? ''} onChange={(e) => maj('denivele_pos_m', nombre(e.target.value))} className="field text-xs" />
            </Champ>
            <Champ label="D− (m)">
              <input type="number" inputMode="numeric" value={s.denivele_neg_m ?? ''} onChange={(e) => maj('denivele_neg_m', nombre(e.target.value))} className="field text-xs" />
            </Champ>
            <Champ label="FC moyenne">
              <input type="number" inputMode="numeric" value={s.fc_moy ?? ''} onChange={(e) => maj('fc_moy', nombre(e.target.value))} className="field text-xs" />
            </Champ>
            <Champ label="FC max">
              <input type="number" inputMode="numeric" value={s.fc_max ?? ''} onChange={(e) => maj('fc_max', nombre(e.target.value))} className="field text-xs" />
            </Champ>
            <Champ label="Cadence">
              <input type="number" inputMode="numeric" value={s.cadence_spm ?? ''} onChange={(e) => maj('cadence_spm', nombre(e.target.value))} className="field text-xs" />
            </Champ>
          </div>

          <Champ label={`Effort perçu ${s.rpe ? `— ${s.rpe}/10` : ''}`}>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => maj('rpe', s.rpe === n ? null : n)}
                  className="flex-1 rounded py-1 text-[10px] font-bold"
                  style={{
                    background: s.rpe === n ? '#f59e0b' : 'rgba(255,255,255,.05)',
                    color: s.rpe === n ? '#fff' : 'rgb(var(--muted))',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </Champ>

          <div className="grid grid-cols-3 gap-2">
            <Champ label="Surface">
              <select value={s.surface ?? ''} onChange={(e) => maj('surface', e.target.value || null)} className="field text-xs">
                <option value="">—</option>
                {SURFACES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Température (°C)">
              <input type="number" inputMode="numeric" value={s.temperature_c ?? ''} onChange={(e) => maj('temperature_c', nombre(e.target.value))} className="field text-xs" />
            </Champ>
            <Champ label="Météo">
              <input type="text" placeholder="Vent, pluie…" value={s.meteo ?? ''} onChange={(e) => maj('meteo', e.target.value || null)} className="field text-xs" />
            </Champ>
          </div>

          <Champ label="Chaussures">
            <input type="text" placeholder="Modèle — pour suivre leur kilométrage" value={s.chaussures ?? ''} onChange={(e) => maj('chaussures', e.target.value || null)} className="field text-xs" />
          </Champ>

          <Champ label="Temps au kilomètre">
            <input
              type="text"
              placeholder="5:12 5:08 5:20 5:15 …"
              value={splitsTexte}
              onChange={(e) => setSplitsTexte(e.target.value)}
              className="field text-xs"
            />
          </Champ>
          <p className="-mt-1 text-[10px] italic text-muted">
            Recopiés de la montre, séparés par des espaces. C'est ce qui permet de retrouver un record de 5 km à
            l'intérieur d'un 10 km, et de voir si le départ était trop rapide.
            {splits.length ? ` — ${splits.length} kilomètres lus.` : ''}
          </p>

          <Fractions valeur={s.fractions} onChange={(f) => maj('fractions', f)} />

          <Champ label="Ressenti">
            <input type="text" placeholder="Jambes lourdes, super sensations…" value={s.ressenti ?? ''} onChange={(e) => maj('ressenti', e.target.value || null)} className="field text-xs" />
          </Champ>
          <Champ label="Notes">
            <textarea value={s.notes} onChange={(e) => maj('notes', e.target.value)} className="field h-16 text-xs" />
          </Champ>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onEnregistrer({ ...s, duree_s: duree, splits_s: splits })}
          disabled={!s.distance_km || !duree}
          className="btn bg-clay text-xs text-white disabled:opacity-40"
        >
          Enregistrer
        </button>
        <button onClick={onAnnuler} className="btn-ghost text-xs">
          Annuler
        </button>
      </div>
    </div>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

function Fractions({ valeur, onChange }: { valeur: Sortie['fractions']; onChange: (f: Sortie['fractions']) => void }) {
  const maj = (i: number, k: keyof Sortie['fractions'][number], v: number) =>
    onChange(valeur.map((f, j) => (i === j ? { ...f, [k]: v } : f)))
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Fractions</div>
      {valeur.map((f, i) => (
        <div key={i} className="mb-1 flex items-center gap-1 text-xs text-ink">
          <input type="number" inputMode="numeric" value={f.nb || ''} onChange={(e) => maj(i, 'nb', Number(e.target.value) || 0)} className="field w-12 text-xs" placeholder="8" />
          <span>×</span>
          <input type="number" inputMode="numeric" value={f.distance_m || ''} onChange={(e) => maj(i, 'distance_m', Number(e.target.value) || 0)} className="field w-16 text-xs" placeholder="400" />
          <span>m · récup</span>
          <input type="number" inputMode="numeric" value={f.recup_s || ''} onChange={(e) => maj(i, 'recup_s', Number(e.target.value) || 0)} className="field w-14 text-xs" placeholder="90" />
          <span>s</span>
          <button onClick={() => onChange(valeur.filter((_, j) => j !== i))} className="ml-auto text-muted hover:text-clay">
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...valeur, { nb: 0, distance_m: 0, duree_s: 0, recup_s: 0 }])}
        className="text-[11px] text-copper underline"
      >
        + Ajouter une série
      </button>
    </div>
  )
}
