import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useCapteurGps, gpsDisponible } from '../lib/capteurGps'
import { fmtDistance, fmtDuree, PRECISION_MAX_M } from '../lib/gps'
import { mesureDemarre } from '../lib/mesureEnCours'
import { loadTrajets, METRES_MIN, oublierTrajet, saveTrajet, vautLaPeine, type Trajet } from '../lib/trajets'

// Les trajets en moto, section à part entière.
//
// ── Pourquoi une section et pas une carte dans la musculation ───────────────
//
// Parce qu'un trajet en moto n'est pas un entraînement. Il ne brûle rien, il
// n'entre ni dans la charge ni dans la dépense, et il n'a rien à faire dans un
// écran dont tout le reste parle d'effort. Le rangement dit à quoi sert la
// chose : logé dans la musculation, il laissait croire qu'il y comptait.
//
// La marche, elle, a fait le chemin inverse : elle est un effort, donc elle est
// devenue une activité du catalogue, mesurable au GPS depuis la ligne de séance.
//
// ── Ce qui n'est pas enregistré ─────────────────────────────────────────────
//
// La trace. Ni départ, ni arrivée, ni chemin — seulement des kilomètres, une
// durée et une vitesse. Une trace de moto, c'est l'adresse du domicile, celle
// du travail, et les heures auxquelles la maison est vide.

export function Moto() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [trajets, setTrajets] = useState<Trajet[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const gps = useCapteurGps('moto')

  useEffect(() => {
    if (!userId) return
    loadTrajets(userId).then(setTrajets).catch(() => {})
  }, [userId])

  const enCours = gps.etat === 'accroche' || gps.etat === 'mesure' || gps.etat === 'perdu'

  // Tant que ça enregistre, le voile noir peut descendre : l'écran reste allumé
  // pour la même raison que pendant une mesure cardiaque.
  useEffect(() => {
    if (!enCours) return
    return mesureDemarre()
  }, [enCours])

  async function terminer() {
    const fini = gps.bilan
    const duree = gps.dureeS
    gps.arreter()
    if (!fini || !vautLaPeine(fini.metres, fini.segments)) {
      setMsg(`Rien d’enregistré : moins de ${METRES_MIN} m mesurés.`)
      return
    }
    try {
      setTrajets(
        await saveTrajet(
          userId,
          {
            date: new Date().toISOString(),
            mode: 'moto',
            metres: fini.metres,
            secondes: fini.secondes,
            dureeS: duree,
            vitesseMoyenneKmh: fini.vitesseMoyenneKmh,
            points: fini.points,
            segments: fini.segments,
          },
          trajets,
        ),
      )
      setMsg(`${fmtDistance(fini.metres)} enregistrés.`)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const total = trajets.reduce((s, t) => s + t.metres, 0)
  const flou = gps.precision !== null && gps.precision > PRECISION_MAX_M

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-lg font-bold text-ink">🏍️ Moto</h1>

      {!gpsDisponible() ? (
        <section className="card p-3">
          <p className="text-sm text-muted">Ce navigateur ne donne pas la position.</p>
        </section>
      ) : (
        <section className="card space-y-3 p-3">
          {enCours ? (
            <>
              <div className="text-center">
                <div className="text-5xl font-bold tabular-nums text-ink">
                  {gps.bilan ? fmtDistance(gps.bilan.metres) : '—'}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {fmtDuree(gps.dureeS)}
                  {gps.bilan?.vitesseMoyenneKmh
                    ? ` · ${String(gps.bilan.vitesseMoyenneKmh).replace('.', ',')} km/h de moyenne`
                    : ''}
                </div>
              </div>

              {/* L'état du récepteur, dit franchement : un compteur qui reste à
                  zéro pendant trente secondes passe pour une panne si rien
                  n'explique que le GPS cherche encore ses satellites. */}
              <p className="text-center text-[11px] leading-snug text-muted">
                {gps.etat === 'accroche' ? (
                  <>Le récepteur cherche les satellites — dix à trente secondes dehors.</>
                ) : flou ? (
                  <>
                    Position trop imprécise (± {Math.round(gps.precision as number)} m) : rien n’est compté tant qu’elle
                    ne descend pas sous {PRECISION_MAX_M} m.
                  </>
                ) : gps.precision !== null ? (
                  <>
                    ± {Math.round(gps.precision)} m · {gps.bilan?.segments ?? 0} mesures retenues sur{' '}
                    {gps.bilan?.points ?? 0} reçues
                  </>
                ) : (
                  <>En attente de la première position…</>
                )}
              </p>

              <button onClick={terminer} className="btn-primary w-full py-3">
                Terminer le trajet
              </button>
            </>
          ) : (
            <>
              <button onClick={gps.demarrer} className="btn-primary w-full py-3">
                🏍️ Démarrer un trajet
              </button>
              <p className="text-[11px] leading-snug text-muted/70">
                L’écran doit rester allumé : la position s’arrête dès que la page passe en arrière-plan. Il se
                verrouille et s’assombrit tout seul — touche le <b className="text-ink">☀</b> pour le rallumer.
                {' '}Aucun tracé n’est enregistré, seulement la distance et la durée.
              </p>
            </>
          )}
          {msg ? <p className="text-xs text-copper">{msg}</p> : null}
          {gps.erreur ? <p className="text-xs text-clay">{gps.erreur}</p> : null}
        </section>
      )}

      {trajets.length ? (
        <section className="card space-y-2 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">Trajets</h2>
            <span className="text-[11px] text-muted">
              {trajets.length} · {fmtDistance(total)} au total
            </span>
          </div>
          <ul className="space-y-1">
            {trajets.map((t) => (
              <li key={t.date} className="flex items-center gap-2 rounded-xl2 bg-white/[0.03] px-2 py-1.5">
                <span className="w-20 shrink-0 text-[11px] text-muted">
                  {new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <span className="flex-1 text-[11px] text-ink">
                  {fmtDistance(t.metres)} · {fmtDuree(t.dureeS)}
                  {t.vitesseMoyenneKmh ? ` · ${String(t.vitesseMoyenneKmh).replace('.', ',')} km/h` : ''}
                </span>
                <button
                  onClick={() => {
                    oublierTrajet(userId, t.date, trajets).then(setTrajets).catch(() => {})
                  }}
                  aria-label="Retirer ce trajet"
                  className="shrink-0 px-1 text-[11px] text-muted hover:text-clay"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
