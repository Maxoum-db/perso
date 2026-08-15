import { libellesBloques } from '../lib/blocage'
import { MUSCLE_LABELS } from '../lib/muscles'
import { TON_STYLE } from '../lib/charge'
import { fmtFamiliarite } from '../lib/familiarite'
import { fmtDuree } from '../lib/duree'
import { OUTILS, outilDe } from '../lib/materiel'
import { SCORE_MAX, SCORE_MIN } from '../lib/scoreExercice'
import { FormeCard } from './FormeCard'
import type { Forme } from '../lib/forme'
import type { CatalogExercise } from '../lib/muscu'
import type { SuggestedSession } from '../lib/sessionBuilder'

// Aperçu de la séance composée automatiquement : on montre POURQUOI chaque
// exercice est là (muscle visé + son état de récupération) avant de la lancer.
//
// ── Et pourquoi on peut le noter d'ici ──────────────────────────────────────
//
// La note de priorité existe depuis le début et se modifiait dans le formulaire
// d'édition du catalogue, à trois écrans d'ici. Résultat mesuré : 317 exercices
// au catalogue, 317 sans note enregistrée. Le barème de `scoreParDefaut` tenait
// donc seul la barre — et il est bon, mais il est THÉORIQUE : il compte les
// muscles et les articulations, il ne sait rien d'une épaule qui coince ni d'une
// machine que la salle n'a pas.
//
// L'avis se forme en lisant la séance proposée, pas en ouvrant un formulaire.
// C'est donc là qu'on le recueille. Noter ne retire pas l'exercice du jour : la
// note pèse sur les compositions SUIVANTES (cf. `poidsScore`), et une séance
// qu'on est en train de lire n'a pas à se réécrire sous les yeux.

function repos(jours: number): string {
  if (jours >= 99) return 'jamais travaillé'
  const j = Math.round(jours)
  return j <= 1 ? 'prêt' : `reposé ${j} j`
}

/** En mode récupération, on annonce l'état de courbature plutôt que le repos. */
function courbature(jours: number): string {
  if (jours >= 99) return 'frais'
  if (jours <= 2) return 'courbaturé'
  if (jours <= 4) return 'sensible'
  return 'frais'
}

export function SuggestedSessionCard({
  suggestion,
  forme,
  onLive,
  onManual,
  onRegenerate,
  onClose,
  onNoter,
}: {
  suggestion: SuggestedSession | null
  /** État de forme ayant dicté le volume et les charges de cette séance. */
  forme?: Forme
  onLive: () => void
  onManual: () => void
  onRegenerate: () => void
  onClose: () => void
  /**
   * Change la priorité d'un exercice au catalogue. Absent = pas de notation
   * (l'aperçu reste lisible en lecture seule, par exemple depuis l'accueil).
   */
  onNoter?: (exo: CatalogExercise, score: number) => void
}) {
  if (!suggestion) {
    return (
      <div className="card space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">🧠 Séance adaptée</span>
          <button onClick={onClose} className="text-xs text-copper">
            Fermer
          </button>
        </div>
        <p className="text-[11px] text-muted">
          Pas encore assez d'exercices exploitables au catalogue pour composer une séance. Enregistre une séance
          ou deux, ou ajoute des exercices avec leur groupe visé.
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-bold text-ink">
          {suggestion.recuperation ? '🧊' : '🧠'} {suggestion.name}
        </span>
        <button onClick={onClose} className="shrink-0 text-xs text-copper">
          Fermer
        </button>
      </div>

      <p className="text-[11px] text-muted">
        {suggestion.recuperation
          ? 'Étirements et mobilité ciblés sur ce qui est encore courbaturé — la logique est inversée : on va chercher le chaud.'
          : 'Composée à partir de ta récupération : ces muscles sont reposés, et les plus utiles au béhourd passent devant.'}
      </p>

      {forme ? <FormeCard forme={forme} compact /> : null}

      {suggestion.degrade && !suggestion.recuperation ? (
        <p className="rounded-xl2 border border-clay/30 bg-clay/5 p-2 text-[11px] text-clay">
          ⚠️ Presque tout est encore en récupération. Cette séance reste jouable, mais en léger — ou repose-toi.
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {suggestion.exercises.map((s, i) => (
          <li
            key={s.exo.id}
            /* Un superset se lit comme un bloc : bordure gauche cuivre sur les
               deux lignes, et pas de séparateur entre elles. Sans ce repère
               visuel, « 🔗 » sur deux lignes éloignées ne dirait pas qu'on les
               enchaîne. */
            className={`flex items-start gap-2 pb-1.5 ${
              s.superset !== null && suggestion.exercises[i + 1]?.superset === s.superset
                ? ''
                : 'border-b border-line/40 last:border-0'
            } ${s.superset !== null ? 'border-l-2 border-l-copper/50 pl-1.5' : ''}`}
          >
            <span className="w-4 shrink-0 text-xs font-bold text-copper">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">
                {s.exo.name}
                {s.charge.weight !== null ? (
                  <span className="ml-1.5 font-extrabold text-copper">{s.charge.weight} kg</span>
                ) : null}
              </div>
              <div className="text-[11px] text-muted">
                {s.exo.default_sets}×{s.exo.default_reps} ·{' '}
                {/* L'outil, sur chaque ligne : c'est lui qui explique l'ordre.
                    Les exercices d'un même poste se suivent, et sans le mot
                    écrit, l'enchaînement passerait pour un hasard. */}
                <span
                  className={
                    outilDe(s.exo.name) === outilDe(suggestion.exercises[i - 1]?.exo.name ?? '\u0000')
                      ? 'text-muted/60'
                      : 'font-semibold text-ink'
                  }
                  title={
                    outilDe(s.exo.name) === outilDe(suggestion.exercises[i - 1]?.exo.name ?? '\u0000')
                      ? 'Même poste que l’exercice précédent : rien à aller chercher'
                      : 'Changement de poste'
                  }
                >
                  {OUTILS[outilDe(s.exo.name)].emoji} {OUTILS[outilDe(s.exo.name)].label}
                </span>{' '}
                · {s.moteurs.slice(0, 3).map((r) => MUSCLE_LABELS[r].split(' (')[0]).join(', ')}
              </div>
              {/* En récupération, la liste mélange des étirements et des
                  exercices ordinaires proposés À VIDE. Sans ce mot, « rotation
                  externe à la poulie » au milieu d'étirements se lirait comme
                  une série normale — et c'est l'inverse du but. */}
              {s.doux ? (
                <div
                  className="mt-0.5 text-[10px] font-semibold text-sage-dark"
                  title="Fait à vide, en amplitude, sans jamais forcer : la case « version douce » arrive déjà cochée, et la ligne compte comme de la récupération"
                >
                  🌙 version douce
                </div>
              ) : null}
              {/* Pourquoi CET exercice-là : parce qu'il vise le point faible
                  déclaré, parce qu'on progresse dessus, ou parce qu'il a fait son
                  temps et qu'on commence à tourner. Sans ces mots, la rotation
                  ressemblerait à de l'instabilité du générateur. */}
              {!suggestion.recuperation && (s.focus || s.etire || s.superset !== null || s.familiarite > 0) ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]">
                  {s.focus ? <span className="font-semibold text-copper">🎯 point faible</span> : null}
                  {s.superset !== null ? (
                    <span className="font-semibold text-copper" title="À enchaîner avec l’exercice relié : le repos de l’un est le travail de l’autre">
                      🔗 superset
                    </span>
                  ) : null}
                  {s.etire ? (
                    <span className="text-sage-dark" title="Charge le muscle en position allongée : plus de croissance par série">
                      🫱 étiré
                    </span>
                  ) : null}
                  {s.familiarite > 0 ? (
                    <span className={s.rotation ? 'font-semibold text-plum' : 'text-muted'}>
                      {s.rotation ? '🔄 ' : '📈 '}
                      {fmtFamiliarite(s.familiarite)}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {s.charge.raison ? (
                <div className={`text-[11px] font-semibold ${TON_STYLE[s.charge.ton].classe}`}>
                  {TON_STYLE[s.charge.ton].icone} {s.charge.raison}
                </div>
              ) : null}
              {/* « Le revoir » et non « noter » : ce qu'on règle est la
                  FRÉQUENCE à laquelle le générateur reproposera ce mouvement,
                  pas une opinion sur sa valeur. Un exercice excellent qu'on ne
                  peut pas faire descend à 1, et c'est le bon usage. */}
              {onNoter ? (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted">
                  <span>Le revoir :</span>
                  <button
                    type="button"
                    onClick={() => onNoter(s.exo, s.exo.score - 1)}
                    disabled={s.exo.score <= SCORE_MIN}
                    className="rounded-full border border-line px-1.5 py-0.5 font-semibold text-ink disabled:opacity-30"
                    title={
                      s.exo.score <= SCORE_MIN
                        ? 'Déjà au minimum : le générateur ne le propose plus qu’en dernier recours'
                        : 'Moins souvent — prend effet sur les prochaines compositions'
                    }
                  >
                    moins
                  </button>
                  <span className="font-bold text-copper" title={`Priorité ${s.exo.score}/${SCORE_MAX}`}>
                    {s.exo.score}/{SCORE_MAX}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNoter(s.exo, s.exo.score + 1)}
                    disabled={s.exo.score >= SCORE_MAX}
                    className="rounded-full border border-line px-1.5 py-0.5 font-semibold text-ink disabled:opacity-30"
                    title={
                      s.exo.score >= SCORE_MAX
                        ? 'Déjà au maximum'
                        : 'Plus souvent — prend effet sur les prochaines compositions'
                    }
                  >
                    plus
                  </button>
                </div>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                suggestion.recuperation ? 'bg-clay/15 text-clay' : 'bg-sage/15 text-sage-dark'
              }`}
            >
              {suggestion.recuperation ? courbature(s.reposMin) : repos(s.reposMin)}
            </span>
          </li>
        ))}
      </ol>

      {/* Ce que la séance pèse. Sans cette ligne, les budgets de volume et de
          fatigue resteraient invisibles, et une séance courte passerait pour un
          générateur en panne alors qu'elle est au bout de son budget. */}
      {!suggestion.recuperation ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line/40 pt-1.5 text-[10px] text-muted">
          <span title={suggestion.bilan.dureeCible ? `Créneau visé : ${fmtDuree(suggestion.bilan.dureeCible)}` : undefined}>
            ⏱️{' '}
            <b className="text-ink">{fmtDuree(suggestion.bilan.duree)}</b>
            {suggestion.bilan.dureeCible ? ` / ${fmtDuree(suggestion.bilan.dureeCible)}` : ''}
          </span>
          <span>
            <b className="text-ink">{suggestion.bilan.series}</b> séries
          </span>
          {suggestion.bilan.supersets > 0 ? (
            <span title="Deux mouvements antagonistes enchaînés : même volume, séance plus courte">
              🔗 <b className="text-ink">{suggestion.bilan.supersets}</b> superset
              {suggestion.bilan.supersets > 1 ? 's' : ''}
            </span>
          ) : null}
          <span title="Soulevés, squats et portages coûtent au système nerveux, et ça se cumule">
            charge nerveuse{' '}
            <b className={suggestion.bilan.cout >= suggestion.bilan.budget ? 'text-copper' : 'text-ink'}>
              {suggestion.bilan.cout}/{suggestion.bilan.budget}
            </b>
          </span>
          {suggestion.bilan.poussees + suggestion.bilan.tirages > 0 ? (
            <span title="Au moins autant de tirages que de poussées — pour l’épaule">
              pousser/tirer{' '}
              <b className="text-ink">
                {suggestion.bilan.poussees}:{suggestion.bilan.tirages}
              </b>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Le matériel de la séance, en une ligne : ce qu'il faut avoir sous la
          main avant de commencer, et le nombre d'allers-retours que l'ordre
          proposé permet d'éviter. */}
      {(() => {
        const outils = suggestion.exercises.map((s) => outilDe(s.exo.name))
        const distincts = [...new Set(outils)]
        const changements = outils.filter((o, i) => i > 0 && o !== outils[i - 1]).length
        return distincts.length > 0 ? (
          <p className="text-[11px] text-muted">
            🧰 Matériel : {distincts.map((o) => `${OUTILS[o].emoji} ${OUTILS[o].label}`).join(' · ')}
            {outils.length > 1 ? (
              <span title="Les exercices d’un même poste se suivent : c’est le nombre de fois où il faut changer d’endroit">
                {' '}— {changements} changement{changements > 1 ? 's' : ''} de poste
              </span>
            ) : null}
          </p>
        ) : null
      })()}

      {/* Le blocage AVANT les muscles en récup, et sur fond appuyé : ce n'est
          pas le générateur qui a jugé, c'est une consigne qu'on lui a donnée.
          Et il faut la voir, parce qu'elle a un coût — sur un muscle qui
          stabilise beaucoup, elle peut retirer la moitié du catalogue et rendre
          une séance de trois lignes qui passerait sinon pour un générateur à
          court d'idées. */}
      {suggestion.bloques.regions.length > 0 ? (
        <p
          className="rounded-xl2 px-2.5 py-1.5 text-[11px] leading-snug"
          style={{ background: 'rgb(var(--ink) / .08)', color: 'rgb(var(--ink))' }}
        >
          ⛔ Au repos total : <b>{libellesBloques(new Set(suggestion.bloques.regions))}</b>.{' '}
          {suggestion.bloques.ecartes > 0
            ? `${suggestion.bloques.ecartes} exercice${suggestion.bloques.ecartes > 1 ? 's' : ''} écarté${
                suggestion.bloques.ecartes > 1 ? 's' : ''
              } du choix.`
            : 'Aucun exercice du catalogue ne les sollicitait.'}
        </p>
      ) : null}

      {suggestion.evites.length > 0 ? (
        <p className="text-[11px] text-muted">
          🚫 Écartés (encore en récup) :{' '}
          {suggestion.evites.slice(0, 5).map((r) => MUSCLE_LABELS[r].split(' (')[0]).join(', ')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onLive} className="btn-primary flex-1 py-2 text-sm">
          ▶️ {suggestion.recuperation ? 'Lancer la récup' : 'Démarrer'}
        </button>
        <button onClick={onManual} className="btn-ghost px-3 py-2 text-sm">
          ✍️ Éditer
        </button>
        <button onClick={onRegenerate} className="btn-ghost px-3 py-2 text-sm" title="Autre proposition">
          🔄
        </button>
      </div>
    </div>
  )
}
