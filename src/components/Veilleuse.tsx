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
      className="veilleuse fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black px-3"
    >
      {/* ── Pourquoi une hauteur change la mise en page ────────────────────
          En fenêtre contextuelle, Samsung impose une hauteur minimale qu'on ne
          peut pas descendre. Le voile s'y affichait comme sur une page pleine :
          un grand chiffre au milieu, trois lignes en bas, et beaucoup de noir
          entre les deux.

          Ce qu'on veut dans une petite fenêtre, c'est un BANDEAU : le chiffre,
          et rien. Les explications sont utiles la première fois, sur un écran
          entier ; elles ne valent pas la place qu'elles prennent dans une
          fenêtre haute comme trois lignes de texte.

          La règle est donc dans la feuille de style, pas dans une condition
          JavaScript : c'est la HAUTEUR DISPONIBLE qui décide, et elle change
          quand on redimensionne la fenêtre, sans que rien n'ait à se
          remonter. */}
      {/* La double classe `.veilleuse .veilleuse-aide` n'est pas ce qui fait
          gagner cette règle : ce bloc est rendu dans le corps du document, donc
          APRÈS la feuille de style, et à spécificité égale c'est le dernier qui
          l'emporte. Une mutation qui retire le premier sélecteur ne change donc
          rien, et aucun contrôle ne la voit — c'est normal.

          Gardée quand même : elle protège du jour où ce bloc remonterait
          ailleurs, et elle coûte huit caractères. */}
      <style>{`
        @media (max-height: 320px) {
          .veilleuse .veilleuse-aide { display: none; }
          .veilleuse .veilleuse-bpm { font-size: 3rem; line-height: 1; }
        }
        @media (max-height: 200px) {
          .veilleuse .veilleuse-bpm { font-size: 2.25rem; }
        }
      `}</style>

      {capteur.bpm !== null ? (
        <span className="veilleuse-bpm text-6xl font-bold tabular-nums opacity-25" style={{ color: zone?.couleur ?? '#fff' }}>
          {capteur.bpm}
        </span>
      ) : (
        <span className="text-sm text-white/20">en attente du brassard…</span>
      )}
      {capteur.contact === false ? (
        <span className="veilleuse-aide text-[11px] text-white/25">brassard décroché</span>
      ) : null}

      {/* ── Ce que le voile NE FAIT PAS, écrit sous le voile ──────────────
          L'écran a l'air éteint, et il ne l'est pas : la page tient un verrou
          tant que le brassard est branché. Un téléphone qu'on glisse dans sa
          poche en le croyant endormi éclaire sa doublure jusqu'à la panne.

          Ces lignes disparaissent dans une petite fenêtre : là, l'écran du
          téléphone est visible autour, et personne ne croit qu'il dort. */}
      <div className="veilleuse-aide flex flex-col items-center gap-2">
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
