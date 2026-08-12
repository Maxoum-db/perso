import { bilanCalories } from '../lib/calories'
import {
  FACTEUR_NEAT,
  FENETRE_BILAN,
  KCAL_PAR_KG,
  age,
  depenseParHeure,
  metabolismeDeBase,
  poidsHistorique,
  tendancePoids,
  type Profil,
} from '../lib/profil'
import type { MuscuSession } from '../lib/muscu'
import type { Weighin } from '../lib/workouts'

// Balance énergétique estimée.
//
// La dépense se calcule : métabolisme de base × facteur d'activité hors sport,
// plus la dépense réelle des séances enregistrées.
//
// Le chiffre en tête est celui d'AUJOURD'HUI, pas une moyenne. Une moyenne sur
// quatre semaines répond à « combien je dépense en ce moment » ; elle ne répond
// pas à « combien j'ai dépensé », qui est la question qu'on se pose le soir. Et
// elle ne bouge pas d'un jour de béhourd à un jour de repos, alors que la
// dépense, elle, varie du simple au double.
//
// La moyenne reste affichée, en petit, parce qu'elle sert à autre chose.
//
// L'apport, lui, ne se devine pas — sauf par la balance. Un kilo de masse
// corporelle vaut ~7 700 kcal : la pente de la courbe de poids donne donc
// directement l'écart entre ce qui entre et ce qui sort, sans peser un seul
// aliment.
//
// ATTENTION, et c'est la raison d'être des deux chiffres : cette déduction se
// fait sur la MOYENNE, jamais sur le jour. La pente du poids est une mesure de
// vingt-huit jours ; la confronter à la dépense d'un mardi comparerait deux
// périodes différentes et ferait apparaître un déficit ou un surplus qui
// n'existe que parce qu'on s'est entraîné ce jour-là.

/** En deçà, l'écart avec la veille ne dit rien qu'on veuille lire. */
const ECART_VISIBLE = 50

function ligne(label: string, valeur: string, aide?: string) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line/40 py-1.5 last:border-0">
      <span className="text-xs text-muted">
        {label}
        {aide ? <span className="ml-1 text-[10px] opacity-70">{aide}</span> : null}
      </span>
      <span className="shrink-0 text-sm font-bold text-ink">{valeur}</span>
    </div>
  )
}

export function EnergieCard({
  sessions,
  weighins,
  profil,
  onProfil,
}: {
  sessions: MuscuSession[]
  weighins: Weighin[]
  profil: Profil
  onProfil: (p: Profil) => void
}) {
  const poids = weighins[0]?.weight_kg ?? null
  const bmr = poids ? metabolismeDeBase(profil, poids) : null
  const base = bmr ? Math.round(bmr * FACTEUR_NEAT) : null
  // Chaque séance au poids qu'il portait CE JOUR-LÀ, et en dépense NETTE : les
  // heures d'entraînement sont déjà comptées dans la vie courante, on ne
  // facture donc que ce que la séance ajoute par-dessus.
  const parJour = poidsHistorique(weighins)
  const parHeure = bmr ? depenseParHeure(bmr) : 0

  // AUJOURD'HUI — le chiffre en tête. Une fenêtre d'un jour, donc la moyenne
  // du bilan EST le total du jour.
  const jour = bilanCalories(sessions, parJour, 1, parHeure)
  const sportDuJour = jour.total
  const seancesDuJour = jour.jours[0]?.seances ?? []
  const depenseDuJour = base !== null ? base + sportDuJour : null
  // La veille, pour dire d'où l'on vient sans faire de phrase.
  const sportHier = jour.totalPrecedent

  // LA MOYENNE — elle ne sert qu'à la déduction d'apport, et il faut que ce
  // soit la même fenêtre que la pente du poids.
  const bilan = bilanCalories(sessions, parJour, FENETRE_BILAN, parHeure)
  const sportParJour = bilan.moyenne
  const depenseMoyenne = base !== null ? base + sportParJour : null

  const pente = tendancePoids(weighins, FENETRE_BILAN)
  const balance = pente !== null ? Math.round((pente * KCAL_PAR_KG) / 7) : null
  const apport = depenseMoyenne !== null && balance !== null ? depenseMoyenne + balance : null

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-sm font-extrabold text-ink">⚡ Balance énergétique</h2>

      {bmr === null ? (
        <p className="rounded-xl2 border border-copper/30 bg-copper/5 p-2 text-[11px] text-ink">
          Renseigne ta taille et ton année de naissance ci-dessous
          {poids === null ? ', et enregistre une pesée,' : ''} pour estimer ta dépense.
        </p>
      ) : (
        <>
          <div>
            <div className="text-3xl font-extrabold text-ink">
              {depenseDuJour?.toLocaleString('fr-FR')} <span className="text-lg font-bold text-muted">kcal</span>
            </div>
            <div className="text-xs text-muted">
              dépensées aujourd'hui
              {/* Sous ce seuil, l'écart n'est que la différence de poids de
                  corps entre hier et aujourd'hui : « +1 kcal vs hier » n'est
                  pas une information, c'est du bruit affiché en couleur. */}
              {Math.abs(sportDuJour - sportHier) >= ECART_VISIBLE ? (
                <span className={sportDuJour > sportHier ? 'text-sage-dark' : 'text-muted'}>
                  {' · '}
                  {sportDuJour > sportHier ? '+' : ''}
                  {(sportDuJour - sportHier).toLocaleString('fr-FR')} kcal de sport vs hier
                </span>
              ) : null}
            </div>
          </div>

          <div>
            {ligne('Métabolisme de base', `${bmr.toLocaleString('fr-FR')} kcal`, 'au repos complet')}
            {ligne('Vie courante', `+ ${(base! - bmr).toLocaleString('fr-FR')} kcal`, `×${FACTEUR_NEAT} sur 24 h`)}
            {ligne(
              'Entraînement',
              `+ ${sportDuJour.toLocaleString('fr-FR')} kcal`,
              // Ce que tu as fait, nommément : c'est ça qui rend le chiffre du
              // jour vérifiable d'un coup d'œil.
              seancesDuJour.length ? seancesDuJour.join(', ') : 'aucune séance aujourd’hui',
            )}
          </div>
          <p className="text-[10px] leading-snug text-muted">
            La vie courante couvre déjà les 24 h : « Entraînement » ne compte que ce que la séance ajoute
            par-dessus, sinon la salle serait facturée deux fois.
            {' '}<b className="text-ink">
              Moyenne sur {FENETRE_BILAN} j : {depenseMoyenne?.toLocaleString('fr-FR')} kcal/jour.
            </b>
          </p>
        </>
      )}

      {balance !== null && depenseMoyenne !== null ? (
        <div className="rounded-xl2 border border-line bg-white/5 p-3">
          <div className="text-xs font-bold text-ink">
            📉 Ta courbe de poids dit : {pente! > 0 ? '+' : ''}
            {pente!.toFixed(2)} kg/semaine
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Soit un{' '}
            <b className={balance < 0 ? 'text-sage-dark' : balance > 0 ? 'text-clay' : 'text-ink'}>
              {balance < 0 ? 'déficit' : balance > 0 ? 'surplus' : 'équilibre'} d'environ{' '}
              {Math.abs(balance).toLocaleString('fr-FR')} kcal/jour
            </b>
            . Comparé à ta dépense MOYENNE, ton apport tourne autour de{' '}
            <b className="text-ink">{apport?.toLocaleString('fr-FR')} kcal/jour</b>, sans avoir rien pesé — une
            pente de {FENETRE_BILAN} jours se compare à une dépense de {FENETRE_BILAN} jours, pas à celle
            d'aujourd'hui.
          </p>

        </div>
      ) : poids !== null ? (
        <p className="text-[11px] text-muted">
          Trois pesées étalées sur au moins une semaine et je pourrai déduire ta balance réelle.
        </p>
      ) : null}

      {/* Profil : change rarement, reste discret */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[11px] font-semibold text-copper">
          ⚙️ Profil{profil.birthYear ? ` — ${profil.heightCm} cm · ${age(profil)} ans` : ' — à renseigner'}
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted">
            <input
              className="field w-20"
              type="number"
              inputMode="numeric"
              value={profil.heightCm || ''}
              onChange={(e) => onProfil({ ...profil, heightCm: Number(e.target.value) || 0 })}
            />
            cm
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            <input
              className="field w-24"
              type="number"
              inputMode="numeric"
              placeholder="année nais."
              value={profil.birthYear ?? ''}
              onChange={(e) => onProfil({ ...profil, birthYear: Number(e.target.value) || null })}
            />
          </label>
          <div className="flex gap-1">
            {(['H', 'F'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onProfil({ ...profil, sex: s })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  profil.sex === s ? 'bg-copper text-white' : 'bg-bg text-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          Mifflin-St Jeor, ±10 %. Un kilo de masse vaut ~{KCAL_PAR_KG.toLocaleString('fr-FR')} kcal.
        </p>
      </details>
    </section>
  )
}
