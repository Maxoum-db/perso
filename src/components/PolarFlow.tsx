import { useCallback, useEffect, useState } from 'react'
import {
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
export function PolarFlowSeances({ userId }: { userId: string }) {
  const { etat, chargement } = useEtat()
  const [seances, setSeances] = useState<SeanceImportee[]>([])
  const [occupe, setOccupe] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState(false)

  const recharger = useCallback(() => {
    if (!userId) return
    listerSeancesPolar(userId).then(setSeances).catch(() => {})
  }, [userId])

  useEffect(recharger, [recharger])

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
                <li key={s.id} className="flex items-center gap-2 rounded-xl2 bg-white/[0.03] px-2 py-1.5">
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
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10px] leading-snug text-muted/70">
              Pas de temps par zone sur ces séances : la route qui les rend ne le donne pas. Elles ne comptent donc pas
              dans la charge cardiaque de la semaine.
            </p>
          </>
        )
      ) : null}
    </div>
  )
}
