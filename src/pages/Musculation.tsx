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
import { appliquerComptage, comptageReglable, loadExclues, nettoyerExclues, saveExclue, type Exclues } from '../lib/comptage'
import { chargeTotale, partDuCorps, poidsDuCorpsPorte } from '../lib/effort'
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
import {
  declarerBlocage,
  loadBlocages,
  nettoyerBlocages,
  regionsBloquees,
  saveBlocages,
  type Blocages,
} from '../lib/blocage'
import { evaluerForme } from '../lib/forme'
import { chargesCourantes } from '../lib/charges'
import { listSorties, sortiesEnSeances, type Sortie } from '../lib/course'
import { DUREE_PAR_DEFAUT, dureeLignes, fmtDuree, loadDuree, saveDuree } from '../lib/duree'
import { composerSeance } from '../lib/prochaine'
import { avecEmoji, emojiDuNom, nomSansEmoji, renommerSiAuto } from '../lib/nommage'
import { SCORE_MAX, SCORE_MIN, scoreParDefaut } from '../lib/scoreExercice'
import { OUTILS, noteAvecOutil, outilDe } from '../lib/materiel'
import { useMonMateriel } from '../lib/useMonMateriel'
import { faisable } from '../lib/monMateriel'
import { remodeler, type Changement } from '../lib/remodeler'
import { AllurePicker } from '../components/AllurePicker'
import { loadAllures, nettoyerAllures, saveAllures, type Allures } from '../lib/allure'
import { buildSession } from '../lib/sessionBuilder'
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
import { BandeauSeance, LiveSession, clearLive, loadLive, storeLive, type LiveState } from './MusculationLive'
import {
  MUSCLE_GROUPS_DEFAULT,
  exerciseProgress,
  seancesRecentes,
  FENETRE_STATS,
  fmtTonnage,
  sessionTonnage,
  distanceEnMetres,
  RESSENTI_NAME,
  estAuTempsOuDistance,
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

// L'emoji choisi à la main vit en préfixe du nom de la séance : les trois
// fonctions qui le posent et le retirent sont dans lib/nommage, avec le
// renommage automatique qui doit s'appuyer sur la MÊME définition du préfixe.

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
  /** Allure déclarée — seulement pour les exercices au temps ou à la distance. */
  allure?: IntensiteId
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
    allure: e.allure,
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
  // Muscles mis au repos TOTAL, avec leur date de fin. Rien à voir avec les
  // courbatures : une courbature s'efface quand le muscle est retravaillé, un
  // blocage doit justement empêcher qu'il le soit.
  const [blocages, setBlocages] = useState<Blocages>({})
  // Profil morphologique : seul le sexe sert ici, pour la silhouette du mannequin.
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  // Intensités déclarées à la main, indexées par séance.
  const [intensites, setIntensites] = useState<Intensites>({})
  // Exercices déclarés faits en version douce, indexés par séance + exercice.
  const [douceurs, setDouceurs] = useState<Douceurs>({})
  // Allures déclarées sur les exercices au temps ou à la distance, même index.
  const [allures, setAllures] = useState<Allures>({})
  // Séances décochées : au journal, mais hors du mannequin.
  const [exclues, setExclues] = useState<Exclues>({})
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
      const [t, s, c, g, w, f, cb, bl, pr, it, nu, ob, bh, du, dx, al, ex, so] = await Promise.all([
        listTemplates(user.id),
        listSessions(user.id),
        listCatalog(user.id),
        loadMuscleGroups(user.id),
        listWeighins(user.id).catch(() => []),
        loadFocus(user.id).catch(() => [FOCUS_PAR_DEFAUT]),
        loadCourbatures(user.id).catch(() => ({})),
        loadBlocages(user.id).catch(() => ({}) as Blocages),
        loadProfil(user.id).catch(() => PROFIL_DEFAUT),
        loadIntensites(user.id).catch(() => ({}) as Intensites),
        loadNuits(user.id).catch(() => ({}) as Nuits),
        loadObservations(user.id).catch(() => [] as Observations),
        loadBehourd(user.id).catch(() => false),
        loadDuree(user.id).catch(() => DUREE_PAR_DEFAUT),
        loadDouceurs(user.id).catch(() => ({}) as Douceurs),
        loadAllures(user.id).catch(() => ({}) as Allures),
        loadExclues(user.id).catch(() => ({}) as Exclues),
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
      // Purgés à la lecture : un blocage expiré n'a plus rien à dire, et le
      // garder ferait grossir le KV d'un historique que personne ne lit.
      setBlocages(nettoyerBlocages(bl))
      setProfil(pr)
      // Purge les séances disparues : sinon le KV grossit sans jamais se vider.
      setIntensites(nettoyerIntensites(it, new Set(s.map((x) => x.id))))
      setDouceurs(nettoyerDouceurs(dx, new Set(s.map((x) => x.id))))
      setAllures(nettoyerAllures(al, new Set(s.map((x) => x.id))))
      setExclues(nettoyerExclues(ex, new Set(s.map((x) => x.id))))
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
            loads={chargesCourantes(
              [...(sessions ?? []), ...sortiesEnSeances(sorties)],
              courbatures,
              nuits,
              Date.now(),
              bodyWeight,
            )}
            focus={focus}
          />
          {/* La base des ressentis vit ici et non dans le journal : c'est de la
              donnée d'analyse, au même titre que les courbes de progression. */}
          <ObservationsCard observations={observations} />
        </div>
      ) : tab === 'journal' ? (
        <Journal
          pourLaRecup={[
            ...appliquerComptage(sessions ?? [], exclues),
            ...sortiesEnSeances(sorties),
          ]}
          exclues={exclues}
          onExclues={setExclues}
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
          allures={allures}
          onAllures={setAllures}
          onCourbatures={(next) => {
            setCourbatures(next)
            if (user) saveCourbatures(user.id, next).catch(() => {})
          }}
          blocages={blocages}
          onBlocages={(next) => {
            setBlocages(next)
            if (user) saveBlocages(user.id, next).catch(() => {})
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

export function Journal({
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
  blocages,
  onBlocages,
  intensites,
  onIntensite,
  douceurs,
  onDouceurs,
  allures,
  onAllures,
  exclues,
  onExclues,
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
  blocages: Blocages
  onBlocages: (b: Blocages) => void
  /** Intensités déclarées, indexées par séance. */
  intensites: Intensites
  onIntensite: (i: Intensites) => void
  /** Exercices déclarés faits en version douce, indexés par séance + exercice. */
  douceurs: Douceurs
  onDouceurs: (d: Douceurs) => void
  /** Allures déclarées sur les exercices au temps ou à la distance. */
  allures: Allures
  onAllures: (a: Allures) => void
  /** Séances décochées : au journal, mais hors du mannequin. */
  exclues: Exclues
  onExclues: (e: Exclues) => void
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
  // Plus qu'un seul mode d'ouverture manuelle. « En direct » était le second,
  // et il partait d'une page blanche : c'est le compositeur qui ouvre désormais
  // les séances chronométrées, à partir de ce que le mannequin sait.
  const [picking, setPicking] = useState<null | 'manual'>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Les séances précédentes sont repliées par défaut : le journal courant doit
  // tenir à l'écran. L'état n'est pas persisté — on le rouvre quand on en a
  // besoin, ce qui est justement l'usage.
  const [voirAnciennes, setVoirAnciennes] = useState(false)
  // Lignes du journal, pour amener l'écran sur une séance depuis le mannequin.
  const lignes = useRef(new Map<string, HTMLLIElement>())
  // Séance composée automatiquement : on garde les exercices déjà proposés pour
  // que « autre proposition » ne resserve pas la même chose.
  const [suggest, setSuggest] = useState<{ session: SuggestedSession | null; exclude: Set<string> } | null>(null)
  // Séance en direct : reprise automatique si une séance est en cours (localStorage).
  const [live, setLive] = useState<LiveState | null>(() => loadLive())
  // … et repliée : on retourne au journal, la séance continue, un bandeau la
  // ramène. Ce n'est pas un abandon — d'où un booléen d'affichage et non un
  // effacement.
  const [liveReduit, setLiveReduit] = useState(false)

  // Une seule source de vérité : la récup automatique, corrigée du sommeil puis
  // des courbatures déclarées. La composition vit dans lib/charges.
  //
  // Les sorties de course y entrent CONVERTIES en séances, et seulement ici :
  // elles pèsent sur la récupération sans jamais rejoindre le journal, ni le
  // tonnage, ni les records — elles ont leur propre écran pour ça.
  const loads = chargesCourantes(pourLaRecup, courbatures, nuits, Date.now(), bodyWeight)

  // Le journal se coupe à trente jours. Au-delà, une séance ne se relit plus,
  // elle se retrouve — et trente jours est déjà la fenêtre sur laquelle la page
  // raisonne (tonnage du mois, progression). `sessions` arrive de la plus
  // récente à la plus ancienne, l'ordre est donc conservé des deux côtés.
  const JOURS_JOURNAL = 30
  const limiteJournal = new Date(Date.now() - JOURS_JOURNAL * 86400000).toLocaleDateString('en-CA')
  const duMois = sessions.filter((s) => s.date >= limiteJournal)
  const precedentes = sessions.filter((s) => s.date < limiteJournal)
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

  /**
   * Met un muscle au repos total pour `heures`, ou lève le blocage à 0.
   *
   * Aucune séance d'origine n'est nécessaire, contrairement aux deux
   * déclarations au-dessus : une épaule peut faire mal sans avoir été
   * travaillée, et c'est même le cas le plus courant. Et ce n'est pas un
   * ressenti — rien n'est noté dans la base d'observations : celle-là décrit
   * comment le corps a réagi à une séance, pas une consigne qu'on lui donne.
   */
  function declarerBlocageMuscle(region: MuscleRegion, heures: number) {
    onBlocages(declarerBlocage(blocages, region, heures))
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


  // ── Séance composée depuis l'état de récupération ─────────────────────────

  // Le réglage du générateur vit dans `composerSeance` : l'accueil compose la
  // même séance, et deux appels réglés à la main auraient fini par en proposer
  // deux différentes selon l'écran.
  // Les muscles au repos total, recalculés à chaque rendu : un blocage a une
  // date de fin, et la garder figée dans un état ferait survivre l'exclusion
  // au-delà de son terme tant que la page n'est pas rechargée.
  const bloquees = regionsBloquees(blocages)
  const contexte = { catalog, sessions, weighins, bodyWeight, focus, behourd, duree, loads, bloquees }

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

  /**
   * Change la priorité d'un exercice depuis la séance proposée.
   *
   * Écriture optimiste : la carte répond au clic, l'enregistrement part
   * derrière. Une note est un geste qu'on fait en lisant, souvent deux ou trois
   * de suite — attendre l'aller-retour réseau à chaque clic rendrait le réglage
   * pénible, donc inutilisé, ce qui est exactement l'état dont on sort.
   *
   * L'exercice reste dans la séance du jour : la note pèse sur les compositions
   * SUIVANTES, et une liste qu'on est en train de lire n'a pas à se réordonner
   * sous les yeux.
   */
  async function noterExo(exo: CatalogExercise, score: number) {
    const note = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score))
    if (note === exo.score) return
    const poser = (valeur: number) =>
      setSuggest((prev) =>
        prev?.session
          ? {
              ...prev,
              session: {
                ...prev.session,
                exercises: prev.session.exercises.map((x) =>
                  x.exo.id === exo.id ? { ...x, exo: { ...x.exo, score: valeur } } : x,
                ),
              },
            }
          : prev,
      )
    poser(note)
    try {
      await saveCatalogExercise(userId, { ...exo, score: note })
      onChange()
    } catch {
      // L'écriture a échoué : on remet la note d'avant plutôt que de laisser la
      // carte annoncer un réglage qui n'existe pas en base.
      poser(exo.score)
    }
  }

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

  if (live && !liveReduit) {
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
        onReduire={() => setLiveReduit(true)}
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
          // Même règle qu'à « Terminé » : une séance dont le nom n'a pas été
          // écrit à la main prend celui de ses muscles. La saisie après coup part
          // presque toujours d'une « séance vierge » — ce titre-là ne survit pas
          // à l'enregistrement.
          const nom = renommerSiAuto(
            d.name,
            d.exos
              .filter((e) => e.name.trim())
              .map((e) => ({
                name: e.name,
                muscle_group: e.muscle_group,
                sets: parseInt(e.sets, 10) || 1,
              })),
          )
          const id = await saveSession(
            userId,
            {
              id: d.id,
              date: d.date,
              name: nom,
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
          // Les allures, même chemin : elles ne peuvent s'écrire qu'une fois la
          // séance identifiée, et seulement là où elles ont un sens.
          onAllures(
            await saveAllures(
              userId,
              id,
              d.exos
                .filter((e) => e.allure && e.name.trim() && estAuTempsOuDistance(e.reps))
                .map((e) => ({ nom: e.name, allure: e.allure as IntensiteId })),
              allures,
            ),
          )
          setDraft(null)
          onChange()
        }}
      />
    )
  }


  /**
   * Une ligne du journal.
   *
   * Extraite parce qu'elle est rendue par DEUX listes — les séances du mois et
   * les précédentes. Recopiée, la seconde aurait fini par perdre une case à
   * cocher ou un bouton au premier changement, sans que rien ne le signale.
   */
  function ligneSeance(s: MuscuSession) {
    return (
            <li
              key={s.id}
              ref={(el) => {
                if (el) lignes.current.set(s.id, el)
                else lignes.current.delete(s.id)
              }}
              className="card overflow-hidden"
            >
              <div className="flex items-center pr-3">
                <button
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                >
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
                </button>
                {/* Sur toutes les séances déjà faites, dépliées ou non : c'est
                    la liste entière qui devient réglable d'un coup d'œil, et une
                    séance retirée du calcul se repère sans ouvrir une seule
                    ligne. Rien sur une séance datée à venir — le moteur l'ignore
                    déjà, la case n'y changerait rien. */}
                {comptageReglable(s) ? (
                  <CaseMannequin
                    compte={!exclues[s.id]}
                    onChange={async (compte) => {
                      // Optimiste : la case répond au doigt, le mannequin bouge
                      // dans la foulée, l'écriture suit.
                      onExclues(compte
                        ? Object.fromEntries(Object.entries(exclues).filter(([k]) => k !== s.id))
                        : { ...exclues, [s.id]: true })
                      onExclues(await saveExclue(userId, s.id, compte, exclues))
                    }}
                  />
                ) : null}
                <button
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                  aria-label={openId === s.id ? 'Replier' : 'Déplier'}
                  className="shrink-0 py-3 pl-2 text-muted"
                >
                  {openId === s.id ? '▾' : '▸'}
                </button>
              </div>

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
    )
  }

  return (
    <div className="space-y-3">
      {/* La séance repliée, collée en haut tant qu'elle tourne. Le journal reste
          entièrement utilisable pendant ce temps — c'est tout l'objet. */}
      {live && liveReduit ? (
        <BandeauSeance
          onOuvrir={() => {
            // On relit la mémoire locale : la séance a continué de vivre
            // pendant qu'on était au journal, et l'objet gardé ici est périmé.
            setLive(loadLive())
            setLiveReduit(false)
          }}
        />
      ) : null}

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
              ✍️ Saisir : quelle séance ?
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
          {/* Un seul point d'entrée : composer. La séance « en direct » partait
              d'une page blanche qu'il fallait remplir soi-même, alors que
              l'application sait déjà quels muscles sont prêts — c'est même tout
              ce qu'elle fait. Deux boutons pour ouvrir une séance, dont un qui
              ignore le mannequin, c'était proposer de travailler à l'aveugle. */}
          <button onClick={() => suggerer()} className="btn-primary w-full py-3">
            {estModeRecup(focus) ? '🧊 Composer une séance de récupération' : '🧠 Composer une séance'}
          </button>
          <button onClick={() => setPicking('manual')} className="btn-ghost w-full py-2 text-sm">
            ✍️ Saisir une séance après coup
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
          onNoter={noterExo}
        />
      ) : null}

      <RecuperationCard
        journal={sessions}
        pourLaRecup={pourLaRecup}
        courbatures={courbatures}
        nuits={nuits}
        loads={loads}
        exclues={sessions.filter((x) => exclues[x.id]).length}
        poidsCorps={bodyWeight}
        sexe={sexe}
        onSoreness={declarerCourbatures}
        onPret={declarerTotalementBon}
        bloquees={bloquees}
        onBlocage={declarerBlocageMuscle}
        onExercice={ouvrirSurExercice}
        onSeance={ouvrirSeance}
      />

      {sessions.length === 0 ? (
        <p className="text-center text-xs text-muted">Aucune séance enregistrée. Lance ta première ! 💪</p>
      ) : (
        <>
          <ul className="space-y-2">{duMois.map((s) => ligneSeance(s))}</ul>

          {/* Les séances de plus d'un mois ne se relisent plus, elles se
              retrouvent. Elles descendent donc tout en bas, repliées derrière
              leur compte — le journal courant tient à l'écran, et l'historique
              reste à un clic. Trente jours, parce que c'est la fenêtre sur
              laquelle la page raisonne déjà (tonnage du mois, progression). */}
          {precedentes.length > 0 ? (
            <div className="pt-2">
              <button
                onClick={() => setVoirAnciennes((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl2 border border-line/60 px-3 py-2 text-left text-xs font-semibold text-muted"
              >
                <span>
                  {voirAnciennes ? '▾' : '▸'} Séances précédentes
                  <span className="ml-1.5 font-normal">
                    ({precedentes.length} · avant le {frDate(precedentes[0].date)})
                  </span>
                </span>
                <span className="font-normal">plus de 30 j</span>
              </button>
              {voirAnciennes ? (
                <ul className="mt-2 space-y-2 opacity-70">{precedentes.map((s) => ligneSeance(s))}</ul>
              ) : null}
            </div>
          ) : null}
        </>
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
  // Le matériel coché sous « chercher un exercice ». C'est le MÊME magasin
  // partagé : décocher la poulie là-haut doit se voir ici, sinon on remodèle
  // contre une liste que l'écran ne montre pas.
  const { outils } = useMonMateriel()
  const [changements, setChangements] = useState<Changement[]>([])
  // Ce que le matériel coché rend infaisable. La ligne de ressenti n'est pas un
  // exercice : elle n'a pas d'outil et ne se remplace pas.
  const infaisables = exos.filter((e) => e.name.trim() && !estRessenti(e.name) && !faisable(e.name, outils))

  /**
   * Remplace les exercices qu'on ne peut pas faire par leur équivalent.
   *
   * Même règle qu'en séance en direct (lib/remodeler), et volontairement le
   * même bouton au même endroit : sous le sélecteur de matériel, là où on vient
   * de décocher. Ici rien n'est « déjà fait » — une séance en préparation n'a
   * pas de série cochée —, donc tout est remplaçable.
   */
  function remodelerListe() {
    const { lignes, changements: faits } = remodeler(
      exos.map((e) => ({ ...e, faites: 0 })),
      catalog,
      outils,
      (ligne, par) => {
        const charge = suggererCharge(sessions, { name: par.name, default_reps: par.default_reps }, bodyWeight ?? null)
        return {
          ...ligne,
          name: par.name,
          muscle_group: par.muscle_group,
          sets: String(par.default_sets),
          reps: par.default_reps,
          weight: charge.weight === null ? '' : String(charge.weight),
          hint: charge.raison || undefined,
          hintTon: charge.ton,
        }
      },
    )
    setChangements(faits)
    onChange(lignes.map(({ faites: _faites, ...e }) => e as ExoDraft))
  }

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
            {/* La pastille PDC : ce que le mouvement fait porter au corps, déjà
                rempli et jamais à saisir. Le champ à côté ne reçoit QUE ce qu'on
                ajoute — kettlebells, disque, barre. Les deux vivaient confondus
                dans un seul champ, et la charge d'une fente marchée avec deux
                kettlebells de 12 kg valait 24 kg pour un homme de 102. */}
            {poidsDuCorpsPorte(e.name, bodyWeight ?? null) > 0 ? (
              <span
                className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-muted"
                title={`Poids du corps déplacé par ce mouvement (${Math.round(partDuCorps(e.name) * 100)} % de ${bodyWeight} kg)`}
              >
                PDC {poidsDuCorpsPorte(e.name, bodyWeight ?? null)} kg
              </span>
            ) : null}
            <label className="flex items-center gap-1 text-xs text-muted">
              {poidsDuCorpsPorte(e.name, bodyWeight ?? null) > 0 ? '+' : null}
              <input
                className="field w-20"
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder={poidsDuCorpsPorte(e.name, bodyWeight ?? null) > 0 ? 'lest' : 'kg'}
                title="Ce que tu AJOUTES en kg : haltères, kettlebells, disque, barre. Le poids du corps est déjà compté à côté."
                value={e.weight}
                onChange={(ev) => update(i, { weight: ev.target.value })}
              />
              kg
            </label>
            {/* Le total, dit une fois : c'est lui que le mannequin lit. */}
            {poidsDuCorpsPorte(e.name, bodyWeight ?? null) > 0 && parseFloat(e.weight.replace(',', '.')) > 0 ? (
              <span className="text-[11px] font-semibold text-copper">
                = {Math.round(chargeTotale({ name: e.name, weight_kg: parseFloat(e.weight.replace(',', '.')) }, bodyWeight ?? null) * 10) / 10} kg
              </span>
            ) : null}
            {e.hint ? (
              <span className={`text-[11px] font-semibold ${TON_STYLE[e.hintTon ?? 'maintien'].classe}`}>
                {TON_STYLE[e.hintTon ?? 'maintien'].icone} {e.hint}
              </span>
            ) : null}
          </div>
          {/* Mesuré en temps ou en distance : la charge ne dit rien de l'effort.
              Trente secondes de rameur en récupération et trente secondes à
              fond pesaient exactement pareil sur le mannequin. */}
          {estAuTempsOuDistance(e.reps) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted">Allure</span>
              <AllurePicker
                value={e.allure ?? null}
                onChange={(allure) => update(i, { allure: allure ?? undefined })}
              />
            </div>
          ) : null}
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

      {/* REMODELER, juste sous le sélecteur de matériel : c'est là qu'on vient
          de décocher la poulie, c'est donc là qu'on doit pouvoir dire « alors
          remplace-les ». Le bouton n'apparaît que s'il y a quelque chose à
          remplacer — un bouton toujours visible qui ne fait rien la moitié du
          temps n'apprend rien de ce qu'il fait. */}
      {infaisables.length > 0 ? (
        <div className="card space-y-1.5 border-copper/40 p-3">
          <p className="text-[11px] text-muted">
            {infaisables.length} exercice{infaisables.length > 1 ? 's' : ''} de cette séance demande
            {infaisables.length > 1 ? 'nt' : ''} du matériel que tu n'as pas coché :{' '}
            <b className="text-ink">
              {[...new Set(infaisables.map((e) => OUTILS[outilDe(e.name)].label))].join(', ')}
            </b>
            .
          </p>
          <button onClick={remodelerListe} className="btn-primary w-full py-2 text-sm">
            🔄 Remodeler la séance ({infaisables.length})
          </button>
        </div>
      ) : null}

      {changements.length > 0 ? (
        <ul className="space-y-0.5 px-1 text-[11px]">
          {changements.map((c, i) => (
            <li key={i} className={c.sort === 'remplace' ? 'text-sage-dark' : 'text-clay'}>
              {c.sort === 'remplace' ? '↪' : '✕'} {c.avant}
              {c.sort === 'remplace' ? ` → ${c.apres}` : ' — aucun équivalent avec ce matériel'}
            </li>
          ))}
        </ul>
      ) : null}
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

export function TemplateEditor({
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
  // Le matériel coché sous « chercher un exercice » : c'est LUI qui décide de
  // ce que la proposition a le droit d'employer. Une séance type composée avec
  // une poulie qu'on n'a pas chez soi n'est pas une séance type, c'est une
  // liste de courses.
  const { outils } = useMonMateriel()

  /**
   * Remplit le modèle avec une séance composée sous la contrainte du matériel.
   *
   * Sans historique : une séance TYPE n'est pas la séance d'aujourd'hui. Elle ne
   * doit dépendre ni des courbatures du moment ni des charges de la semaine —
   * sinon le modèle enregistré porterait l'état d'un jour précis, et on le
   * relirait des mois plus tard sans savoir lequel.
   */
  function proposer() {
    const s = buildSession(catalog, [], {
      count: 6,
      outils,
      dureeCible: parseInt(d.duration, 10) || undefined,
    })
    if (!s) {
      setError(
        outils.length
          ? 'Rien de composable avec ce matériel. Ajoute un outil sous « chercher un exercice ».'
          : 'Pas encore assez d’exercices exploitables au catalogue.',
      )
      return
    }
    setError(null)
    setD((prev) => ({
      ...prev,
      name: prev.name.trim() || s.name,
      exos: s.exercises.map((x) => ({
        name: x.exo.name,
        muscle_group: x.exo.muscle_group,
        sets: String(x.exo.default_sets),
        reps: x.exo.default_reps,
        weight: '',
        notes: '',
      })),
    }))
  }

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

      {/* La proposition, au-dessus de la liste : c'est par là qu'on commence
          quand on part de rien, et elle se relance autant de fois qu'on veut. */}
      <div className="card space-y-1.5 p-3">
        <button onClick={proposer} className="btn-ghost w-full py-2 text-sm">
          🧠 Proposer des exercices{outils.length ? ' avec mon matériel' : ''}
        </button>
        <p className="text-[11px] text-muted">
          {outils.length
            ? `Limité à : ${outils.map((o) => `${OUTILS[o].emoji} ${OUTILS[o].label}`).join(' · ')} — plus le poids du corps. Le matériel se coche sous « chercher un exercice ».`
            : 'Tout le catalogue. Coche ton matériel sous « chercher un exercice » pour t’y limiter — utile pour une séance à la maison.'}
        </p>
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
  /**
   * Note sur 5 : la priorité de l'exercice dans le générateur.
   *
   * `null` tant qu'on ne s'est pas prononcé — la note affichée suit alors le
   * barème, et donc les muscles qu'on coche. Un exercice qu'on vient d'étiqueter
   * « tout le dos » ne reste pas à 3 par inadvertance.
   */
  score: number | null
}

/**
 * La note sur 5, en cinq boutons.
 *
 * Cinq boutons et pas un champ numérique : la note n'a que cinq valeurs, elle se
 * lit d'un coup d'œil et se change au pouce. Le sens des extrêmes est écrit
 * dessous — une note sans échelle ne veut rien dire, et « 3 » ne se devine pas.
 */
function ScorePicker({
  value,
  auto,
  onChange,
}: {
  value: number
  /** La note vient du barème et n'a pas encore été choisie à la main. */
  auto?: boolean
  onChange: (n: number) => void
}) {
  const NIVEAUX: Record<number, string> = {
    1: 'à éviter',
    2: 'accessoire',
    3: 'correct',
    4: 'très bon',
    5: 'incontournable',
  }
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted">Priorité</span>
        {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => i + SCORE_MIN).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} sur ${SCORE_MAX} — ${NIVEAUX[n]}`}
            aria-pressed={n <= value}
            className={`text-lg leading-none transition ${n <= value ? 'text-copper' : 'text-muted/40'}`}
          >
            ★
          </button>
        ))}
        <span className="text-[11px] font-semibold text-ink">
          {value}/{SCORE_MAX}
        </span>
      </div>
      <p className="text-[11px] text-muted">
        {NIVEAUX[value]} — pèse sur le classement des séances composées.
        {auto ? ' Déduit des muscles et du mouvement tant que tu n’y touches pas.' : ''}
      </p>
    </div>
  )
}

/** Exporté pour le banc d'essai : la note sur 5 se vérifie sur le vrai écran. */
export function CatalogManager({
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
        score: draft.score ?? scoreParDefaut(draft.name, draft.muscle_group),
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
          onClick={() =>
            setDraft({ name: '', muscle_group: '', sets: '3', reps: '10', weight: '', notes: '', score: null })
          }
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
          {/* L'outil est déduit du nom et ouvre la note : il n'a pas à être
              écrit à la main, et il ne peut donc pas contredire le regroupement
              par poste que la séance composée applique. */}
          <div className="rounded-lg bg-bg px-2 py-1 text-[11px] text-muted">
            📝 <b className="text-ink">{noteAvecOutil(draft.name, draft.notes)}</b>
          </div>
          <input className="field text-xs" placeholder="Notes (réglages, consignes…) — l’outil s’ajoute tout seul" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          {/* La note suit les muscles cochés tant qu'on ne l'a pas touchée ; un
              clic sur une étoile fige le choix. */}
          <ScorePicker
            value={draft.score ?? scoreParDefaut(draft.name, draft.muscle_group)}
            auto={draft.score === null}
            onChange={(score) => setDraft({ ...draft, score })}
          />
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
              {/* La note d'abord, juste après le nom : c'est elle qui décide de
                  ce que le générateur propose, elle doit se voir en parcourant
                  la liste sans ouvrir une seule fiche. */}
              <span className="ml-1 whitespace-nowrap text-xs font-bold text-copper" title={`Priorité ${c.score}/${SCORE_MAX}`}>
                {c.score}/{SCORE_MAX}
              </span>
              <span className="text-xs text-muted">
                {' '}
                — {c.default_sets}×{c.default_reps}
                {c.muscle_group ? ` · ${c.muscle_group}` : ''}
              </span>
              {/* La note, outil en tête : c'est la ligne qu'on lit avant de
                  partir vers la machine. */}
              <div className="text-[11px] italic text-muted">{noteAvecOutil(c.name, c.notes)}</div>
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
                  score: c.score,
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

/**
 * « Cette séance compte-t-elle dans le mannequin ? »
 *
 * Une case, et rien d'autre : elle est posée à droite du nom de la séance, là
 * où on la cherche, et une phrase explicative à cet endroit aurait poussé le
 * nom à la ligne sur un écran de téléphone. Ce qu'elle fait se voit en la
 * cliquant — le mannequin change au-dessus —, ce qui vaut mieux qu'un texte
 * qui le décrirait.
 *
 * Le `title` et l'`aria-label` portent le sens pour la souris et pour un
 * lecteur d'écran : sans eux, une case nue n'est pas seulement discrète, elle
 * est muette.
 */
export function CaseMannequin({
  compte,
  onChange,
}: {
  compte: boolean
  onChange: (compte: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      checked={compte}
      onChange={(e) => onChange(e.target.checked)}
      title={compte ? 'Compte dans le mannequin' : 'Décochée : le mannequin ignore cette séance'}
      aria-label="Compte dans le mannequin"
      className="ml-1 mr-3 h-5 w-5 shrink-0 cursor-pointer accent-copper"
    />
  )
}

