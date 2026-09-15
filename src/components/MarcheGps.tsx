import { useEffect, useState } from 'react'
import { useCapteurGps, gpsDisponible } from '../lib/capteurGps'
import { fmtDistance, fmtDuree, PRECISION_MAX_M } from '../lib/gps'
import { mesureDemarre } from '../lib/mesureEnCours'
import { METRES_MIN, vautLaPeine } from '../lib/trajets'
import type { BilanTrajet } from '../lib/gps'

// La marche, mesurée depuis sa ligne de séance.
//
// ── Pourquoi ici et pas en tête de l'écran ──────────────────────────────────
//
// Parce que la marche EST une activité, au même titre que le ménage ou le port
// de sacs : elle a un coût métabolique, elle entre dans la dépense du jour et
// dans la charge de la semaine. Une carte à part, en tête du journal, la sortait
// de tout ça et en faisait un outil de mesure sans destination.
//
// Ici, elle remplit la ligne qu'elle concerne : la durée mesurée devient la
// durée de l'activité, et la distance part dans les notes. Le reste de
// l'application n'a alors rien de spécial à savoir — c'est une ligne de séance
// comme une autre.
//
// ── Ce qui reste à part, et pourquoi ────────────────────────────────────────
//
// La moto. Un trajet ne brûle rien, n'entre ni dans la charge ni dans la
// dépense, et n'a donc aucune ligne de séance à remplir. Il a sa propre section.

/**
 * Les minutes qu'on écrit dans la ligne.
 *
 * Celles du DÉPLACEMENT (`secondes`), et non celles de l'enregistrement
 * (`dureeS`). La distinction n'est pas un détail : dix minutes d'arrêt au
 * milieu d'une marche ne sont pas de la marche, et les compter gonflerait la
 * dépense du jour d'autant — le coût métabolique est multiplié par la durée.
 *
 * Extrait du composant pour être vérifiable. Tant que c'était une expression
 * au milieu d'un gestionnaire de clic, échanger les deux champs ne faisait
 * tomber aucun contrôle : les deux sont des nombres de secondes, et le
 * résultat reste une durée plausible.
 *
 * Le plancher d'une minute évite d'écrire « 0 min » sur une marche courte mais
 * réelle : le seuil d'enregistrement est ailleurs (50 m et cinq segments), et
 * une ligne qui a passé ce seuil vaut au moins une minute.
 */
export function minutesMarchees(bilan: BilanTrajet): number {
  return Math.max(1, Math.round(bilan.secondes / 60))
}

/** Le nom du catalogue que ce bouton accompagne. */
export const NOM_MARCHE = 'Marche'

export function estMarche(nom: string): boolean {
  return nom.trim().toLowerCase() === NOM_MARCHE.toLowerCase()
}

export function MarcheGps({ onFini }: { onFini: (minutes: number, metres: number) => void }) {
  const gps = useCapteurGps('marche')
  const [msg, setMsg] = useState<string | null>(null)
  const enCours = gps.etat === 'accroche' || gps.etat === 'mesure' || gps.etat === 'perdu'

  useEffect(() => {
    if (!enCours) return
    return mesureDemarre()
  }, [enCours])

  if (!gpsDisponible()) return null

  function terminer() {
    const fini = gps.bilan
    gps.arreter()
    if (!fini || !vautLaPeine(fini.metres, fini.segments)) {
      setMsg(`Moins de ${METRES_MIN} m mesurés — la ligne n’a pas été remplie.`)
      return
    }
    onFini(minutesMarchees(fini), fini.metres)
    setMsg(`${fmtDistance(fini.metres)} en ${fmtDuree(fini.secondes)}.`)
  }

  if (!enCours) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={gps.demarrer}
          title="Mesurer cette marche au GPS — remplit la durée et la distance"
          className="chip shrink-0 bg-bg text-[11px] text-muted transition hover:text-copper"
        >
          📍 GPS
        </button>
        {msg ? <span className="text-[10px] text-copper">{msg}</span> : null}
      </div>
    )
  }

  const flou = gps.precision !== null && gps.precision > PRECISION_MAX_M
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl2 bg-white/[0.03] px-2 py-1.5">
      <span className="text-sm font-bold tabular-nums text-ink">
        {gps.bilan ? fmtDistance(gps.bilan.metres) : '—'}
      </span>
      <span className="text-[10px] text-muted">{fmtDuree(gps.dureeS)}</span>
      <span className="min-w-0 flex-1 text-[10px] leading-snug text-muted/70">
        {gps.etat === 'accroche'
          ? 'le récepteur cherche les satellites…'
          : flou
            ? `± ${Math.round(gps.precision as number)} m — trop imprécis, rien n’est compté`
            : gps.precision !== null
              ? `± ${Math.round(gps.precision)} m`
              : 'en attente de la première position…'}
      </span>
      <button onClick={terminer} className="chip shrink-0 bg-copper/20 text-[11px] text-copper">
        Terminer
      </button>
    </div>
  )
}
