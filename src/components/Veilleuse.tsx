import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useCapteur, useFcMax } from '../lib/capteurContexte'
import { ZONES, zoneDe } from '../lib/cardio'
import { doitSassombrir, loadVeilleuse, moitieBasse } from '../lib/veilleuse'

// Le voile qui tombe quand on ne touche plus à rien.
//
// ── Pourquoi il ne descend QUE si le capteur est branché ────────────────────
//
// Un voile noir sur une application qu'on est en train de lire serait une
// panne, pas une fonction. Il n'a de sens que pendant une mesure : c'est le seul
// moment où l'écran doit rester allumé sans qu'on le regarde, parce que le
// Bluetooth du navigateur meurt si la page passe en arrière-plan.
//
// Capteur débranché, il n'y a rien à protéger et personne à ne pas éblouir.
//
// ── Pourquoi la moitié basse, et pourquoi on le dit ─────────────────────────
//
// C'est la demande, et elle est juste : on attrape un téléphone par le haut ou
// par les bords, jamais par le bas de la dalle. Un voile qui se lèverait au
// moindre contact ne tiendrait pas dans une poche ni sous une serviette.
//
// Mais une règle qu'on ne voit pas est un piège. Quelqu'un qui tape en haut
// trois fois sans rien obtenir croit l'application plantée. Une ligne très pâle
// reste donc affichée en bas — assez pour se lire dans le noir, assez discrète
// pour ne pas rallumer la pièce.

export function Veilleuse() {
  const { user } = useAuth()
  const capteur = useCapteur()
  const fcMax = useFcMax()
  const [active, setActive] = useState(false)
  const [sombre, setSombre] = useState(false)
  const dernierGeste = useRef(Date.now())

  useEffect(() => {
    if (!user) return
    loadVeilleuse(user.id).then(setActive).catch(() => {})
  }, [user])

  const branchee = active && capteur.etat === 'connecté'

  const reveiller = useCallback(() => {
    dernierGeste.current = Date.now()
    setSombre(false)
  }, [])

  // Tout geste repousse l'échéance. On écoute en phase de CAPTURE : sinon un
  // bouton qui arrête la propagation de son clic — il y en a — laisserait le
  // compteur courir pendant qu'on s'en sert.
  useEffect(() => {
    if (!branchee) return
    const opts = { capture: true } as const
    const gestes: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel']
    for (const g of gestes) document.addEventListener(g, reveiller, opts)
    return () => {
      for (const g of gestes) document.removeEventListener(g, reveiller, opts)
    }
  }, [branchee, reveiller])

  useEffect(() => {
    if (!branchee) {
      setSombre(false)
      return
    }
    const t = setInterval(() => {
      if (doitSassombrir(dernierGeste.current, Date.now())) setSombre(true)
    }, 1000)
    return () => clearInterval(t)
  }, [branchee])

  if (!branchee || !sombre) return null

  const zone = fcMax && capteur.bpm !== null ? ZONES.find((z) => z.id === zoneDe(capteur.bpm as number, fcMax)) : undefined

  return (
    <div
      // Le voile ne touche PAS au verrou d'écran : l'écran doit rester allumé,
      // sinon la page passe en arrière-plan et la liaison se coupe. C'est un
      // masque, pas une extinction — et c'est toute la différence.
      onPointerDown={(e) => {
        if (moitieBasse(e.clientY, window.innerHeight)) reveiller()
      }}
      role="button"
      tabIndex={0}
      aria-label="Écran assombri — touche le bas pour rallumer"
      onKeyDown={reveiller}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
    >
      {/* La fréquence, très pâle : de quoi jeter un œil sans se rallumer la
          figure. Elle garde la couleur de sa zone, à peine. */}
      {capteur.bpm !== null ? (
        <span className="text-5xl font-bold tabular-nums opacity-25" style={{ color: zone?.couleur ?? '#fff' }}>
          {capteur.bpm}
        </span>
      ) : (
        <span className="text-sm text-white/20">en attente du brassard…</span>
      )}
      {capteur.contact === false ? (
        <span className="mt-2 text-[11px] text-white/25">brassard décroché</span>
      ) : null}
      <span className="absolute bottom-10 text-[11px] text-white/20">Touche ici pour rallumer</span>
    </div>
  )
}
