import { useEffect, useRef, useState } from 'react'
import { bluetoothDisponible, useCapteurCardio } from '../lib/capteurCardio'
import { bpmDesRr, rmssd } from '../lib/cardio'
import { saveRepos, type MesureRepos as Mesure } from '../lib/cardioSeance'

// La mesure au repos : fréquence de base et variabilité.
//
// ── Pourquoi deux minutes, assis, sans rien faire ───────────────────────────
//
// La variabilité (RMSSD) ne veut rien dire à l'effort : le cœur s'y cale, elle
// s'effondre, et le chiffre ne parle plus de récupération mais d'intensité.
// Elle ne se lit qu'au calme, et sur une fenêtre assez longue pour contenir
// quelques dizaines de battements.
//
// ── Et pourquoi le protocole compte plus que le chiffre ─────────────────────
//
// Debout ou assis, après un café ou au réveil, on ne mesure pas la même chose —
// l'écart entre deux postures dépasse largement l'écart entre deux semaines
// d'entraînement. Une valeur ne vaut donc que comparée à une autre prise DE LA
// MÊME FAÇON. C'est écrit à l'écran, parce que c'est la seule chose qui rend la
// mesure utile.

const DUREE_S = 120

export function MesureRepos({
  userId,
  derniere,
  onFini,
}: {
  userId: string
  derniere: Mesure | null
  onFini: (m: Mesure) => void
}) {
  const capteur = useCapteurCardio(null)
  const [enCours, setEnCours] = useState(false)
  const [reste, setReste] = useState(DUREE_S)
  const [msg, setMsg] = useState<string | null>(null)
  // Le compte à rebours vit dans un effet ; la conclusion a besoin des RR au
  // moment où il tombe, pas de ceux du rendu qui l'a lancé.
  const rrRef = useRef(capteur.rr)
  rrRef.current = capteur.rr

  useEffect(() => {
    if (!enCours) return
    const t = setInterval(() => setReste((r) => r - 1), 1000)
    return () => clearInterval(t)
  }, [enCours])

  useEffect(() => {
    if (!enCours || reste > 0) return
    setEnCours(false)
    const rr = rrRef.current
    const bpm = bpmDesRr(rr) ?? capteur.bpm
    if (bpm === null) {
      setMsg('Aucun battement reçu — le brassard était-il en place ?')
      return
    }
    const m: Mesure = { date: new Date().toISOString(), bpm, rmssd: rmssd(rr), intervalles: rr.length }
    saveRepos(userId, m)
      .then(() => {
        onFini(m)
        setMsg(
          m.rmssd === null
            ? 'Mesure gardée. Ce capteur n’envoie pas d’intervalles RR : pas de variabilité.'
            : 'Mesure gardée.',
        )
      })
      .catch((e: Error) => setMsg(e.message))
  }, [enCours, reste, capteur.bpm, userId, onFini])

  function demarrer() {
    capteur.remettreAZero()
    setMsg(null)
    setReste(DUREE_S)
    setEnCours(true)
  }

  if (!bluetoothDisponible()) {
    return (
      <p className="mt-1 text-xs leading-snug text-muted">
        Ce navigateur ne sait pas parler aux capteurs Bluetooth. Sur Android, ouvre Couanac dans Chrome.
      </p>
    )
  }

  return (
    <div>
      <p className="mt-0.5 text-xs leading-snug text-muted">
        Assis, immobile, deux minutes, sans parler. Toujours dans la même position et au même moment de la journée :
        entre deux postures, l’écart dépasse celui de deux semaines d’entraînement, et deux mesures prises autrement ne
        se comparent pas.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {capteur.etat === 'connecté' ? (
          <>
            <span className="chip bg-bg text-xs text-ink">
              ❤️ {capteur.bpm ?? '—'} bpm · {capteur.rr.length} intervalles
            </span>
            {/* Dire d'OÙ viennent les intervalles : le protocole Polar les
                accompagne d'une marge d'erreur, le service standard non. Sur un
                capteur optique, le second n'en envoie souvent aucun — et il
                vaut mieux le savoir avant deux minutes d'immobilité. */}
            <span className="text-[10px] text-muted">
              {capteur.ppi ? 'via le protocole Polar (PPI)' : 'service standard'}
            </span>
            {enCours ? (
              <>
                <span className="text-xs font-bold tabular-nums text-copper">
                  {Math.floor(Math.max(0, reste) / 60)}:{String(Math.max(0, reste) % 60).padStart(2, '0')}
                </span>
                <button onClick={() => setEnCours(false)} className="btn-ghost px-2 py-1 text-xs text-muted">
                  Arrêter
                </button>
              </>
            ) : (
              <button onClick={demarrer} className="btn-ghost px-2 py-1 text-xs text-copper">
                ▶️ Mesurer 2 minutes
              </button>
            )}
          </>
        ) : (
          <button
            onClick={capteur.connecter}
            disabled={capteur.etat === 'recherche' || capteur.etat === 'connexion'}
            className="btn-ghost px-2 py-1 text-xs text-copper disabled:opacity-50"
          >
            {capteur.etat === 'prêt' || capteur.etat === 'perdu' ? '🔗 Brancher le capteur' : 'Connexion…'}
          </button>
        )}
      </div>

      {capteur.erreur ? <p className="mt-1 text-xs text-clay">{capteur.erreur}</p> : null}
      {msg ? <p className="mt-1 text-xs text-copper">{msg}</p> : null}

      {derniere ? (
        <p className="mt-2 text-xs text-muted">
          Dernière mesure : <b className="text-ink">{derniere.bpm} bpm au repos</b>
          {derniere.rmssd !== null ? (
            <>
              {' '}
              · variabilité <b className="text-ink">{derniere.rmssd} ms</b>
            </>
          ) : (
            ' · pas de variabilité (capteur sans intervalles RR)'
          )}{' '}
          · {new Date(derniere.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ·{' '}
          {derniere.intervalles} intervalles
        </p>
      ) : null}
    </div>
  )
}
