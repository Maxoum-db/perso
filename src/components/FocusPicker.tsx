import { useState } from 'react'
import { FOCUS, FOCUS_IDS, FOCUS_MAX, basculerFocus, estModeRecup, type FocusId } from '../lib/focus'
import { DUREES, fmtDuree } from '../lib/duree'

// Le point faible du moment, et le mode béhourd. Deux réglages distincts et
// cumulables : le premier dit QUEL groupe pousser, le second POUR QUOI on
// s'entraîne. Ils vivent ensemble parce qu'on les règle ensemble.
//
// Le béhourd est une pastille comme les autres, dans la même rangée, et non plus
// une case à cocher à part. Il s'allume simplement EN PLUS de celle qui est
// active — la seule différence est qu'il ne remplace rien.

/** Style commun : c'est lui qui fait que les deux réglages se ressemblent. */
function pastille(actif: boolean, grise = false): string {
  return `chip flex items-center gap-1 transition ${
    grise
      ? 'bg-bg text-muted/40 cursor-not-allowed'
      : actif
        ? 'bg-copper/20 text-copper ring-1 ring-copper'
        : 'bg-bg text-muted'
  }`
}

export function FocusPicker({
  value,
  onChange,
  behourd,
  onBehourd,
  duree,
  onDuree,
}: {
  /** Un ou deux points faibles. */
  value: FocusId[]
  onChange: (ids: FocusId[]) => void
  behourd: boolean
  onBehourd: (on: boolean) => void
  /** Créneau visé, en minutes. */
  duree: number
  onDuree: (m: number) => void
}) {
  // En mode récupération, le générateur compose avec des étirements : le béhourd
  // n'y a pas de sens, et le laisser allumé le ferait mentir.
  const recup = estModeRecup(value)
  const actif = behourd && !recup
  // Replié par défaut : c'est un réglage qu'on pose et qu'on oublie, pas un
  // écran qu'on relit. Ce qu'il faut voir sans l'ouvrir tient dans son titre —
  // ce qui est sélectionné — et c'est justement ce qu'on y a mis.
  const [ouvert, setOuvert] = useState(false)
  const choisis = value.map((id) => FOCUS[id]?.emoji).filter(Boolean).join(' ')

  return (
    <section className="card space-y-2 p-3">
      {/* La contrainte tient en deux mots dans le titre ; l'explication complète
          descend sur la ligne d'aide, qui change déjà avec l'état. Dans le titre,
          elle passait sur deux lignes et alourdissait tout le bloc. */}
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-1.5 text-left text-sm font-bold text-ink"
      >
        <span className="w-3 shrink-0 text-muted">{ouvert ? '▾' : '▸'}</span>
        🎯 Point faible à rattraper
        {/* Replié, le titre porte l'état : les emojis choisis, le béhourd s'il
            est allumé, et le créneau. Un bloc replié qui ne dit pas ce qu'il
            contient oblige à l'ouvrir pour vérifier, donc à ne jamais le
            replier. */}
        <span className="ml-auto shrink-0 text-[11px] font-normal text-muted">
          {ouvert ? `${FOCUS_MAX} max` : `${choisis || '—'}${actif ? ' ⚔️' : ''} · ${fmtDuree(duree)}`}
        </span>
      </button>

      {ouvert ? (
        <>
      <div className="flex flex-wrap gap-1.5">
        {FOCUS_IDS.map((id) => (
          <button
            key={id}
            onClick={() => onChange(basculerFocus(value, id))}
            aria-pressed={value.includes(id)}
            className={pastille(value.includes(id))}
          >
            <span>{FOCUS[id].emoji}</span>
            {FOCUS[id].label}
          </button>
        ))}

        {/* Le séparateur et la pastille voyagent ENSEMBLE : dans une rangée qui
            retourne à la ligne, laissés libres, ils pouvaient se retrouver sur
            deux lignes différentes — un trait vertical orphelin en bout de
            rangée. Le trait dit que ce qui suit ne fait pas partie du même
            choix ; sans lui, la pastille passerait pour une septième option qui
            désélectionne les autres. */}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="my-1 w-px self-stretch bg-line/60" />
          <button
            onClick={() => onBehourd(!behourd)}
            disabled={recup}
            aria-pressed={actif}
            title={recup ? 'Sans effet en mode récupération' : 'Se cumule avec le point faible choisi'}
            className={pastille(actif, recup)}
          >
            <span>⚔️</span>
            Spécial béhourd
          </button>
        </span>
      </div>

      {/* Le créneau. C'est le repos entre séries qui fait la durée d'une séance,
          pas le travail : sans cette contrainte le générateur composait des
          séances d'une heure et demie sans le dire. */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-2">
        <span className="text-[11px] font-bold text-ink">⏱️ Créneau</span>
        {DUREES.map((d) => (
          <button key={d} onClick={() => onDuree(d)} className={pastille(d === duree)}>
            {fmtDuree(d)}
          </button>
        ))}
      </div>

      {/* On ne garde que ce qui décrit un état ACTIF. Les deux phrases retirées
          expliquaient l'une une mécanique de remplacement qu'on voit se
          produire, l'autre ce que ferait un bouton qu'on n'a pas encore
          touché — de la notice, pas de l'information. */}
      {recup || actif ? (
        <p className="text-[10px] text-muted">
          {recup
            ? '⚔️ sans effet ici : la séance de récupération est faite d’étirements.'
            : 'Cou, préhension, trapèzes, érecteurs et ceinture abdominale passent devant, et un tiers de la séance leur est réservé — en plus du point faible.'}
        </p>
      ) : null}
        </>
      ) : null}
    </section>
  )
}
