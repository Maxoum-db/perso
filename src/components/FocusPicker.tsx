import { FOCUS, FOCUS_IDS, FOCUS_MAX, basculerFocus, estExclusif, estModeRecup, type FocusId } from '../lib/focus'
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
  // À deux groupes, en ajouter un troisième chasse le plus ancien. On le dit
  // plutôt que de laisser la sélection changer sans explication.
  const plein = value.filter((id) => !estExclusif(id)).length >= FOCUS_MAX

  return (
    <section className="card space-y-2 p-3">
      {/* La contrainte tient en deux mots dans le titre ; l'explication complète
          descend sur la ligne d'aide, qui change déjà avec l'état. Dans le titre,
          elle passait sur deux lignes et alourdissait tout le bloc. */}
      <h2 className="text-sm font-bold text-ink">
        🎯 Point faible à rattraper
        <span className="ml-1.5 text-[10px] font-normal text-muted">{FOCUS_MAX} max</span>
      </h2>

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

      <p className="text-[10px] text-muted">
        {plein ? 'Deux groupes visés : en toucher un troisième remplacera le plus ancien. ' : ''}
        {recup
          ? '⚔️ sans effet ici : la séance de récupération est faite d’étirements.'
          : actif
            ? 'Cou, préhension, trapèzes, érecteurs et ceinture abdominale passent devant, et un tiers de la séance leur est réservé — en plus du point faible.'
            : '⚔️ se cumule avec le point faible : ces muscles comptent déjà un peu, touche pour qu’ils décident vraiment de la séance.'}
      </p>
    </section>
  )
}
