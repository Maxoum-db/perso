import { useEffect, useState } from 'react'
import { useCapteurGps, gpsDisponible } from '../lib/capteurGps'
import { fmtDistance, fmtDuree, PRECISION_MAX_M, type ModeTrajet } from '../lib/gps'
import {
  loadTrajets,
  METRES_MIN,
  mode as modeDe,
  MODES,
  oublierTrajet,
  saveTrajet,
  titreSeance,
  vautLaPeine,
  type Trajet,
} from '../lib/trajets'
import { saveSession, type ExoInput } from '../lib/muscu'
import { mesureDemarre } from '../lib/mesureEnCours'
import { loadCardios, saveCardio } from '../lib/cardioSeance'
import { useCapteur, useCardioActif } from '../lib/capteurContexte'

// L'enregistreur de trajet.
//
// ── Pourquoi un seul écran pour la marche ET la moto ────────────────────────
//
// Le calcul est le même : des points, des filtres, une distance. Ce qui change
// tient en deux choses — le plafond de vitesse au-delà duquel un segment est
// une erreur du récepteur, et ce qu'on fait du résultat.
//
// Une marche rejoint le journal comme une séance : elle compte dans la dépense
// et dans la charge. Un trajet en moto reste un trajet — on ne brûle rien assis
// sur une selle, et le faire entrer dans le volume d'activité fausserait tout
// le reste. C'est la seule différence, et elle est faite à l'arrivée.

/**
 * La ligne d'exercice que porte une marche.
 *
 * Elle n'est pas décorative : c'est par le NOM que la dépense est calculée. La
 * cascade des coûts métaboliques reconnaît « Marche » et lui donne 3,5 — la
 * valeur du Compendium des activités physiques (2011, code 17190) pour une
 * marche à allure modérée sur terrain plat. « Marche rapide » vaut 4,3, et
 * garde sa propre entrée.
 *
 * Et quand le brassard était au bras, ce barème est de toute façon écarté au
 * profit de la dépense lue sur la fréquence cardiaque, qui est meilleure.
 */
function marcheCommeExercice(t: Trajet): ExoInput {
  return {
    name: 'Marche',
    muscle_group: 'Cardio:1, Soléaire:0.5, Gastrocnémiens:0.5, Grand fessier:0.4, Droit fémoral:0.4',
    sets: 1,
    reps: `${Math.max(1, Math.round(t.secondes / 60))} min`,
    weight_kg: null,
    notes: `${fmtDistance(t.metres)} au GPS.`,
  }
}

export function TrajetGps({ userId, onSeanceCreee }: { userId: string; onSeanceCreee?: () => void }) {
  const [mode, setMode] = useState<ModeTrajet>('marche')
  const [trajets, setTrajets] = useState<Trajet[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const gps = useCapteurGps(mode)
  const capteur = useCapteur()
  const cardioActif = useCardioActif()

  useEffect(() => {
    if (!userId) return
    loadTrajets(userId).then(setTrajets).catch(() => {})
  }, [userId])

  const enCours = gps.etat === 'accroche' || gps.etat === 'mesure' || gps.etat === 'perdu'

  // Tant que ça enregistre, le voile noir peut descendre : l'écran reste
  // allumé pour la même raison que pendant une mesure cardiaque, et les touches
  // accidentelles coûtent la même chose.
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
    const t: Trajet = {
      date: new Date().toISOString(),
      mode,
      metres: fini.metres,
      secondes: fini.secondes,
      dureeS: duree,
      vitesseMoyenneKmh: fini.vitesseMoyenneKmh,
      points: fini.points,
      segments: fini.segments,
    }
    try {
      // La marche devient une séance ; la moto, non. Tout le reste est commun.
      if (mode === 'marche') {
        const id = await saveSession(
          userId,
          {
            date: t.date.slice(0, 10),
            name: titreSeance(t),
            duration_min: Math.max(1, Math.round(duree / 60)),
            notes: `Enregistrée au GPS · ${fmtDistance(t.metres)}${t.vitesseMoyenneKmh ? ` · ${String(t.vitesseMoyenneKmh).replace('.', ',')} km/h` : ''}.`,
            template_id: null,
          },
          [marcheCommeExercice(t)],
        )
        t.sessionId = id
        // La fréquence cardiaque rejoint la séance comme n'importe quelle
        // autre, si le brassard était branché pendant la marche.
        if (cardioActif && capteur.bilan) {
          await saveCardio(userId, id, capteur.bilan, capteur.nom, await loadCardios(userId))
        }
        onSeanceCreee?.()
      }
      setTrajets(await saveTrajet(userId, t, trajets))
      setMsg(
        mode === 'marche'
          ? `${fmtDistance(t.metres)} — séance créée dans le journal.`
          : `${fmtDistance(t.metres)} enregistrés.`,
      )
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  if (!gpsDisponible()) {
    return (
      <section className="card p-3">
        <h2 className="text-sm font-bold text-ink">📍 Enregistrer un trajet</h2>
        <p className="mt-1 text-xs text-muted">Ce navigateur ne donne pas la position.</p>
      </section>
    )
  }

  return (
    <section className="card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">📍 Enregistrer un trajet</h2>
        {trajets.length && !enCours ? (
          <button onClick={() => setOuvert((x) => !x)} className="shrink-0 text-[10px] text-muted underline">
            {trajets.length} trajet{trajets.length > 1 ? 's' : ''}
          </button>
        ) : null}
      </div>

      {enCours ? (
        <EnCours gps={gps} mode={mode} onTerminer={terminer} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`rounded-xl2 border p-3 text-left transition ${
                  mode === m.id ? 'border-copper bg-copper/10' : 'border-line bg-white/5 hover:border-copper/50'
                }`}
              >
                <div className="text-sm font-bold text-ink">
                  {m.icone} {m.label}
                  {mode === m.id ? <span className="ml-1 text-copper">✓</span> : null}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-muted">{m.aide}</div>
              </button>
            ))}
          </div>
          <button onClick={gps.demarrer} className="btn-primary w-full py-3">
            {modeDe(mode).icone} Démarrer
          </button>
          <p className="text-[11px] leading-snug text-muted/70">
            L’écran doit rester allumé : la position s’arrête dès que la page passe en arrière-plan. Il se verrouille et
            s’assombrit tout seul — touche le <b className="text-ink">☀</b> pour le rallumer.
          </p>
        </>
      )}

      {msg ? <p className="text-xs text-copper">{msg}</p> : null}
      {gps.erreur ? <p className="text-xs text-clay">{gps.erreur}</p> : null}

      {ouvert && !enCours ? (
        <Historique
          trajets={trajets}
          onOublier={(date) => {
            oublierTrajet(userId, date, trajets).then(setTrajets).catch(() => {})
          }}
        />
      ) : null}

    </section>
  )
}

function EnCours({
  gps,
  mode,
  onTerminer,
}: {
  gps: ReturnType<typeof useCapteurGps>
  mode: ModeTrajet
  onTerminer: () => void
}) {
  const b = gps.bilan
  const flou = gps.precision !== null && gps.precision > PRECISION_MAX_M
  return (
    <>
      <div className="text-center">
        <div className="text-4xl font-bold tabular-nums text-ink">{b ? fmtDistance(b.metres) : '—'}</div>
        <div className="mt-1 text-xs text-muted">
          {fmtDuree(gps.dureeS)}
          {b?.vitesseMoyenneKmh ? ` · ${String(b.vitesseMoyenneKmh).replace('.', ',')} km/h de moyenne` : ''}
        </div>
      </div>

      {/* L'état du récepteur, dit franchement. Un compteur qui reste à zéro
          pendant trente secondes passe pour une panne si rien n'explique que
          le GPS cherche encore ses satellites. */}
      <p className="text-center text-[11px] leading-snug text-muted">
        {gps.etat === 'accroche' ? (
          <>Le récepteur cherche les satellites — dix à trente secondes dehors, davantage sous un toit.</>
        ) : flou ? (
          <>
            Position trop imprécise (± {Math.round(gps.precision as number)} m) : rien n’est compté tant qu’elle ne
            descend pas sous {PRECISION_MAX_M} m.
          </>
        ) : gps.precision !== null ? (
          <>
            ± {Math.round(gps.precision)} m · {b?.segments ?? 0} mesure{(b?.segments ?? 0) > 1 ? 's' : ''} retenue
            {(b?.segments ?? 0) > 1 ? 's' : ''} sur {b?.points ?? 0} reçues
          </>
        ) : (
          <>En attente de la première position…</>
        )}
      </p>

      <button onClick={onTerminer} className="btn-primary w-full py-3">
        Terminer {mode === 'marche' ? 'la marche' : 'le trajet'}
      </button>
    </>
  )
}

function Historique({ trajets, onOublier }: { trajets: Trajet[]; onOublier: (date: string) => void }) {
  return (
    <ul className="space-y-1">
      {trajets.map((t) => (
        <li key={t.date} className="flex items-center gap-2 rounded-xl2 bg-white/[0.03] px-2 py-1.5">
          <span className="w-16 shrink-0 text-[11px] text-muted">
            {new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
          <span className="shrink-0 text-[11px]">{modeDe(t.mode).icone}</span>
          <span className="flex-1 text-[11px] text-ink">
            {fmtDistance(t.metres)} · {fmtDuree(t.dureeS)}
            {t.vitesseMoyenneKmh ? ` · ${String(t.vitesseMoyenneKmh).replace('.', ',')} km/h` : ''}
          </span>
          <button
            onClick={() => onOublier(t.date)}
            aria-label="Retirer ce trajet"
            className="shrink-0 px-1 text-[11px] text-muted hover:text-clay"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
