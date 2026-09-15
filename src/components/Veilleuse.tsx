import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useCapteur, useFcMax } from '../lib/capteurContexte'
import { ZONES, zoneDe } from '../lib/cardio'
import { entrerPleinEcran, sortirPleinEcran } from '../lib/pleinEcran'
import { doitSassombrir, loadVeilleuse } from '../lib/veilleuse'

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
// ── Une seule porte, et elle est petite ─────────────────────────────────────
//
// Voile posé, la dalle entière est morte : un toucher n'arrive nulle part, ne
// réveille rien, ne débranche rien. La seule chose vivante est un bouton de
// quarante-huit pixels à gauche de la fréquence — à l'aplomb du 🌙 de l'en-tête
// qui a posé le voile. On rallume là où on a éteint.
//
// C'est un durcissement, et il répare un défaut : la règle affichée était « la
// moitié basse », mais l'écoute des gestes posée au niveau du DOCUMENT levait
// le voile depuis n'importe où, y compris la moitié haute. La règle écrite
// n'était pas celle qui s'appliquait. Cette écoute ne sert donc plus qu'à
// repousser l'échéance TANT QUE le voile est levé ; une fois posé, plus rien
// n'écoute que le bouton.

export function Veilleuse({ sombre, onSombre }: { sombre: boolean; onSombre: (v: boolean) => void }) {
  const { user } = useAuth()
  const capteur = useCapteur()
  const fcMax = useFcMax()
  const [active, setActive] = useState(false)
  const dernierGeste = useRef(Date.now())
  // Le plein écran n'est rendu que si c'est NOUS qui l'avons pris : quelqu'un
  // qui l'avait demandé avant pour une autre raison ne doit pas en sortir parce
  // qu'un voile se lève.
  const pleinEcranAnous = useRef(false)

  useEffect(() => {
    if (!user) return
    loadVeilleuse(user.id).then(setActive).catch(() => {})
  }, [user])

  // Le voile est possible dès que le capteur mesure. Le réglage ne décide que
  // de l'automatique (cf. plus bas).
  const branchee = capteur.etat === 'connecté'

  const reveiller = useCallback(() => {
    dernierGeste.current = Date.now()
    onSombre(false)
  }, [onSombre])

  // Tout geste repousse l'échéance — et RIEN DE PLUS. On écoute en phase de
  // CAPTURE : sinon un bouton qui arrête la propagation de son clic — il y en a
  // — laisserait le compteur courir pendant qu'on s'en sert.
  //
  // L'écoute s'arrête dès que le voile est posé. C'est la clé de la serrure :
  // tant qu'elle tournait aussi voile posé, elle le levait au moindre toucher,
  // où qu'il tombe.
  useEffect(() => {
    if (!branchee || sombre) return
    const opts = { capture: true } as const
    const gestes: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel']
    const repousser = () => {
      dernierGeste.current = Date.now()
    }
    for (const g of gestes) document.addEventListener(g, repousser, opts)
    return () => {
      for (const g of gestes) document.removeEventListener(g, repousser, opts)
    }
  }, [branchee, sombre])

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

  // ── L'heure et le bandeau de navigation ───────────────────────────────────
  //
  // Voile posé, on prend tout l'écran : Android retire alors sa barre d'état et
  // sa barre de navigation, les deux seules choses qui restaient allumées.
  //
  // L'appel échoue quand le voile est tombé TOUT SEUL — le plein écran réclame
  // un geste récent, et une minute sans geste n'en laisse aucun. Ce n'est pas
  // une panne : le premier toucher que le voile avale sert de rattrapage, plus
  // bas. Déclenché par le 🌙, il passe du premier coup.
  const voile = branchee && sombre
  useEffect(() => {
    if (voile) {
      void entrerPleinEcran().then((ok) => {
        pleinEcranAnous.current = ok
      })
      return
    }
    if (pleinEcranAnous.current) {
      pleinEcranAnous.current = false
      void sortirPleinEcran()
    }
  }, [voile])

  // Sortir du plein écran en quittant l'écran ou en débranchant : l'effet
  // ci-dessus ne passe que sur un changement de `voile`, et un composant
  // démonté ne change plus rien.
  useEffect(() => {
    return () => {
      if (pleinEcranAnous.current) {
        pleinEcranAnous.current = false
        void sortirPleinEcran()
      }
    }
  }, [])

  if (!voile) return null

  const zone = fcMax && capteur.bpm !== null ? ZONES.find((z) => z.id === zoneDe(capteur.bpm as number, fcMax)) : undefined

  return (
    <div
      // Le voile ne touche PAS au verrou d'écran : l'écran doit rester allumé,
      // sinon la page passe en arrière-plan et la liaison se coupe. C'est un
      // masque, pas une extinction — et c'est toute la différence.
      //
      // Ce gestionnaire n'ouvre rien. Il sert au rattrapage du plein écran : un
      // toucher avalé reste une activation utilisateur, donc de quoi obtenir
      // l'écran entier que l'assombrissement automatique n'avait pas pu prendre.
      onPointerDown={() => {
        if (pleinEcranAnous.current) return
        void entrerPleinEcran().then((ok) => {
          pleinEcranAnous.current = ok
        })
      }}
      aria-label="Écran verrouillé — le bouton à gauche de la fréquence rallume"
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
          remonter.

          Le bouton de réveil, lui, ne disparaît JAMAIS : il rétrécit. C'est la
          seule sortie, et une sortie qu'on cache est une porte fermée. */}
      <style>{`
        @media (max-height: 320px) {
          .veilleuse .veilleuse-aide { display: none; }
          .veilleuse .veilleuse-bpm { font-size: 3rem; line-height: 1; }
          .veilleuse .veilleuse-reveil { height: 2.5rem; width: 2.5rem; }
          /* ── Le chiffre remonte en HAUT ──────────────────────────────
             Pas une question d'esthétique. Android impose un plancher à la
             taille d'une fenêtre, et on ne le descend pas ; mais One UI
             laisse TRAÎNER une fenêtre contextuelle au-delà du bord de
             l'écran. En poussant la fenêtre vers le bas, il ne reste que sa
             bande supérieure — et c'est là que le chiffre doit être.

             Centré, il disparaissait avec le reste. En haut, il survit à
             tout ce qu'on cache. */
          .veilleuse { justify-content: flex-start; padding-top: .5rem; }
        }
        @media (max-height: 200px) {
          .veilleuse .veilleuse-bpm { font-size: 2.25rem; }
          .veilleuse .veilleuse-reveil { height: 2.25rem; width: 2.25rem; }
        }
      `}</style>

      <div className="flex items-center gap-4">
        {/* ── La seule porte ────────────────────────────────────────────────
            Quarante-huit pixels : au-dessus du plus petit point d'appui qu'on
            atteint sans viser, et assez petit pour qu'une serviette ou une
            poche ne tombe pas dessus par hasard.

            `stopPropagation` sur le POINTERDOWN : le voile écoute lui aussi le
            pointerdown, pour rattraper le plein écran, et il n'a rien à faire
            quand c'est ce bouton qu'on touche. */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation()
            reveiller()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') reveiller()
          }}
          aria-label="Rallumer l’écran"
          className="veilleuse-reveil flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 text-lg text-white/30"
        >
          ☀
        </button>

        {capteur.bpm !== null ? (
          <span className="veilleuse-bpm text-6xl font-bold tabular-nums opacity-25" style={{ color: zone?.couleur ?? '#fff' }}>
            {capteur.bpm}
          </span>
        ) : (
          <span className="text-sm text-white/20">en attente du brassard…</span>
        )}
      </div>

      {capteur.contact === false ? (
        <span className="veilleuse-aide text-[11px] text-white/25">brassard décroché</span>
      ) : null}

      {/* ── Ce que le voile NE FAIT PAS, écrit sous le voile ──────────────
          L'écran a l'air éteint, et il ne l'est pas : la page tient un verrou
          tant que le brassard est branché. Un téléphone qu'on glisse dans sa
          poche en le croyant endormi éclaire sa doublure jusqu'à la panne.

          Le bouton « débrancher » a disparu d'ici, et c'est voulu : « tout
          verrouillé sauf une petite zone » ne souffre pas d'exception, et un
          bouton qui coupe la mesure est précisément celui qu'on ne veut pas
          voir pressé à travers un tissu. On rallume, puis on débranche depuis
          l'en-tête — deux gestes au lieu d'un, dont aucun par accident.

          Ces lignes disparaissent dans une petite fenêtre : là, l'écran du
          téléphone est visible autour, et personne ne croit qu'il dort. */}
      <div className="veilleuse-aide flex flex-col items-center gap-1">
        <span className="text-[11px] text-white/20">Écran verrouillé — touche ☀ pour rallumer</span>
        <span className="text-[10px] text-white/15">Brassard branché — l’écran reste allumé</span>
      </div>
    </div>
  )
}
