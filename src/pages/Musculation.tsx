import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import type { Section as SectionAutorisee } from '../lib/acces'
import { useLocation, useNavigate } from 'react-router-dom'
import { SubTabs } from '../components/SubTabs'
import { Section } from '../components/training-ui'
import { Poids } from './Carnet'
import { listWeighins, type Weighin } from '../lib/workouts'
import { ExercisePicker, normalizeName } from '../components/ExercisePicker'
import { estAdaptable, loadDouceurs, nettoyerDouceurs, saveDouceurs, type Douceurs } from '../lib/douceur'
import { GroupPicker } from '../components/GroupPicker'
import { RessentiPicker } from '../components/RessentiPicker'
import { RecuperationCard } from '../components/RecuperationCard'
import { NeglectedMuscles } from '../components/NeglectedMuscles'
import { ObservationsCard } from '../components/ObservationsCard'
import { SuggestedSessionCard } from '../components/SuggestedSessionCard'
import { type SuggestedSession } from '../lib/sessionBuilder'
import { suggererCharge, TON_STYLE, type TonCharge } from '../lib/charge'
import { FocusPicker } from '../components/FocusPicker'
import { FOCUS_PAR_DEFAUT, estModeRecup, loadBehourd, loadFocus, saveBehourd, saveFocus, type FocusId } from '../lib/focus'
import {
  declarerAjustement,
  declarerPret,
  fmtAjust,
  loadCourbatures,
  saveCourbatures,
  type Courbatures,
} from '../lib/soreness'
import { evaluerForme } from '../lib/forme'
import { chargesCourantes } from '../lib/charges'
import { listSorties, sortiesEnSeances, type Sortie } from '../lib/course'
import { DUREE_PAR_DEFAUT, dureeLignes, fmtDuree, loadDuree, saveDuree } from '../lib/duree'
import { composerSeance } from '../lib/prochaine'
import {
  loadObservations,
  noterObservation,
  observationDepuisFiche,
  saveObservations,
  type Observations,
} from '../lib/observations'
import { reposParMuscle } from '../lib/recuperation'
import { etatProtocole } from '../lib/protocole'
import type { MuscleRegion } from '../lib/muscles'
import { loadNuits, type Nuits } from '../lib/sommeil'
import { Sommeil } from './Sommeil'
import {
  INTENSITES,
  INTENSITE_IDS,
  loadIntensites,
  nettoyerIntensites,
  saveIntensite,
  type IntensiteId,
  type Intensites,
} from '../lib/intensite'
import { PROFIL_DEFAUT, loadProfil, type Profil } from '../lib/profil'
import { ProgressTab } from './MusculationProgress'
import { LiveSession, clearLive, loadLive, storeLive, type LiveState } from './MusculationLive'
import {
  MUSCLE_GROUPS_DEFAULT,
  exerciseProgress,
  seancesRecentes,
  FENETRE_STATS,
  fmtTonnage,
  sessionTonnage,
  distanceEnMetres,
  RESSENTI_NAME,
  estRessenti,
  parseGroupEntries,
  METRES_PAR_REP,
  deleteCatalogExercise,
  deleteSession,
  deleteTemplate,
  ensureSeeded,
  listCatalog,
  listSessions,
  listTemplates,
  loadMuscleGroups,
  saveCatalogExercise,
  saveMuscleGroups,
  fusionnerGroupes,
  groupesPersos,
  saveSession,
  saveTemplate,
  type CatalogExercise,
  type ExoInput,
  type MuscuExo,
  type MuscuSession,
  type MuscuTemplate,
} from '../lib/muscu'

// Module Musculation complet : journal des séances (date, exercices, reps/temps,
// charge, groupe visé, durée, notes) + séances types éditables (pré-remplies
// depuis le programme Basic Fit à la première visite).

// Emojis de séance, rangés par thème : une séance se reconnaît d'un coup d'œil
// dans la liste sans avoir à lire son nom.
const TPL_ICON_THEMES: Array<{ theme: string; icons: string[] }> = [
  { theme: 'Force', icons: ['🏋️', '💪', '🦾', '🧱', '⚙️', '🏆'] },
  { theme: 'Zones', icons: ['🦵', '🫁', '🫀', '🦴', '🖐️', '🌀'] },
  { theme: 'Cardio', icons: ['🏃', '🚴', '🚣', '🪜', '⚡', '⏱️'] },
  { theme: 'Eau', icons: ['💧', '🏊', '🌊', '🐬', '🥽'] },
  { theme: 'Combat', icons: ['⚔️', '🛡️', '🥊', '🪖', '🤺', '🏹'] },
  { theme: 'Extérieur', icons: ['🌲', '🪓', '🥾', '⛰️', '🧗', '🚵'] },
  { theme: 'Récup', icons: ['🧘', '🍃', '🧊', '😴', '🩹', '🔥'] },
]

// Mots-clés → emoji, pour illustrer une séance qui n'en a pas. Les motifs sont
// écrits SANS accent : le texte comparé est désaccentué avant le test.
const ICON_KEYWORDS: Array<[RegExp, string]> = [
  [/nage|natation|crawl|brasse|papillon|piscine|aquagym/, '💧'],
  [/behourd|harnois|armure|melee|bouclier|heaume|duel/, '⚔️'],
  [/boxe|boxing|thai|frappe|sparring|pao|shadow/, '🥊'],
  [/course|running|footing|fractionn|trail|sprint|tapis/, '🏃'],
  [/velo|bike|elliptique|biking/, '🚴'],
  [/rameur|kayak|aviron/, '🚣'],
  [/escalier|stairmaster/, '🪜'],
  [/bois|hache|buch|troncon|jardin|elagage|debrouss/, '🪓'],
  [/rando|marche|hike/, '🥾'],
  [/escalade|bloc|grimpe/, '🧗'],
  [/jambe|leg|squat|cuisse|fessier|mollet|presse a cuisses/, '🦵'],
  [/tirage|traction|rowing|\bdos\b|pull/, '🦾'],
  [/gainage|abdo|core|ceinture|planche/, '🌀'],
  [/mobilit|etirement|yoga|souplesse|recup|repos/, '🧘'],
  [/hiit|circuit|cardio|metcon/, '⚡'],
  [/full body|corps entier|general/, '🧱'],
  [/pec|poitrine|push|pouss|epaule|bras|biceps|triceps|develop/, '💪'],
]

/** Zones « bras » : servent à décider entre bras normal et bras d'acier. */
const MOTS_BRAS = /biceps|triceps|brachial|avant-bras|bras/i

/**
 * Séance de bras : 🦾 quand ça a vraiment forcé, 💪 quand c'était plus doux.
 * Le seuil s'appuie sur ce qui a été fait — séries sur les bras et intensité
 * déclarée — plutôt que sur le nom de la séance.
 */
function brasDAcier(s: MuscuSession): boolean {
  let series = 0
  let maxIntensite = 0
  for (const e of s.exercises) {
    const surLesBras = parseGroupEntries(e.muscle_group).filter((g) => MOTS_BRAS.test(g.name))
    if (surLesBras.length === 0) continue
    const i = Math.max(...surLesBras.map((g) => g.intensity))
    maxIntensite = Math.max(maxIntensite, i)
    if (i >= 0.8) series += Math.max(1, e.sets)
  }
  return maxIntensite >= 0.8 && series >= 9
}

// Une séance n'a pas de colonne « icône » : l'emoji choisi à la main vit en
// préfixe de son nom. Visible, modifiable, et sans migration de schéma.
const PREFIXE_EMOJI = /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*/u

export function emojiDuNom(nom: string): string | null {
  return nom.match(PREFIXE_EMOJI)?.[1] ?? null
}

/** Le nom sans son emoji, pour ne pas l'afficher deux fois. */
function nomSansEmoji(nom: string): string {
  return nom.replace(PREFIXE_EMOJI, '').trim() || nom
}

/** Remplace (ou retire) l'emoji en tête d'un nom de séance. */
function avecEmoji(nom: string, emoji: string | null): string {
  const base = nom.replace(PREFIXE_EMOJI, '').trim()
  return emoji ? `${emoji} ${base}`.trim() : base
}

/** Emoji d'une séance du journal : choisi à la main, sinon sa séance type, sinon déduit. */
function sessionEmoji(s: MuscuSession, templates: MuscuTemplate[]): string {
  const choisi = emojiDuNom(s.name)
  if (choisi) return choisi
  const tpl = s.template_id ? templates.find((t) => t.id === s.template_id) : null
  if (tpl?.icon) return tpl.icon
  const haystack = [s.name, ...s.exercises.map((e) => e.name)]
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  for (const [re, icon] of ICON_KEYWORDS) {
    if (!re.test(haystack)) continue
    // Le seul cas où l'emoji dépend de l'effort et pas du nom.
    if (icon === '💪') return brasDAcier(s) ? '🦾' : '💪'
    return icon
  }
  return '🏋️'
}

const today = () => new Date().toISOString().slice(0, 10)
function frDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Brouillons d'édition (tout en chaînes pour les inputs) ──────────────────

interface ExoDraft {
  name: string
  muscle_group: string
  sets: string
  reps: string
  weight: string
  notes: string
  /** Justification de la charge proposée (« 10 reps la dernière fois : +2,5 kg »). */
  hint?: string
  hintTon?: TonCharge
  /** Fait à vide, en amplitude : la ligne compte comme récupération. */
  doux?: boolean
}

function emptyExo(group = ''): ExoDraft {
  return { name: '', muscle_group: group, sets: '3', reps: '10', weight: '', notes: '' }
}

function exoToDraft(e: MuscuExo): ExoDraft {
  return {
    name: e.name,
    muscle_group: e.muscle_group,
    sets: String(e.sets),
    reps: e.reps,
    weight: e.weight_kg === null ? '' : String(e.weight_kg),
    notes: e.notes,
    doux: e.doux,
  }
}

function draftToInput(d: ExoDraft): ExoInput {
  const w = parseFloat(d.weight.replace(',', '.'))
  return {
    name: d.name,
    muscle_group: d.muscle_group,
    sets: parseInt(d.sets, 10) || 1,
    reps: d.reps,
    weight_kg: Number.isFinite(w) ? w : null,
    notes: d.notes,
  }
}

/**
 * La charge n'est jamais figée au catalogue : elle est déduite de tes séances
 * précédentes (double progression), ou laissée vide si l'exercice est neuf.
 */
function catalogToDraft(c: CatalogExercise, sessions: MuscuSession[], bodyWeight?: number | null): ExoDraft {
  const charge = suggererCharge(sessions, { name: c.name, default_reps: c.default_reps }, bodyWeight ?? null)
  return {
    name: c.name,
    muscle_group: c.muscle_group,
    sets: String(c.default_sets),
    reps: c.default_reps,
    weight: charge.weight === null ? '' : String(charge.weight),
    notes: '',
    hint: charge.raison || undefined,
    hintTon: charge.ton,
  }
}

/** Dernière trace d'un exercice dans le journal (sessions triées par date desc). */
function lastExo(sessions: MuscuSession[], name: string): MuscuExo | null {
  const n = name.trim().toLowerCase()
  for (const s of sessions) {
    const found = s.exercises.find((e) => e.name.trim().toLowerCase() === n)
    if (found) return found
  }
  return null
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * @param sections Ce que le compte a le droit de voir. Sert à l'amorçage : les
 *   modèles de béhourd ne sont installés que chez qui en fait.
 */
export function Musculation({ sections = [] }: { sections?: SectionAutorisee[] }) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'journal' | 'types' | 'progression' | 'sommeil' | 'poids'>('journal')
  // Arrivée depuis la séance proposée sur l'accueil : on la recompose ici plutôt
  // que de la transporter. Elle serait sinon figée à l'instant du clic, et le
  // module afficherait une séance calculée sur un état du corps périmé.
  const { state } = useLocation()
  const navigate = useNavigate()
  const composerAuto = (state as { composer?: boolean } | null)?.composer === true
  const [templates, setTemplates] = useState<MuscuTemplate[] | null>(null)
  const [sessions, setSessions] = useState<MuscuSession[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogExercise[]>([])
  const [groups, setGroups] = useState<string[]>(MUSCLE_GROUPS_DEFAULT)
  // Poids de corps de l'utilisateur connecté : sert de charge aux exercices
  // au poids du corps (chacun le sien).
  const [bodyWeight, setBodyWeight] = useState<number | null>(null)
  // Pesées complètes : servent à déduire la balance énergétique, donc l'état de forme.
  const [weighins, setWeighins] = useState<Weighin[]>([])
  // Point faible à rattraper : pèse sur le générateur et sur l'alerte des négligés.
  const [focus, setFocus] = useState<FocusId[]>([FOCUS_PAR_DEFAUT])
  // Mode « spécial béhourd » : cumulable avec le point faible.
  const [behourd, setBehourd] = useState(false)
  // Créneau visé pour la séance composée.
  const [duree, setDuree] = useState(DUREE_PAR_DEFAUT)
  // Courbatures déclarées à la main, en plus du calcul automatique.
  const [courbatures, setCourbatures] = useState<Courbatures>({})
  // Profil morphologique : seul le sexe sert ici, pour la silhouette du mannequin.
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  // Intensités déclarées à la main, indexées par séance.
  const [intensites, setIntensites] = useState<Intensites>({})
  // Exercices déclarés faits en version douce, indexés par séance + exercice.
  const [douceurs, setDouceurs] = useState<Douceurs>({})
  // Nuits renseignées : elles décalent la récupération du mannequin.
  const [nuits, setNuits] = useState<Nuits>({})
  // Base des ressentis déclarés : elle servira à affiner le barème.
  const [observations, setObservations] = useState<Observations>([])
  // Les sorties de course. Elles ne rejoignent PAS le journal — elles ont le
  // leur — mais elles pèsent sur la récupération : courir travaille des muscles.
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!user) return
    try {
      // L'amorçage est une tâche de MAINTENANCE, pas une condition pour lire
      // ses séances. Quand il échouait, la page entière restait vide sur un
      // message de Postgres — alors que toutes les données étaient là, intactes.
      // On le signale et on charge quand même.
      await ensureSeeded(user.id, sections).catch((e: Error) => {
        console.warn('Amorçage du catalogue échoué :', e.message)
        setError(`Mise à jour du catalogue interrompue (${e.message}). Tes séances restent lisibles.`)
      })
      const [t, s, c, g, w, f, cb, pr, it, nu, ob, bh, du, dx, so] = await Promise.all([
        listTemplates(user.id),
        listSessions(user.id),
        listCatalog(user.id),
        loadMuscleGroups(user.id),
        listWeighins(user.id).catch(() => []),
        loadFocus(user.id).catch(() => [FOCUS_PAR_DEFAUT]),
        loadCourbatures(user.id).catch(() => ({})),
        loadProfil(user.id).catch(() => PROFIL_DEFAUT),
        loadIntensites(user.id).catch(() => ({}) as Intensites),
        loadNuits(user.id).catch(() => ({}) as Nuits),
        loadObservations(user.id).catch(() => [] as Observations),
        loadBehourd(user.id).catch(() => false),
        loadDuree(user.id).catch(() => DUREE_PAR_DEFAUT),
        loadDouceurs(user.id).catch(() => ({}) as Douceurs),
        // Un compte sans la course n'a pas de sorties : on ne demande rien.
        sections.includes('course') ? listSorties(user.id).catch(() => [] as Sortie[]) : [],
      ])
      setTemplates(t)
      setSessions(s)
      setCatalog(c)
      setGroups(g)
      setBodyWeight(w[0]?.weight_kg ?? null)
      setWeighins(w)
      setFocus(f)
      setCourbatures(cb)
      setProfil(pr)
      // Purge les séances disparues : sinon le KV grossit sans jamais se vider.
      setIntensites(nettoyerIntensites(it, new Set(s.map((x) => x.id))))
      setDouceurs(nettoyerDouceurs(dx, new Set(s.map((x) => x.id))))
      setNuits(nu)
      setObservations(ob)
      setBehourd(bh)
      setDuree(du)
      setSorties(so)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">💪 Musculation</h1>
        <p className="text-sm text-muted">Journal · séances types · sommeil · poids</p>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <SubTabs
        tabs={[
          { id: 'journal', label: '📒 Journal' },
          { id: 'types', label: '📋 Séances types' },
          { id: 'progression', label: '📈 Progression' },
          { id: 'sommeil', label: '😴 Sommeil' },
          { id: 'poids', label: '⚖️ Poids' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'poids' ? (
        <Poids />
      ) : tab === 'sommeil' ? (
        <Sommeil userId={user?.id ?? ''} nuits={nuits} onChange={setNuits} />
      ) : templates === null || sessions === null ? (
        <div className="animate-pulse text-sm text-muted">Chargement…</div>
      ) : tab === 'progression' ? (
        <div className="space-y-3">
          <ProgressTab progress={exerciseProgress(sessions)} />
          <NeglectedMuscles
            loads={chargesCourantes([...(sessions ?? []), ...sortiesEnSeances(sorties)], courbatures, nuits)}
            focus={focus}
          />
          {/* La base des ressentis vit ici et non dans le journal : c'est de la
              donnée d'analyse, au même titre que les courbes de progression. */}
          <ObservationsCard observations={observations} />
        </div>
      ) : tab === 'journal' ? (
        <Journal
          pourLaRecup={[...(sessions ?? []), ...sortiesEnSeances(sorties)]}
          composerAuto={composerAuto}
          // Consommée une fois : sans ça, revenir en arrière ou rafraîchir
          // relancerait une composition qu'on n'a pas demandée.
          onComposeConsomme={() => navigate('.', { replace: true, state: null })}
          userId={user?.id ?? ''}
          sessions={sessions}
          templates={templates}
          catalog={catalog}
          bodyWeight={bodyWeight}
          weighins={weighins}
          groups={groups}
          focus={focus}
          courbatures={courbatures}
          nuits={nuits}
          observations={observations}
          onObservations={(next) => {
            setObservations(next)
            if (user) saveObservations(user.id, next).catch(() => {})
          }}
          sexe={profil.sex}
          intensites={intensites}
          onIntensite={setIntensites}
          douceurs={douceurs}
          onDouceurs={setDouceurs}
          onCourbatures={(next) => {
            setCourbatures(next)
            if (user) saveCourbatures(user.id, next).catch(() => {})
          }}
          onFocus={(ids) => {
            setFocus(ids)
            if (user) saveFocus(user.id, ids).catch(() => {})
          }}
          behourd={behourd}
          onBehourd={(on) => {
            setBehourd(on)
            if (user) saveBehourd(user.id, on).catch(() => {})
          }}
          duree={duree}
          onDuree={(m) => {
            setDuree(m)
            if (user) saveDuree(user.id, m).catch(() => {})
          }}
          onChange={reload}
        />
      ) : (
        <TypesTab
          userId={user?.id ?? ''}
          templates={templates}
          catalog={catalog}
          groups={groups}
          onChange={reload}
          onGroups={setGroups}
        />
      )}
    </div>
  )
}

// ── Journal des séances ──────────────────────────────────────────────────────

interface SessionDraft {
  id?: string
  date: string
  name: string
  duration: string
  notes: string
  template_id: string | null
  exos: ExoDraft[]
  /** Intensité déclarée — null tant que tu ne t'es pas prononcé. */
  intensite: IntensiteId | null
}

function Journal({
  userId,
  sessions,
  pourLaRecup,
  templates,
  catalog,
  groups,
  bodyWeight,
  weighins,
  focus,
  onFocus,
  behourd,
  onBehourd,
  duree,
  onDuree,
  courbatures,
  nuits,
  observations,
  onObservations,
  onCourbatures,
  intensites,
  onIntensite,
  douceurs,
  onDouceurs,
  sexe,
  onChange,
  composerAuto,
  onComposeConsomme,
}: {
  userId: string
  sessions: MuscuSession[]
  templates: MuscuTemplate[]
  catalog: CatalogExercise[]
  groups: string[]
  bodyWeight: number | null
  weighins: Weighin[]
  focus: FocusId[]
  onFocus: (ids: FocusId[]) => void
  /** Mode « spécial béhourd », cumulable avec le point faible. */
  behourd: boolean
  onBehourd: (on: boolean) => void
  /** Créneau visé pour la séance composée, en minutes. */
  duree: number
  onDuree: (m: number) => void
  courbatures: Courbatures
  /** Nuits renseignées : elles décalent la récupération affichée. */
  nuits: Nuits
  /** Base des ressentis déclarés. */
  observations: Observations
  onObservations: (o: Observations) => void
  onCourbatures: (c: Courbatures) => void
  /** Intensités déclarées, indexées par séance. */
  intensites: Intensites
  onIntensite: (i: Intensites) => void
  /** Exercices déclarés faits en version douce, indexés par séance + exercice. */
  douceurs: Douceurs
  onDouceurs: (d: Douceurs) => void
  /** Silhouette du mannequin — déclarée dans Poids › profil. */
  sexe: Profil['sex']
  onChange: () => void
  /** Arrivée depuis l'accueil : composer la séance dès l'affichage. */
  composerAuto?: boolean
  onComposeConsomme?: () => void
  /**
   * Les séances augmentées des sorties de course, converties.
   *
   * Uniquement pour la RÉCUPÉRATION : courir travaille des muscles, et le
   * mannequin doit le savoir. Elles ne rejoignent ni le journal, ni le tonnage,
   * ni les records — elles ont leur propre écran pour ça.
   */
  pourLaRecup: MuscuSession[]
}) {
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [picking, setPicking] = useState<null | 'live' | 'manual'>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Lignes du journal, pour amener l'écran sur une séance depuis le mannequin.
  const lignes = useRef(new Map<string, HTMLLIElement>())
  // Séance composée automatiquement : on garde les exercices déjà proposés pour
  // que « autre proposition » ne resserve pas la même chose.
  const [suggest, setSuggest] = useState<{ session: SuggestedSession | null; exclude: Set<string> } | null>(null)
  // Séance en direct : reprise automatique si une séance est en cours (localStorage).
  const [live, setLive] = useState<LiveState | null>(() => loadLive())

  // Une seule source de vérité : la récup automatique, corrigée du sommeil puis
  // des courbatures déclarées. La composition vit dans lib/charges.
  //
  // Les sorties de course y entrent CONVERTIES en séances, et seulement ici :
  // elles pèsent sur la récupération sans jamais rejoindre le journal, ni le
  // tonnage, ni les records — elles ont leur propre écran pour ça.
  const loads = chargesCourantes(pourLaRecup, courbatures, nuits)
  // État de forme : charge d'entraînement + balance énergétique déduite du poids.
  // C'est lui qui dicte le volume et les charges de la séance proposée.
  const forme = evaluerForme(sessions, weighins)

  /**
   * Ouvre une séance vierge sur un exercice choisi depuis la fiche d'un muscle.
   * Le catalogue fait foi : c'est lui qui porte le format et les groupes de
   * l'utilisateur, éventuellement modifiés.
   */
  function ouvrirSurExercice(name: string) {
    const c = catalog.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
    setDraft({
      date: today(),
      name: 'Séance',
      duration: '',
      intensite: null,
      notes: '',
      template_id: null,
      exos: [c ? rappelDraft(c) : { ...emptyExo(), name }],
    })
  }

  /** Charge et reps conseillées pour un exercice du catalogue. */
  function rappelDraft(c: CatalogExercise): ExoDraft {
    const last = lastExo(sessions, c.name)
    const base = catalogToDraft(c, sessions, bodyWeight)
    return last ? { ...base, reps: last.reps || base.reps } : base
  }

  /**
   * Ramène au journal, sur une séance déjà enregistrée.
   *
   * Le mannequin est plus bas dans la page que la liste : rouvrir la séance ne
   * suffit pas, il faut aussi y amener l'écran. La ligne n'existe dans le DOM
   * qu'après le rendu qui la déplie, d'où le passage par requestAnimationFrame.
   */
  function ouvrirSeance(id: string) {
    setOpenId(id)
    requestAnimationFrame(() => {
      lignes.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  /**
   * Enregistre une déclaration dans la base.
   *
   * On la construit AVANT de modifier les courbatures : `observationDepuisFiche`
   * a besoin de ce que le barème prévoyait, et il le retrouve en retirant la
   * correction déjà en place. Après modification, on comparerait le modèle à
   * lui-même et tout écart serait nul.
   */
  function noterRessenti(region: MuscleRegion, ajustement: number, pret: boolean) {
    const obs = observationDepuisFiche(
      region,
      reposParMuscle(loads)[region],
      ajustement,
      pret,
      new Date().toISOString(),
    )
    if (obs) onObservations(noterObservation(observations, obs))
  }

  /**
   * Déclare (ou retire) des courbatures SUR CE MUSCLE.
   *
   * Sur ce muscle et pas sur son libellé de groupe : c'est tout l'objet du
   * passage au muscle. La date vient de `reposParMuscle`, qui a déjà tranché
   * quelle séance compte pour ce muscle-là quand plusieurs libellés le couvrent
   * — la reprendre depuis un libellé aurait pu désigner l'autre séance, et la
   * déclaration serait née périmée.
   */
  function declarerCourbatures(region: MuscleRegion, extra: number) {
    const info = reposParMuscle(loads)[region]
    if (!info) return
    noterRessenti(region, extra, false)
    onCourbatures(declarerAjustement(courbatures, region, extra, info.dateSeance))
  }

  /** Déclare le muscle totalement remis, ou annule cette déclaration. */
  function declarerTotalementBon(region: MuscleRegion, pret: boolean) {
    const info = reposParMuscle(loads)[region]
    if (!info) return
    // Annuler n'est pas une observation : c'est le retrait d'une observation
    // précédente, pas un ressenti nouveau.
    if (pret) noterRessenti(region, 0, true)
    onCourbatures(declarerPret(courbatures, region, pret, info.dateSeance))
  }

  // Trente jours glissants, pas le mois calendaire : le 2 août, un compteur du
  // 1er au 31 affiche « 0 séance » alors que la semaine précédente en comptait
  // quatre. Le chiffre ne parlerait plus de ton entraînement, mais de la date.
  const recentes = seancesRecentes(sessions)
  const recentMin = recentes.reduce((sum, s) => sum + (s.duration_min ?? 0), 0)
  const recentTonnage = recentes.reduce((sum, s) => sum + sessionTonnage(s.exercises), 0)

  function startBlank() {
    if (picking === 'live') return startLive(null)
    setPicking(null)
    // Vierge veut dire vierge : aucune ligne. La ligne vide d'avant n'était pas
    // un point de départ mais un formulaire à moitié rempli — champs de séries,
    // de reps et de charge posés sur un exercice qui n'existe pas. Il ne reste
    // que « 🔍 Chercher un exercice », qui est la première chose qu'on fait.
    // Rien à filtrer au passage : l'enregistrement écartait déjà les lignes sans
    // nom, la ligne vide ne servait donc qu'à occuper l'écran.
    setDraft({ date: today(), name: 'Séance', duration: '', intensite: null, notes: '', template_id: null, exos: [] })
  }

  function startFromTemplate(tpl: MuscuTemplate) {
    if (picking === 'live') return startLive(tpl)
    setPicking(null)
    setDraft({
      date: today(),
      name: tpl.name,
      duration: tpl.duration_min ? String(tpl.duration_min) : '',
      intensite: null,
      notes: '',
      template_id: tpl.id,
      // Reps reprises de la dernière fois, charge conseillée par la progression.
      // Même filtre qu'en direct : une ligne sans nom du modèle n'en est pas une.
      exos: tpl.exercises.filter((e) => e.name.trim()).map((e) => {
        const last = lastExo(sessions, e.name)
        const charge = suggererCharge(sessions, { name: e.name, default_reps: e.reps }, bodyWeight)
        const base = exoToDraft(last ? { ...e, reps: last.reps || e.reps } : e)
        return {
          ...base,
          weight: charge.weight === null ? base.weight : String(charge.weight),
          hint: charge.raison || undefined,
          hintTon: charge.ton,
        }
      }),
    })
  }

  function startLive(tpl: MuscuTemplate | null) {
    setPicking(null)
    const state: LiveState = {
      startedAt: Date.now(),
      name: tpl?.name ?? 'Séance',
      template_id: tpl?.id ?? null,
      restSec: 90,
      notes: '',
      // Une ligne sans nom traîne parfois dans un modèle : elle occupe une
      // carte, se coche, et se perd à l'enregistrement puisque `finish` la
      // filtre. Elle n'a rien à faire dans une séance qui démarre.
      exos: (tpl?.exercises ?? []).filter((e) => e.name.trim()).map((e) => {
        const last = lastExo(sessions, e.name)
        const charge = suggererCharge(sessions, { name: e.name, default_reps: e.reps }, bodyWeight)
        const weight = charge.weight ?? e.weight_kg
        return {
          name: e.name,
          muscle_group: e.muscle_group,
          reps: last?.reps || e.reps,
          weight: weight === null ? '' : String(weight),
          hint: charge.raison || undefined,
          notes: '',
          done: Array(Math.max(1, e.sets)).fill(false),
        }
      }),
    }
    storeLive(state)
    setLive(state)
  }

  // ── Séance composée depuis l'état de récupération ─────────────────────────

  // Le réglage du générateur vit dans `composerSeance` : l'accueil compose la
  // même séance, et deux appels réglés à la main auraient fini par en proposer
  // deux différentes selon l'écran.
  const contexte = { catalog, sessions, weighins, bodyWeight, focus, behourd, duree, loads }

  function suggerer(exclude = new Set<string>()) {
    setPicking(null)
    setSuggest({ session: composerSeance({ ...contexte, exclude }), exclude })
  }

  // Une seule fois, à l'arrivée : les données sont là — le journal ne s'affiche
  // qu'une fois séances et catalogue chargés — et la demande est consommée dans
  // la foulée.
  useEffect(() => {
    if (!composerAuto) return
    suggerer()
    onComposeConsomme?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerAuto])

  function regenerer() {
    if (!suggest) return
    const next = new Set(suggest.exclude)
    for (const e of suggest.session?.exercises ?? []) next.add(e.exo.id)
    const session = composerSeance({ ...contexte, exclude: next })
    // Plus rien de neuf à proposer : on repart du catalogue complet.
    if (!session) suggerer(new Set())
    else setSuggest({ session, exclude: next })
  }

  function lancerSuggestion(live: boolean) {
    const s = suggest?.session
    if (!s) return
    // Les reps de la dernière fois si l'exercice est connu, sinon le format du
    // catalogue ; la charge vient de la progression calculée par le générateur.
    const lignes = s.exercises.map((x) => {
      const last = lastExo(sessions, x.exo.name)
      return {
        name: x.exo.name,
        muscle_group: x.exo.muscle_group,
        sets: Math.max(1, x.exo.default_sets),
        reps: last?.reps || x.exo.default_reps,
        weight: x.charge.weight === null ? '' : String(x.charge.weight),
        hint: x.charge.raison || undefined,
        hintTon: x.charge.ton,
        // Proposé à vide : la case arrive cochée, sinon la séance de
        // récupération coûterait de la récupération.
        doux: x.doux || undefined,
      }
    })
    setSuggest(null)
    if (!live) {
      setDraft({
        date: today(),
        name: s.name,
        // La durée estimée est pré-remplie : sans elle, la séance s'enregistre
        // sans durée et ne produit AUCUNE calorie — le calcul part du temps. Elle
        // reste modifiable, et c'est le but : tu corriges ce que tu as réellement
        // passé, et le compte de calories suit.
        duration: s.bilan.duree > 0 ? String(s.bilan.duree) : '',
        intensite: null,
        notes: '',
        template_id: null,
        exos: lignes.map((l) => ({ ...l, sets: String(l.sets), notes: '' })),
      })
      return
    }
    const state: LiveState = {
      startedAt: Date.now(),
      name: s.name,
      template_id: null,
      restSec: 90,
      notes: '',
      exos: lignes.map((l) => ({
        name: l.name,
        muscle_group: l.muscle_group,
        reps: l.reps,
        weight: l.weight,
        hint: l.hint,
        notes: '',
        done: Array(l.sets).fill(false),
      })),
    }
    storeLive(state)
    setLive(state)
  }

  function startEdit(s: MuscuSession) {
    setDraft({
      id: s.id,
      date: s.date,
      name: s.name,
      duration: s.duration_min ? String(s.duration_min) : '',
      intensite: s.intensite ?? null,
      notes: s.notes,
      template_id: s.template_id,
      exos: s.exercises.map(exoToDraft),
    })
  }

  if (live) {
    return (
      <LiveSession
        userId={userId}
        initial={live}
        catalog={catalog}
        groups={groups}
        sessions={sessions}
        bodyWeight={bodyWeight}
        onFinish={() => {
          setLive(null)
          onChange()
        }}
        onQuit={() => {
          clearLive()
          setLive(null)
        }}
      />
    )
  }

  if (draft) {
    return (
      <SessionEditor
        draft={draft}
        groups={groups}
        catalog={catalog}
        sessions={sessions}
        bodyWeight={bodyWeight}
        onCancel={() => setDraft(null)}
        onSave={async (d) => {
          const id = await saveSession(
            userId,
            {
              id: d.id,
              date: d.date,
              name: d.name,
              duration_min: parseInt(d.duration, 10) || null,
              notes: d.notes,
              template_id: d.template_id,
            },
            d.exos.filter((e) => e.name.trim()).map(draftToInput),
          )
          // Après la séance : une création n'a son identifiant qu'à ce moment-là.
          onIntensite(await saveIntensite(userId, id, d.intensite, intensites))
          onDouceurs(
            await saveDouceurs(
              userId,
              id,
              d.exos.filter((e) => e.doux && e.name.trim()).map((e) => e.name),
              douceurs,
            ),
          )
          setDraft(null)
          onChange()
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={`${FENETRE_STATS} derniers jours`} value={String(recentes.length)} sub="séances" />
        <StatCard
          label="Temps"
          value={recentMin ? `${Math.floor(recentMin / 60)}h${String(recentMin % 60).padStart(2, '0')}` : '—'}
          sub={`cumulé sur ${FENETRE_STATS} j`}
        />
        <StatCard
          label="Tonnage"
          value={recentTonnage ? fmtTonnage(recentTonnage) : '—'}
          sub={`soulevé sur ${FENETRE_STATS} j`}
        />
      </div>

      {picking ? (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">
              {picking === 'live' ? '▶️ Démarrer : quelle séance ?' : '✍️ Saisir : quelle séance ?'}
            </span>
            <button onClick={() => setPicking(null)} className="text-xs text-copper">
              Fermer
            </button>
          </div>
          {/* La séance vierge d'abord, les modèles ensuite : une séance saisie
              après coup part presque toujours de rien — on note ce qu'on a fait,
              on ne déroule pas un programme. En dernière case, il fallait
              parcourir toute la grille pour trouver le cas le plus fréquent. */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={startBlank} className="card p-2 text-left text-sm hover:shadow-lift">
              ✍️ <span className="font-semibold text-ink">Séance vierge</span>
              <div className="text-[11px] text-muted">repartir de zéro</div>
            </button>
            {templates.map((t) => (
              <button key={t.id} onClick={() => startFromTemplate(t)} className="card p-2 text-left text-sm hover:shadow-lift">
                <span className="mr-1">{t.icon}</span>
                <span className="font-semibold text-ink">{t.name}</span>
                <div className="text-[11px] text-muted">
                  {t.exercises.length} exos{t.duration_min ? ` · ${t.duration_min} min` : ''}
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted">💡 Les charges et reps sont pré-remplies depuis ta dernière séance.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setPicking('live')} className="btn-primary w-full py-3">
            ▶️ Démarrer une séance (en direct)
          </button>
          <button onClick={() => setPicking('manual')} className="btn-ghost w-full py-2 text-sm">
            ✍️ Saisir une séance après coup
          </button>
          <button onClick={() => suggerer()} className="btn-ghost w-full py-2 text-sm">
            {estModeRecup(focus)
              ? '🧊 Composer une séance de récupération'
              : '🧠 Composer une séance selon ma récup'}
          </button>
        </div>
      )}

      <FocusPicker
        value={focus}
        onChange={onFocus}
        behourd={behourd}
        onBehourd={onBehourd}
        duree={duree}
        onDuree={onDuree}
      />

      {suggest ? (
        <SuggestedSessionCard
          suggestion={suggest.session}
          forme={forme}
          onLive={() => lancerSuggestion(true)}
          onManual={() => lancerSuggestion(false)}
          onRegenerate={regenerer}
          onClose={() => setSuggest(null)}
        />
      ) : null}

      <RecuperationCard
        sessions={sessions}
        courbatures={courbatures}
        nuits={nuits}
        loads={loads}
        sexe={sexe}
        onSoreness={declarerCourbatures}
        onPret={declarerTotalementBon}
        onExercice={ouvrirSurExercice}
        onSeance={ouvrirSeance}
      />

      {sessions.length === 0 ? (
        <p className="text-center text-xs text-muted">Aucune séance enregistrée. Lance ta première ! 💪</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              ref={(el) => {
                if (el) lignes.current.set(s.id, el)
                else lignes.current.delete(s.id)
              }}
              className="card overflow-hidden"
            >
              <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="flex w-full items-center gap-3 p-3 text-left">
                <div className="w-16 shrink-0 text-center">
                  <div className="text-xl leading-none">{sessionEmoji(s, templates)}</div>
                  <div className="mt-0.5 text-xs font-bold text-copper">{frDate(s.date)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-ink">{nomSansEmoji(s.name)}</div>
                  <div className="text-xs text-muted">
                    {s.exercises.length} exo{s.exercises.length > 1 ? 's' : ''}
                    {s.duration_min ? ` · ${s.duration_min} min` : ''}
                    {sessionTonnage(s.exercises) > 0 ? ` · 🏋️ ${fmtTonnage(sessionTonnage(s.exercises))}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-muted">{openId === s.id ? '▾' : '▸'}</span>
              </button>

              {openId === s.id ? (
                <div className="space-y-2 border-t border-line/60 bg-bg/40 p-3">
                  <ul className="space-y-1.5">
                    {s.exercises.map((e) => (
                      <li key={e.id} className="text-sm">
                        <span className="font-semibold text-ink">{e.name}</span>
                        <span className="text-muted">
                          {' '}
                          — {e.sets}×{e.reps}
                          {e.weight_kg !== null ? ` @ ${e.weight_kg} kg` : ''}
                          {e.muscle_group ? ` · ${e.muscle_group}` : ''}
                        </span>
                        {e.notes ? <div className="text-xs italic text-muted">{e.notes}</div> : null}
                      </li>
                    ))}
                  </ul>
                  {sessionTonnage(s.exercises) > 0 ? (
                    <p className="text-xs font-semibold text-copper">
                      🏋️ Tonnage total : {fmtTonnage(sessionTonnage(s.exercises))} (séries × reps × charge)
                      {s.exercises.some((e) => distanceEnMetres(e.reps) !== null)
                        ? ` · ${METRES_PAR_REP} m = 1 rép.`
                        : ''}
                    </p>
                  ) : null}
                  {s.notes ? <p className="rounded-xl2 bg-white/5 p-2 text-xs text-muted">📝 {s.notes}</p> : null}
                  <div className="flex justify-end gap-3 text-xs">
                    <button onClick={() => startEdit(s)} className="font-semibold text-copper">
                      Modifier
                    </button>
                    <button
                      onClick={() => confirm('Supprimer cette séance ?') && deleteSession(s.id).then(onChange)}
                      className="text-muted hover:text-clay"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-xl font-extrabold text-ink">{value}</div>
      <div className="text-[10px] text-muted">{sub}</div>
    </div>
  )
}

// ── Éditeur de séance (journal) ──────────────────────────────────────────────

/**
 * Intensité déclarée de la séance.
 *
 * Le calcul automatique ne sait juger que la salle — tonnage et séries
 * rapportés à la durée. Sur une slackline ou un sparring, il n'a rien à
 * mesurer : la durée saisie est du temps de présence. Plutôt que de deviner un
 * rendement décroissant, on te laisse trancher. Ne rien cocher reste valide :
 * le barème automatique reprend la main.
 */
function IntensitePicker({
  value,
  onChange,
}: {
  value: IntensiteId | null
  onChange: (v: IntensiteId | null) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {INTENSITE_IDS.map((id) => {
          const it = INTENSITES[id]
          const actif = value === id
          return (
            <button
              key={id}
              // Recliquer sur le palier actif le retire : on peut revenir au calcul.
              onClick={() => onChange(actif ? null : id)}
              title={it.aide}
              className={`chip text-[11px] font-semibold transition ${
                actif ? 'bg-copper text-white' : 'bg-bg text-muted hover:text-ink'
              }`}
            >
              {it.emoji} {it.label}
              {it.coef !== 1 ? ` ×${it.coef.toLocaleString('fr-FR')}` : ''}
            </button>
          )
        })}
      </div>
      {/* La déclaration ne pèse pas que sur les calories : elle décale aussi la
          récupération sur le mannequin. Autant le dire ici — c'est là qu'on
          clique, pas sur la fiche du muscle trois écrans plus loin. */}
      <p className="text-[10px] text-muted">
        {value
          ? `${INTENSITES[value].aide} Remplace le calcul automatique des calories${
              INTENSITES[value].recup !== 0
                ? ` et compte ${fmtAjust(INTENSITES[value].recup)} de récupération sur les muscles moteurs`
                : ''
            }.`
          : 'Intensité non déclarée : le barème est déduit du tonnage et du rythme. À renseigner surtout pour la slackline, le bloc ou le béhourd, où la durée saisie n’est pas du temps d’effort.'}
      </p>
    </div>
  )
}

export function SessionEditor({
  draft,
  groups,
  catalog,
  sessions,
  bodyWeight,
  onCancel,
  onSave,
}: {
  draft: SessionDraft
  groups: string[]
  catalog: CatalogExercise[]
  sessions: MuscuSession[]
  bodyWeight: number | null
  onCancel: () => void
  onSave: (d: SessionDraft) => Promise<void>
}) {
  const [d, setD] = useState(draft)
  // Le cumul des durées propres aux exercices — la même règle que le générateur
  // emploie pour tenir un créneau d'une heure.
  const dureeDesExos = dureeLignes(
    d.exos
      .filter((e) => e.name.trim() && !estRessenti(e.name))
      .map((e) => ({ nom: e.name, sets: Math.max(1, parseInt(e.sets, 10) || 1), reps: e.reps })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave(d)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink">{d.id ? '✏️ Modifier la séance' : '🏋️ Nouvelle séance'}</h2>
        <button onClick={onCancel} className="text-sm font-semibold text-copper">
          Annuler
        </button>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <div className="card space-y-2 p-3">
        <input className="field" placeholder="Nom de la séance" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <div className="flex gap-2">
          <input className="field" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
            <input
              className="field w-20"
              type="number"
              inputMode="numeric"
              placeholder="durée"
              title="Durée totale de la séance, échauffement et repos compris"
              value={d.duration}
              onChange={(e) => setD({ ...d, duration: e.target.value })}
            />
            min au total
          </label>
        </div>
        {/* Laissée vide, la durée est déduite du cumul des exercices. On l'annonce
            plutôt que de la calculer en silence : c'est elle qui fera les
            calories, et la voir donne l'occasion de la corriger. La saisie reste
            prioritaire dès qu'elle est renseignée. */}
        {!parseInt(d.duration, 10) && dureeDesExos > 0 ? (
          <button
            type="button"
            onClick={() => setD({ ...d, duration: String(dureeDesExos) })}
            className="w-fit text-[11px] text-muted transition hover:text-copper"
            title="Cumul des durées propres aux exercices — toucher pour l’inscrire"
          >
            ⏱️ estimée à <b className="text-ink">{fmtDuree(dureeDesExos)}</b> d’après les exercices
          </button>
        ) : null}
        <IntensitePicker value={d.intensite} onChange={(intensite) => setD({ ...d, intensite })} />
        <div className="flex items-start gap-2">
          <textarea
            className="field"
            rows={2}
            placeholder="Notes sur la séance (ressenti, énergie, douleurs…)"
            value={d.notes}
            onChange={(e) => setD({ ...d, notes: e.target.value })}
          />
          <EmojiPicker
            value={emojiDuNom(d.name)}
            onChange={(emoji) => setD({ ...d, name: avecEmoji(d.name, emoji) })}
          />
        </div>
      </div>

      <ExoListEditor
        exos={d.exos}
        groups={groups}
        catalog={catalog}
        sessions={sessions}
        bodyWeight={bodyWeight}
        onChange={(exos) => setD({ ...d, exos })}
      />

      <RessentiSection
        value={d.exos.find((e) => estRessenti(e.name))?.muscle_group ?? ''}
        onChange={(groupes) => setD({ ...d, exos: majRessenti(d.exos, groupes) })}
      />

      {(() => {
        const t = sessionTonnage(d.exos.map(draftToInput))
        const distance = d.exos.some((e) => distanceEnMetres(e.reps) !== null)
        return t > 0 ? (
          <p className="text-center text-xs font-semibold text-copper">
            🏋️ Tonnage de la séance : {fmtTonnage(t)}
            {distance ? ` · ${METRES_PAR_REP} m = 1 rép.` : ''}
          </p>
        ) : null
      })()}

      <button onClick={save} disabled={busy} className="btn-primary w-full py-2.5">
        {busy ? '…' : 'Enregistrer la séance'}
      </button>
    </div>
  )
}

/** Choix d'emoji replié : fermé il ne montre que celui en cours. */
function EmojiPicker({ value, onChange }: { value: string | null; onChange: (emoji: string | null) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Emoji de la séance"
        className="flex h-[42px] w-11 items-center justify-center rounded-xl2 border border-line bg-bg text-xl"
      >
        {value ?? '🙂'}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-64 space-y-1.5 rounded-xl2 border border-line bg-card p-2 shadow-lift">
          {TPL_ICON_THEMES.map((grp) => (
            <div key={grp.theme} className="flex items-center gap-1.5">
              <span className="w-14 shrink-0 text-[9px] uppercase tracking-wide text-muted">{grp.theme}</span>
              <div className="flex flex-wrap gap-0.5">
                {grp.icons.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => {
                      onChange(ic)
                      setOpen(false)
                    }}
                    className={`rounded-lg px-1.5 py-0.5 text-lg ${value === ic ? 'bg-copper/20 ring-1 ring-copper' : ''}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="w-full rounded-lg bg-bg py-1 text-[11px] font-semibold text-muted hover:text-ink"
          >
            Automatique
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Ajoute, met à jour ou retire la ligne de ressenti d'une liste d'exercices. */
function majRessenti(exos: ExoDraft[], groupes: string): ExoDraft[] {
  const sans = exos.filter((e) => !estRessenti(e.name))
  if (!groupes.trim()) return sans
  return [
    ...sans,
    { name: RESSENTI_NAME, muscle_group: groupes, sets: '1', reps: '—', weight: '', notes: '' },
  ]
}

/** Bloc « zones sollicitées », pour les séances sans exercices chiffrés. */
function RessentiSection({ value, onChange }: { value: string; onChange: (groups: string) => void }) {
  return (
    <div className="card space-y-2 p-3">
      <h3 className="text-sm font-bold text-ink">🤕 Ressenti — zones sollicitées</h3>
      <RessentiPicker value={value} onChange={onChange} />
    </div>
  )
}

// ── Éditeur d'exercices (partagé journal / séances types) ───────────────────

function ExoListEditor({
  exos,
  groups,
  catalog,
  sessions = [],
  bodyWeight,
  onChange,
}: {
  exos: ExoDraft[]
  groups: string[]
  catalog: CatalogExercise[]
  /** Historique, pour proposer la charge. Vide dans l'éditeur de séance type. */
  sessions?: MuscuSession[]
  bodyWeight?: number | null
  onChange: (exos: ExoDraft[]) => void
}) {
  const update = (i: number, patch: Partial<ExoDraft>) =>
    onChange(exos.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const remove = (i: number) => onChange(exos.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= exos.length) return
    const next = [...exos]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Exercices</h3>
      {exos.map((e, i) => (
        <div key={i} className="card space-y-1.5 p-2.5">
          <div className="flex items-center gap-1.5">
            <input
              className="field"
              placeholder="Exercice (ex: Squat barre)"
              value={e.name}
              onChange={(ev) => update(i, { name: ev.target.value })}
            />
            <button onClick={() => move(i, -1)} disabled={i === 0} title="Monter" className="shrink-0 px-1 text-muted disabled:opacity-30">
              ↑
            </button>
            <button onClick={() => move(i, 1)} disabled={i === exos.length - 1} title="Descendre" className="shrink-0 px-1 text-muted disabled:opacity-30">
              ↓
            </button>
            <button onClick={() => remove(i)} title="Supprimer" className="shrink-0 px-1 text-muted hover:text-clay">
              ✕
            </button>
          </div>
          {estRessenti(e.name) ? (
            <RessentiPicker value={e.muscle_group} onChange={(v) => update(i, { muscle_group: v })} />
          ) : (
            <>
          <GroupPicker
            value={e.muscle_group}
            groups={groups}
            onChange={(v) => update(i, { muscle_group: v })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                className="field w-14"
                type="number"
                inputMode="numeric"
                min="1"
                value={e.sets}
                onChange={(ev) => update(i, { sets: ev.target.value })}
              />
              ×
            </label>
            <input
              className="field w-24"
              placeholder="reps ou 45s"
              title="Nombre de reps (ex: 8-10) ou temps (ex: 45s) pour le gainage"
              value={e.reps}
              onChange={(ev) => update(i, { reps: ev.target.value })}
            />
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                className="field w-20"
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="PdC"
                title="Charge en kg (vide = poids du corps)"
                value={e.weight}
                onChange={(ev) => update(i, { weight: ev.target.value })}
              />
              kg
            </label>
            {e.hint ? (
              <span className={`text-[11px] font-semibold ${TON_STYLE[e.hintTon ?? 'maintien'].classe}`}>
                {TON_STYLE[e.hintTon ?? 'maintien'].icone} {e.hint}
              </span>
            ) : null}
          </div>
          {/* La case n'apparaît que sur les exercices qui ONT une version douce
              — la bibliothèque le dit. La proposer partout laisserait croire
              qu'un squat allégé se compte comme de la récupération : il ne se
              compte pas, il reste un squat. */}
          {estAdaptable(e.name) ? (
            <button
              onClick={() => update(i, { doux: !e.doux })}
              aria-pressed={e.doux === true}
              title="Fait à vide, en amplitude, sans forcer : compte comme de la récupération au lieu de coûter des jours"
              className={`chip flex w-fit items-center gap-1 text-[11px] transition ${
                e.doux ? 'bg-sage/25 text-sage ring-1 ring-sage' : 'bg-bg text-muted'
              }`}
            >
              <span>🌙</span>
              Version douce
            </button>
          ) : null}
            </>
          )}
          <input
            className="field text-xs"
            placeholder="Notes sur l'exercice (machine, tempo, ressenti…)"
            value={e.notes}
            onChange={(ev) => update(i, { notes: ev.target.value })}
          />
        </div>
      ))}
      <ExercisePicker
        catalog={catalog}
        onPick={(c) => onChange([...exos, catalogToDraft(c, sessions, bodyWeight)])}
        onBlank={() => onChange([...exos, emptyExo()])}
      />
    </div>
  )
}

/**
 * Où on en est du bloc de préparation, en tête des séances types.
 *
 * En tête et non dans les notes de chaque modèle : la phase est une propriété
 * de la DATE, pas des séances. Répétée sur six modèles, elle aurait dû être
 * corrigée six fois le jour où l'échéance bouge — et elle aurait quand même
 * manqué là où on la cherche, c'est-à-dire en arrivant sur l'écran.
 */
function PhaseProtocole() {
  const etat = etatProtocole()
  if (etat.phase === 'apres') return null
  const couleur =
    etat.phase === 'taper' ? 'var(--plum)' : etat.phase === 'bloc' ? 'var(--copper)' : 'var(--sage-dark)'
  return (
    <div
      className="rounded-xl2 border-l-4 bg-card p-3"
      style={{ borderColor: `rgb(${couleur})` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink">{etat.titre}</span>
        <span className="shrink-0 text-[11px] text-muted">
          {etat.joursAvantJourJ > 0 ? `${etat.joursAvantJourJ} j avant l’échéance` : 'jour J'}
        </span>
      </div>
      <p className="mt-1 text-xs leading-snug text-muted">{etat.consigne}</p>
      {/* Le matériel du jour, à part : c'est lui qui dit quelles séances types
          sont réellement faisables maintenant, et il change de salle en salle
          sans que la phase bouge. */}
      <p className="mt-1 text-[11px] leading-snug text-muted/80">🏋️ {etat.salle.materiel}</p>
    </div>
  )
}

// ── Séances types (modèles éditables) ────────────────────────────────────────

interface TplDraft {
  id?: string
  name: string
  icon: string
  duration: string
  notes: string
  exos: ExoDraft[]
}

function TypesTab({
  userId,
  templates,
  catalog,
  groups,
  onChange,
  onGroups,
}: {
  userId: string
  templates: MuscuTemplate[]
  catalog: CatalogExercise[]
  groups: string[]
  onChange: () => void
  onGroups: (g: string[]) => void
}) {
  const [draft, setDraft] = useState<TplDraft | null>(null)

  function toDraft(t: MuscuTemplate, duplicate = false): TplDraft {
    return {
      id: duplicate ? undefined : t.id,
      name: duplicate ? `${t.name} (copie)` : t.name,
      icon: t.icon,
      duration: t.duration_min ? String(t.duration_min) : '',
      notes: t.notes,
      exos: t.exercises.map(exoToDraft),
    }
  }

  if (draft) {
    return (
      <TemplateEditor
        draft={draft}
        groups={groups}
        catalog={catalog}
        onCancel={() => setDraft(null)}
        onSave={async (d) => {
          await saveTemplate(
            userId,
            { id: d.id, name: d.name, icon: d.icon, duration_min: parseInt(d.duration, 10) || null, notes: d.notes },
            d.exos.filter((e) => e.name.trim()).map(draftToInput),
          )
          setDraft(null)
          onChange()
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <PhaseProtocole />

      <p className="text-xs text-muted">
        Tes modèles de séance : modifie-les librement, ils servent de base quand tu démarres une séance dans le
        journal.
      </p>

      <button
        onClick={() => setDraft({ name: '', icon: '🏋️', duration: '', notes: '', exos: [emptyExo()] })}
        className="btn-primary w-full py-2.5"
      >
        + Nouvelle séance type
      </button>

      {/* Repliée comme les deux autres : l'onglet s'ouvre sur trois titres et on
          déplie celui qu'on vient chercher, au lieu d'une liste de modèles qui
          pousse le catalogue et les groupes hors de l'écran. */}
      <Section title="📋 Mes séances types" subtitle={`${templates.length} modèles`} accent="#B87333">
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="card p-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-ink">{t.name}</div>
                <div className="text-xs text-muted">
                  {t.exercises.length} exos{t.duration_min ? ` · ${t.duration_min} min` : ''}
                  {t.exercises.length ? ` · ${summary(t.exercises)}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-3 text-xs">
              <button onClick={() => setDraft(toDraft(t))} className="font-semibold text-copper">
                Modifier
              </button>
              <button onClick={() => setDraft(toDraft(t, true))} className="text-muted hover:text-copper">
                Dupliquer
              </button>
              <button
                onClick={() => confirm(`Supprimer la séance type « ${t.name} » ?`) && deleteTemplate(t.id).then(onChange)}
                className="text-muted hover:text-clay"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
      </Section>

      <CatalogManager userId={userId} catalog={catalog} groups={groups} onChange={onChange} />

      <GroupsManager userId={userId} groups={groups} onGroups={onGroups} />

    </div>
  )
}

function summary(exos: MuscuExo[]): string {
  const gs = [...new Set(exos.map((e) => e.muscle_group).filter(Boolean))]
  return gs.slice(0, 3).join(', ') + (gs.length > 3 ? '…' : '')
}

function TemplateEditor({
  draft,
  groups,
  catalog,
  onCancel,
  onSave,
}: {
  draft: TplDraft
  groups: string[]
  catalog: CatalogExercise[]
  onCancel: () => void
  onSave: (d: TplDraft) => Promise<void>
}) {
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave(d)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink">{d.id ? '✏️ Modifier la séance type' : '📋 Nouvelle séance type'}</h2>
        <button onClick={onCancel} className="text-sm font-semibold text-copper">
          Annuler
        </button>
      </div>

      {error ? <div className="card border-clay/40 bg-clay/5 p-3 text-sm text-clay">{error}</div> : null}

      <div className="card space-y-2 p-3">
        <div className="space-y-1.5">
          {TPL_ICON_THEMES.map((grp) => (
            <div key={grp.theme} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-muted">{grp.theme}</span>
              <div className="flex flex-wrap gap-1">
                {grp.icons.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setD({ ...d, icon: ic })}
                    className={`rounded-lg px-2 py-1 text-lg ${d.icon === ic ? 'bg-copper/20 ring-1 ring-copper' : 'bg-bg'}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <input className="field" placeholder="Nom (ex: Push, Full body…)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            className="field w-20"
            type="number"
            inputMode="numeric"
            placeholder="durée"
            value={d.duration}
            onChange={(e) => setD({ ...d, duration: e.target.value })}
          />
          min (indicatif)
        </label>
        <textarea
          className="field"
          rows={2}
          placeholder="Notes (échauffement, consignes…)"
          value={d.notes}
          onChange={(e) => setD({ ...d, notes: e.target.value })}
        />
      </div>

      <ExoListEditor exos={d.exos} groups={groups} catalog={catalog} onChange={(exos) => setD({ ...d, exos })} />

      <button onClick={save} disabled={busy} className="btn-primary w-full py-2.5">
        {busy ? '…' : 'Enregistrer la séance type'}
      </button>
    </div>
  )
}

// ── Catalogue d'exercices types ──────────────────────────────────────────────

interface CatalogDraft {
  id?: string
  name: string
  muscle_group: string
  sets: string
  reps: string
  weight: string
  notes: string
}

function CatalogManager({
  userId,
  catalog,
  groups,
  onChange,
}: {
  userId: string
  catalog: CatalogExercise[]
  groups: string[]
  onChange: () => void
}) {
  const [draft, setDraft] = useState<CatalogDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const shown = query.trim()
    ? catalog.filter((c) => normalizeName(c.name).includes(normalizeName(query.trim())))
    : catalog

  async function save() {
    if (!draft || !draft.name.trim()) return
    setBusy(true)
    try {
      await saveCatalogExercise(userId, {
        id: draft.id,
        name: draft.name,
        muscle_group: draft.muscle_group,
        default_sets: parseInt(draft.sets, 10) || 3,
        default_reps: draft.reps,
        default_weight_kg: null, // la charge se saisit à la séance, pas au catalogue
        notes: draft.notes,
      })
      setDraft(null)
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="📚 Catalogue d'exercices" subtitle={`${catalog.length} exercices`} accent="#B87333">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-muted">
          Sélectionnables dans l'éditeur de séance. La charge se saisit pendant la séance.
        </p>
        <button
          onClick={() => setDraft({ name: '', muscle_group: '', sets: '3', reps: '10', weight: '', notes: '' })}
          className="shrink-0 text-xs font-semibold text-copper"
        >
          + Ajouter
        </button>
      </div>

      <input
        className="field mb-2"
        type="search"
        placeholder="🔍 Filtrer par nom…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {draft ? (
        <div className="space-y-1.5 rounded-xl2 border border-copper/40 bg-copper/5 p-2.5">
          <input
            className="field"
            placeholder="Nom de l'exercice"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus
          />
          <GroupPicker
            value={draft.muscle_group}
            groups={groups}
            onChange={(v) => setDraft({ ...draft, muscle_group: v })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              className="field w-14"
              type="number"
              inputMode="numeric"
              min="1"
              value={draft.sets}
              onChange={(e) => setDraft({ ...draft, sets: e.target.value })}
            />
            <input className="field w-24" placeholder="reps ou 45s" value={draft.reps} onChange={(e) => setDraft({ ...draft, reps: e.target.value })} />
          </div>
          <input className="field text-xs" placeholder="Notes (machine, consignes…)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !draft.name.trim()} className="btn-primary flex-1 py-1.5 text-sm">
              Enregistrer
            </button>
            <button onClick={() => setDraft(null)} className="btn-ghost px-3 py-1.5 text-sm">
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <ul className="mt-2 space-y-1">
        {shown.map((c) => (
          <li key={c.id} className="flex items-center gap-2 border-b border-line/40 pb-1 text-sm last:border-0">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-ink">{c.name}</span>
              <span className="text-xs text-muted">
                {' '}
                — {c.default_sets}×{c.default_reps}
                {c.muscle_group ? ` · ${c.muscle_group}` : ''}
              </span>
            </div>
            <button
              onClick={() =>
                setDraft({
                  id: c.id,
                  name: c.name,
                  muscle_group: c.muscle_group,
                  sets: String(c.default_sets),
                  reps: c.default_reps,
                  weight: '',
                  notes: c.notes,
                })
              }
              className="shrink-0 text-xs text-copper"
            >
              ✏️
            </button>
            <button
              onClick={() => confirm(`Retirer « ${c.name} » du catalogue ?`) && deleteCatalogExercise(c.id).then(onChange)}
              className="shrink-0 text-muted hover:text-clay"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── Groupes musculaires (prédéfinis mais modifiables) ────────────────────────

function GroupsManager({
  userId,
  groups,
  onGroups,
}: {
  userId: string
  groups: string[]
  onGroups: (g: string[]) => void
}) {
  const [adding, setAdding] = useState('')
  // Ce qu'on enregistre, ce sont les AJOUTS. Les libellés du défaut sont
  // toujours proposés, quoi qu'il y ait en base.
  const persos = new Set(groupesPersos(groups))

  async function save(ajouts: string[]) {
    onGroups(fusionnerGroupes(ajouts))
    await saveMuscleGroups(userId, ajouts)
  }

  return (
    <Section title="🎯 Groupes musculaires" subtitle={`${groups.length} groupes`} accent="#B87333">
      <div className="mb-2 flex justify-end">
        <button onClick={() => save([])} className="text-[11px] text-muted hover:text-copper">
          Retirer mes ajouts
        </button>
      </div>
      {/* Seuls les libellés AJOUTÉS portent une croix. Les autres décrivent des
          muscles qui existent : les retirer de la liste ne les faisait pas
          disparaître du corps, ça les rendait seulement impossibles à viser. */}
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const perso = persos.has(g)
          return (
            <span
              key={g}
              className={`chip flex items-center gap-1 ${perso ? 'bg-copper/15 text-copper' : 'bg-card text-muted'}`}
            >
              {g}
              {perso ? (
                <button
                  onClick={() => save(groupesPersos(groups).filter((x) => x !== g))}
                  title="Retirer cet ajout"
                  className="text-copper/60 hover:text-clay"
                >
                  ✕
                </button>
              ) : null}
            </span>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="field"
          placeholder="Ajouter un groupe (ex: Avant-bras)"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && adding.trim()) {
              save([...groupesPersos(groups), adding.trim()])
              setAdding('')
            }
          }}
        />
        <button
          onClick={() => {
            if (!adding.trim()) return
            save([...groupesPersos(groups), adding.trim()])
            setAdding('')
          }}
          disabled={!adding.trim() || groups.includes(adding.trim())}
          className="btn-primary shrink-0 px-4 py-2"
        >
          +
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted">Ces groupes alimentent le sélecteur « Groupe visé » des exercices.</p>
    </Section>
  )
}
