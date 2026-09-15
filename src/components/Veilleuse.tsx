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

export function Veilleuse({ sombre, onSombre }: { sombre: boolean; onSombre: (v: boolean) => void }) {
  const { user } = useAuth()
  const capteur = useCapteur()
  const fcMax = useFcMax()
  const [active, setActive] = useState(false)
  const dernierGeste = useRef(Date.now())

  useEffect(() => {
    if (!user) return
    loadVeilleuse(user.id).then(setActive).catch(() => {})
  }, [user])

  // Le voile est possible dès que le capteur mesure. Le réglage ne décide que
  // de l'automatique (cf. plus bas).
  const branchee = capteur.etat === 'connecté'

  const reveiller = useCallback(
    (e?: Event) => {
      // Le bouton « assombrir » de l'en-tête est un geste comme un autre, et
      // c'est bien le problème : son pointerdown passe par l'écoute en capture
      // AVANT son propre clic, et lèverait le voile que le clic vient de poser.
      // On le laisse donc traverser sans réveiller.
      const cible = e?.target
      if (cible instanceof Element && cible.closest('[data-veilleuse-bouton]')) return
      dernierGeste.current = Date.now()
      onSombre(false)
    },
    [onSombre],
  )

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
      onSombre(false)
      return
    }
    // L'assombrissement AUTOMATIQUE obéit au réglage ; le bouton de l'en-tête,
    // non. Le réglage dit « au bout d'une minute, tout seul » — l'éteindre ne
    // veut pas dire « je ne veux jamais assombrir », ça veut dire « pas sans que
    // je le demande ». Retirer le bouton avec reviendrait à confondre les deux.
    if (!active) return
    const t = setInterval(() => {
      if (doitSassombrir(dernierGeste.current, Date.now())) onSombre(true)
    }, 1000)
    return () => clearInterval(t)
  }, [branchee, active, onSombre])

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
      onKeyDown={() => reveiller()}
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
      {/* ── Ce que le voile NE FAIT PAS, écrit sous le voile ──────────────
          L'écran a l'air éteint, et il ne l'est pas : la page tient un verrou
          tant que le brassard est branché. Un téléphone qu'on glisse dans sa
          poche en le croyant endormi éclaire sa doublure jusqu'à la panne.

          Avant, l'écran allumé était lui-même l'avertissement. En le masquant,
          j'ai supprimé le seul signal qui restait — il faut donc le remettre en
          mots, et donner la sortie avec. */}
      <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2">
        <span className="text-[11px] text-white/20">Touche ici pour rallumer</span>
        <span className="text-[10px] text-white/15">Brassard branché — l’écran reste allumé</span>
        <button
          // `stopPropagation` sur le POINTERDOWN, et pas seulement sur le clic :
          // le voile écoute le pointerdown pour se lever, et il se lèverait
          // avant que le clic n'atteigne ce bouton. Le bouton ne recevrait
          // jamais rien.
          onPointerDown={(e) => {
            e.stopPropagation()
            capteur.deconnecter()
          }}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/35"
        >
          Débrancher le brassard
        </button>
      </div>
    </div>
  )
}
