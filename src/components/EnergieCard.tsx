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
// L'apport, lui, ne se devine pas — sauf par la balance. Un kilo de masse
// corporelle vaut ~7 700 kcal : la pente de la courbe de poids donne donc
// directement l'écart entre ce qui entre et ce qui sort, sans peser un seul
// aliment. C'est la mesure la plus fiable disponible ici.

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
  // Dépense NETTE, et sur la MÊME fenêtre que la pente de poids : les heures
  // d'entraînement sont déjà comptées dans la vie courante, on ne facture donc
  // que ce que la séance ajoute par-dessus.
  const bilan = bilanCalories(
    sessions,
    // Chaque séance au poids qu'il portait CE JOUR-LÀ : sur vingt-huit jours de
    // recomposition, la dernière pesée n'est pas celle d'il y a quatre semaines.
    poidsHistorique(weighins),
    FENETRE_BILAN,
    bmr ? depenseParHeure(bmr) : 0,
  )
  const sportParJour = bilan.moyenne
  const depense = base !== null ? base + sportParJour : null

  const pente = tendancePoids(weighins, FENETRE_BILAN)
  const balance = pente !== null ? Math.round((pente * KCAL_PAR_KG) / 7) : null
  const apport = depense !== null && balance !== null ? depense + balance : null

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
              {depense?.toLocaleString('fr-FR')} <span className="text-lg font-bold text-muted">kcal/jour</span>
            </div>
            <div className="text-xs text-muted">
              dépense totale estimée, moyenne sur {FENETRE_BILAN} jours
            </div>
          </div>

          <div>
            {ligne('Métabolisme de base', `${bmr.toLocaleString('fr-FR')} kcal`, 'au repos complet')}
            {ligne('Vie courante', `+ ${(base! - bmr).toLocaleString('fr-FR')} kcal`, `×${FACTEUR_NEAT} sur 24 h`)}
            {ligne('Entraînement', `+ ${sportParJour.toLocaleString('fr-FR')} kcal`, 'en plus de la vie courante')}
          </div>
          <p className="text-[10px] leading-relaxed text-muted">
            La vie courante couvre les vingt-quatre heures, entraînement compris. La ligne « Entraînement » ne
            compte donc que ce que la séance ajoute PAR-DESSUS ces heures-là — sinon le temps passé à la salle
            serait facturé deux fois. C'est pour ça qu'elle est plus basse que l'onglet « Calories brûlées », qui
            affiche, lui, la dépense brute d'une séance.
          </p>
        </>
      )}

      {balance !== null && depense !== null ? (
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
            . Ton apport tourne donc autour de <b className="text-ink">{apport?.toLocaleString('fr-FR')} kcal/jour</b>,
            sans avoir rien pesé.
          </p>
          <p className="mt-1.5 text-[10px] text-muted">
            Pour rester à 100 kg en gagnant du muscle, c'est l'équilibre qu'il faut viser — une balance stable avec
            des charges qui montent (onglet Progression).
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
          Formule de Mifflin-St Jeor, précise à ±10 % sur population générale. Un kilo de masse corporelle vaut
          ~{KCAL_PAR_KG.toLocaleString('fr-FR')} kcal.
        </p>
      </details>
    </section>
  )
}
