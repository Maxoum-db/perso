import { useCallback, useEffect, useState } from 'react'
import { saveSession } from '../lib/muscu'
import { loadCardios, saveCardioPolar } from '../lib/cardioSeance'
import { demandeDesZones, messageApres, seanceAcreer, TYPES, type TypeConversion } from '../lib/conversionPolar'
import { RessentiPicker } from './RessentiPicker'
import {
  conversionsVivantes,
  loadConversions,
  saveConversion,
  type ConversionsPolar,
  delierPolar,
  etatPolar,
  ETAT_INCONNU,
  fmtDuree,
  listerSeancesPolar,
  oublierSeancePolar,
  synchroniserPolar,
  titreSeance,
  urlAutorisation,
  type EtatPolar,
  type SeanceImportee,
} from '../lib/polarLien'

// Polar Flow, à l'écran.
//
// Deux morceaux, et ils ne vivent pas au même endroit :
//
//   · le RÉGLAGE — relier, délier — va dans les paramètres. On le fait une
//     fois, et on n'y revient que pour défaire ;
//   · les SÉANCES rapportées vont dans le sport, avec le reste du cardio. C'est
//     là qu'on les regarde, et là qu'elles se relèvent — toutes seules à
//     l'ouverture, le bouton ne servant qu'à forcer.
//
// ── Ce que cette route rapporte, et ce qu'elle ne rapporte pas ──────────────
//
// Elle rapporte les séances enregistrées par le capteur seul (mode vert), une
// fois que l'application Polar les a synchronisées. Début, durée, fréquence
// moyenne et maximale, calories, charge Polar.
//
// Elle ne rapporte PAS le temps par zone — la route sans transaction ne le
// donne pas —, donc ces séances n'entrent pas dans le TRIMP de la semaine. Et
// elle ne rapportera jamais de sommeil ni de Nightly Recharge : ce sont des
// mesures de montre, et le Verity Sense n'en est pas une.

function useEtat() {
  const [etat, setEtat] = useState<EtatPolar>(ETAT_INCONNU)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const relire = useCallback(() => {
    setChargement(true)
    etatPolar()
      .then((e) => {
        setEtat(e)
        setErreur(null)
      })
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setChargement(false))
  }, [])

  useEffect(relire, [relire])
  return { etat, setEtat, chargement, erreur, setErreur, relire }
}

/** Le réglage : relier le compte à Polar Flow, ou le détacher. */
export function PolarFlowReglage() {
  const { etat, chargement, erreur, setErreur, relire } = useEtat()
  const [occupe, setOccupe] = useState(false)

  async function relier() {
    setOccupe(true)
    setErreur(null)
    try {
      // On quitte l'application : Polar demande l'autorisation sur son
      // domaine, puis renvoie sur /polar-callback.
      window.location.href = await urlAutorisation()
    } catch (e) {
      setErreur((e as Error).message)
      setOccupe(false)
    }
  }

  async function delier() {
    setOccupe(true)
    setErreur(null)
    try {
      await delierPolar()
      relire()
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div>
      <div className="text-xs font-bold text-ink">Polar Flow</div>
      <p className="mt-0.5 text-xs leading-snug text-muted">
        Pour les séances que le capteur enregistre <b className="text-ink">seul</b>, sans téléphone (mode vert). Elles
        remontent dans Polar Flow quand l’application Polar synchronise le capteur, et Couanac vient les y chercher.
        L’application Polar reste donc indispensable : c’est elle qui vide la mémoire du brassard.
      </p>

      {chargement ? (
        <p className="mt-2 animate-pulse text-xs text-muted">Lecture de l’état…</p>
      ) : !etat.configure ? (
        <p className="mt-2 rounded-xl2 border border-line/60 bg-white/[0.02] p-2 text-[11px] leading-snug text-muted">
          Pas encore configuré. Il faut d’abord créer un client sur{' '}
          <span className="text-ink">admin.polaraccesslink.com</span> et installer ses identifiants côté serveur —
          la marche à suivre est dans le README, section Polar.
        </p>
      ) : etat.lie ? (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-sage/20 text-[11px] text-sage">✓ Relié</span>
            <button onClick={delier} disabled={occupe} className="btn-ghost px-2 py-1 text-[11px] text-muted disabled:opacity-50">
              Détacher
            </button>
          </div>
          {etat.derniereSync ? (
            <p className="text-[11px] text-muted/80">
              Dernière synchronisation : {new Date(etat.derniereSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              {etat.note ? ` — ${etat.note}` : ''}
            </p>
          ) : (
            <p className="text-[11px] text-muted/80">
              Jamais relevé. La carte cardio du journal s’en charge toute seule à l’ouverture.
            </p>
          )}
        </div>
      ) : (
        <button onClick={relier} disabled={occupe} className="btn-ghost mt-2 px-2 py-1 text-xs text-copper disabled:opacity-50">
          {occupe ? 'Ouverture de Polar…' : '🔗 Relier mon compte Polar'}
        </button>
      )}

      {erreur ? <p className="mt-1 text-xs text-clay">{erreur}</p> : null}
    </div>
  )
}

// ── La relève automatique ───────────────────────────────────────────────────
//
// Un bouton qu'il faut penser à presser n'intègre rien « au fur et à mesure » :
// il intègre quand on y pense. La carte relève donc toute seule en s'affichant.
//
// Deux freins, et ils servent à des choses différentes :
//
//   · `DELAI_AUTO`, mesuré sur `last_sync_at` qui vient du SERVEUR. C'est la
//     bonne source : elle vaut pour tous les appareils à la fois, là où un
//     compteur rangé dans le navigateur laisserait le téléphone et l'ordinateur
//     relever chacun de son côté ;
//   · `dernierEssai`, une variable de MODULE, qui compte les tentatives et pas
//     les réussites. Sans elle, une relève qui échoue — Polar en panne, jeton
//     révoqué — ne toucherait pas `last_sync_at`, et chaque affichage de la
//     carte relancerait l'appel. Le frein serveur ne freine que ce qui marche.
//
// Elle survit aux remontages du composant et repart à zéro au rechargement de
// la page, ce qui est exactement la granularité voulue : on ne martèle pas une
// API tierce pendant qu'on navigue entre les onglets, et rouvrir l'application
// laisse retenter tout de suite.

const DELAI_AUTO = 30 * 60 * 1000

let dernierEssai = 0

/** Exporté pour les contrôles : sans ça on ne peut pas repartir d'un état neuf. */
export function _remettreAZeroAuto() {
  dernierEssai = 0
}

/**
 * Faut-il relever maintenant ?
 *
 * `derniereSync` à `null` veut dire « jamais » : on relève, c'est le premier
 * passage. Une date illisible est traitée comme jamais plutôt que comme
 * récente — se tromper dans ce sens fait une requête de trop, dans l'autre il
 * ne se passerait plus rien du tout.
 */
export function doitRelever(derniereSync: string | null, maintenant: number, essai = dernierEssai): boolean {
  if (maintenant - essai < DELAI_AUTO) return false
  if (!derniereSync) return true
  const t = Date.parse(derniereSync)
  if (!Number.isFinite(t)) return true
  return maintenant - t >= DELAI_AUTO
}

/**
 * Les séances rapportées, et le bouton qui va les chercher.
 *
 * Rend `null` tant que le compte n'est pas relié : un bloc « 0 séance
 * importée » chez quelqu'un qui n'a jamais relié son compte n'apprend rien, il
 * occupe un écran.
 */
export function PolarFlowSeances({
  userId,
  journal,
  onSeanceCreee,
}: {
  userId: string
  /** Les séances du journal — elles disent ce qui a déjà été converti. */
  journal: Array<{ id: string; date: string }>
  /** Prévient l'écran parent qu'une séance vient d'apparaître dans le journal. */
  onSeanceCreee?: () => void
}) {
  const { etat, chargement } = useEtat()
  const [seances, setSeances] = useState<SeanceImportee[]>([])
  const [conversions, setConversions] = useState<ConversionsPolar>({})
  const [occupe, setOccupe] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState(false)
  // La séance dont on est en train de choisir le type, s'il y en a une.
  const [choix, setChoix] = useState<string | null>(null)

  const recharger = useCallback(() => {
    if (!userId) return
    listerSeancesPolar(userId).then(setSeances).catch(() => {})
    loadConversions(userId).then(setConversions).catch(() => {})
  }, [userId])

  useEffect(recharger, [recharger])

  const vivantes = conversionsVivantes(conversions, new Set(journal.map((x) => x.id)))

  /**
   * Fait d'une séance relevée une vraie séance du journal.
   *
   * Le TYPE est demandé, il n'est pas deviné. Polar sait qu'il y a eu
   * quatre-vingt-dix minutes à 140 battements ; il ne sait pas si c'était du
   * béhourd, de la musculation ou une marche — et son champ « sport » dépend de
   * ce qu'on a sélectionné sur le brassard, quand on y a pensé. Deviner à
   * partir de là rangerait une séance sur trois au mauvais endroit, sans que
   * rien ne le signale.
   *
   * Ce que le type change : le titre et les lignes. La date, la durée et la
   * fréquence cardiaque viennent de Polar dans tous les cas.
   */
  async function convertir(s: SeanceImportee, type: TypeConversion, zones: string) {
    setOccupe(true)
    setMsg(null)
    try {
      const forme = seanceAcreer(type, s, zones)
      const id = await saveSession(
        userId,
        {
          date: s.date,
          name: forme.name,
          duration_min: s.dureeS !== null ? Math.max(1, Math.round(s.dureeS / 60)) : null,
          notes: forme.notes,
          template_id: null,
        },
        forme.lignes,
      )
      // La fréquence cardiaque rejoint la séance comme n'importe quelle autre,
      // pour qu'elle s'affiche au journal sans traitement de faveur.
      if (s.fcMoyenne !== null && s.fcMax !== null) {
        await saveCardioPolar(userId, id, { moyenne: s.fcMoyenne, max: s.fcMax }, s.appareil, await loadCardios(userId))
      }
      setConversions(await saveConversion(userId, s.id, id, conversions))
      setChoix(null)
      setMsg(messageApres(type))
      onSeanceCreee?.()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  const synchroniser = useCallback(
    async (auto = false) => {
      dernierEssai = Date.now()
      setOccupe(true)
      if (!auto) setMsg(null)
      try {
        const r = await synchroniserPolar()
        // Une relève automatique qui ne rapporte rien ne dit rien : afficher
        // « Rien à rapporter » sans qu'on ait demandé donnerait l'impression
        // d'un échec à chaque ouverture du journal. Une relève DEMANDÉE
        // répond toujours, même pour dire qu'il n'y avait rien.
        if (!auto || r.vues > 0) setMsg(r.note)
        recharger()
      } catch (e) {
        // En revanche une erreur se dit dans les deux cas : un jeton révoqué
        // doit se voir, pas se taire.
        setMsg((e as Error).message)
      } finally {
        setOccupe(false)
      }
    },
    [recharger],
  )

  // La relève d'elle-même, une fois l'état connu.
  useEffect(() => {
    if (chargement || !etat.configure || !etat.lie) return
    if (!doitRelever(etat.derniereSync, Date.now())) return
    void synchroniser(true)
  }, [chargement, etat.configure, etat.lie, etat.derniereSync, synchroniser])

  if (chargement || !etat.configure || !etat.lie) return null

  return (
    <div className="border-t border-line/40 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setOuvert((x) => !x)}
          className="flex min-w-0 items-center gap-1.5 text-left"
          aria-expanded={ouvert}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Enregistré par le capteur</span>
          <span className="text-[10px] text-copper">
            {seances.length} · {ouvert ? '▴' : '▾'}
          </span>
        </button>
        {/* `() => synchroniser()` et pas `synchroniser` : passé directement à `onClick`,
            React lui donnerait l'événement comme premier argument, et un
            événement est truthy — chaque clic serait pris pour une relève
            automatique et se tairait quand il n'y a rien. */}
        <button onClick={() => synchroniser()} disabled={occupe} className="btn-ghost px-2 py-1 text-[11px] text-copper disabled:opacity-50">
          {occupe ? 'Lecture…' : '⟳ Relever Polar'}
        </button>
      </div>

      {msg ? <p className="mt-1 text-[11px] text-copper">{msg}</p> : null}

      {ouvert ? (
        seances.length === 0 ? (
          <p className="mt-1.5 text-[11px] leading-snug text-muted">
            Rien d’importé. Enregistre une séance en mode vert, ouvre l’application Polar pour qu’elle vide le capteur,
            puis reviens relever ici.
          </p>
        ) : (
          <>
            <ul className="mt-1.5 space-y-1">
              {seances.map((s) => (
                <li key={s.id} className="rounded-xl2 bg-white/[0.03] px-2 py-1.5">
                  <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-muted">
                    {new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-ink">{titreSeance(s)}</span>
                    <span className="block text-[10px] text-muted/80">
                      {fmtDuree(s.dureeS)}
                      {s.fcMoyenne !== null ? ` · ❤️ ${s.fcMoyenne}` : ''}
                      {s.fcMax !== null ? ` (max ${s.fcMax})` : ''}
                      {s.calories !== null ? ` · ${s.calories} kcal` : ''}
                    </span>
                  </span>
                  {vivantes[s.id] ? (
                    <span className="chip shrink-0 bg-sage/20 text-[10px] text-sage">✓ au journal</span>
                  ) : (
                    <button
                      onClick={() => setChoix((x) => (x === s.id ? null : s.id))}
                      disabled={occupe}
                      aria-expanded={choix === s.id}
                      className="chip shrink-0 bg-bg text-[10px] text-copper disabled:opacity-50"
                    >
                      + journal
                    </button>
                  )}
                  <button
                    onClick={() => {
                      oublierSeancePolar(userId, s.id)
                        .then(recharger)
                        .catch((e: Error) => setMsg(e.message))
                    }}
                    aria-label="Retirer cette séance importée"
                    className="shrink-0 px-1 text-[11px] text-muted hover:text-clay"
                  >
                    ✕
                  </button>
                  </div>

                  {choix === s.id ? (
                    <ChoisirType
                      occupe={occupe}
                      onAnnuler={() => setChoix(null)}
                      onValider={(type, zones) => void convertir(s, type, zones)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10px] leading-snug text-muted/70">
              Pas de temps par zone sur ces séances : la route qui les rend ne le donne pas. Elles ne comptent donc pas
              dans la charge cardiaque de la semaine. « + journal » en fait une vraie séance — avec sa date, sa durée et
              sa fréquence cardiaque — qui pèse alors dans la charge et les statistiques ; les exercices restent à y
              mettre, Polar ne sait pas ce qu’on a soulevé.
            </p>
          </>
        )
      ) : null}
    </div>
  )
}

/**
 * Rattacher une mesure Polar à une séance déjà au journal.
 *
 * ── Le manque que ça comble ─────────────────────────────────────────────────
 *
 * Une séance en direct récupère sa fréquence toute seule : le brassard est
 * branché, le bilan se colle à la séance à « Terminer ». Mais une séance SAISIE
 * APRÈS COUP n'a rien, alors que le capteur, lui, a peut-être tout enregistré en
 * mode vert pendant ce temps-là. Les deux existaient côte à côte sans jamais se
 * rencontrer : la séance au journal, la mesure dans sa petite liste.
 *
 * ── Pourquoi le rapprochement n'est pas automatique ─────────────────────────
 *
 * Les séances du journal portent une DATE, pas une heure de début : la table
 * n'a pas de colonne pour ça. Deux séances le même jour ne peuvent donc pas
 * être départagées par le calcul, et rattacher la mauvaise mesure serait pire
 * que de ne rien rattacher — le chiffre aurait l'air juste.
 *
 * On propose donc les mesures du JOUR, avec leur heure, et c'est la personne
 * qui reconnaît la sienne. Un geste, et il ne peut pas se tromper tout seul.
 */
export function RattacherMesurePolar({
  userId,
  seance,
  onFait,
}: {
  userId: string
  seance: { id: string; date: string }
  onFait: () => void
}) {
  const [candidates, setCandidates] = useState<SeanceImportee[] | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  /**
   * Chargé à la DEMANDE, et c'est délibéré : ce bouton s'affiche sous chaque
   * séance sans cardio du journal. Charger la liste au rendu ferait une requête
   * par séance à l'ouverture de l'écran, pour une liste que l'on ne regarde
   * presque jamais.
   */
  async function ouvrir() {
    setOccupe(true)
    setMsg(null)
    try {
      const [toutes, deja] = await Promise.all([listerSeancesPolar(userId), loadConversions(userId)])
      // Le même jour, et pas déjà utilisée ailleurs : une mesure rattachée à
      // deux séances compterait deux fois dans la semaine.
      const prises = new Set(Object.keys(deja))
      setCandidates(toutes.filter((s) => s.date === seance.date && !prises.has(s.id)))
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  async function rattacher(s: SeanceImportee) {
    if (s.fcMoyenne === null || s.fcMax === null) {
      setMsg('Cette mesure n’a pas de fréquence moyenne — rien à rattacher.')
      return
    }
    setOccupe(true)
    try {
      await saveCardioPolar(userId, seance.id, { moyenne: s.fcMoyenne, max: s.fcMax }, s.appareil, await loadCardios(userId))
      await saveConversion(userId, s.id, seance.id, await loadConversions(userId))
      onFait()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  if (candidates === null) {
    return (
      <div>
        <button onClick={ouvrir} disabled={occupe} className="chip bg-bg text-[10px] text-copper disabled:opacity-50">
          {occupe ? 'Lecture…' : '❤️ Rattacher une mesure Polar'}
        </button>
        {msg ? <p className="mt-1 text-[10px] text-clay">{msg}</p> : null}
      </div>
    )
  }

  return (
    <div className="rounded-xl2 border border-line/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Mesures de ce jour</span>
        <button onClick={() => setCandidates(null)} className="text-[10px] text-muted hover:text-ink">
          Fermer
        </button>
      </div>
      {candidates.length === 0 ? (
        <p className="mt-1 text-[10px] leading-snug text-muted">
          Aucune mesure Polar disponible ce jour-là. Soit le capteur n’a rien enregistré, soit elle est déjà rattachée à
          une autre séance.
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {candidates.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => rattacher(s)}
                disabled={occupe}
                className="flex w-full items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-left disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{titreSeance(s)}</span>
                <span className="shrink-0 text-[10px] text-muted">
                  {fmtDuree(s.dureeS)}
                  {s.fcMoyenne !== null ? ` · ❤️ ${s.fcMoyenne}` : ' · pas de fréquence'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg ? <p className="mt-1 text-[10px] text-clay">{msg}</p> : null}
    </div>
  )
}

/**
 * Le choix du type, au moment de faire entrer une séance au journal.
 *
 * ── Pourquoi on demande, et pourquoi on ne devine pas ────────────────────────
 *
 * Polar sait qu'il y a eu quatre-vingt-dix minutes à 140 battements. Il ne sait
 * pas si c'était du béhourd, de la musculation ou une marche : son champ
 * « sport » ne vaut que ce qu'on a sélectionné sur le brassard, quand on y a
 * pensé — et le plus souvent on n'y pense pas, un brassard n'ayant pas d'écran
 * pour le rappeler.
 *
 * Deviner rangerait donc une séance sur trois au mauvais endroit, en silence.
 * Un toucher de plus coûte moins cher qu'une semaine de mannequin faussé.
 *
 * ── Les zones, tout de suite ────────────────────────────────────────────────
 *
 * Pour le béhourd, elles sont demandées ICI et pas après. Une séance de béhourd
 * sans sa ligne de ressenti ne nourrit ni le mannequin, ni le suivi par zone,
 * ni la récupération : elle ne pèse que par sa durée. La renvoyer à plus tard,
 * c'était la version d'avant, et « plus tard » veut dire jamais.
 *
 * Elles restent facultatives : on peut valider sans rien cocher si on ne se
 * souvient plus. Une ligne de ressenti vide vaut mieux qu'une séance abandonnée
 * dans la liste des non converties.
 */
function ChoisirType({
  occupe,
  onValider,
  onAnnuler,
}: {
  occupe: boolean
  onValider: (type: TypeConversion, zones: string) => void
  onAnnuler: () => void
}) {
  const [type, setType] = useState<TypeConversion | null>(null)
  const [zones, setZones] = useState('')
  const t = TYPES.find((x) => x.id === type)

  return (
    <div className="mt-2 space-y-2 border-t border-line pt-2">
      <div className="text-[10px] font-bold text-ink">C’était quoi ?</div>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((x) => (
          <button
            key={x.id}
            onClick={() => setType(x.id)}
            aria-pressed={type === x.id}
            className={`chip text-[11px] transition ${
              type === x.id ? 'bg-copper/25 text-copper ring-1 ring-copper' : 'bg-bg text-muted'
            }`}
          >
            {x.icone} {x.label}
          </button>
        ))}
      </div>

      {t ? <p className="text-[10px] leading-snug text-muted/80">{t.aide}</p> : null}

      {type && demandeDesZones(type) ? (
        <div>
          <div className="text-[10px] font-bold text-ink">Zones qui ont pris</div>
          <RessentiPicker value={zones} onChange={setZones} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => type && onValider(type, zones)}
          disabled={occupe || !type}
          className="chip bg-copper/20 text-[11px] text-copper disabled:opacity-40"
        >
          Créer la séance
        </button>
        <button onClick={onAnnuler} className="text-[11px] text-muted hover:text-clay">
          Annuler
        </button>
      </div>
    </div>
  )
}
