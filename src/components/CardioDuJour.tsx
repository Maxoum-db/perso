import { useEffect, useState } from 'react'
import { MesureRepos } from './MesureRepos'
import {
  loadCardios,
  loadFcMaxRelevee,
  loadRepos,
  oublierRepos,
  saveFcMaxRelevee,
  type CardiosSeances,
  type MesureRepos as Mesure,
} from '../lib/cardioSeance'
import { chercherFcMax, decalageZone, type Proposition } from '../lib/fcMaxObservee'
import { fcMaxEstimee } from '../lib/cardio'
import { age, loadProfil, PROFIL_DEFAUT, type Profil } from '../lib/profil'
import { baseDe, COULEUR_VERDICT, fmtEcart, INTERVALLES_MIN, lireRecup, mesureFiable } from '../lib/recupCardiaque'
import { bilanCardiaque, ecartMoyenne, type BilanCardiaque } from '../lib/chargeCardiaque'
import { PolarFlowSeances } from './PolarFlow'

// Le cardio là où l'on s'entraîne, et plus dans les réglages.
//
// ── Pourquoi ça déménage ────────────────────────────────────────────────────
//
// La mesure au repos vivait dans les paramètres, à côté de la fréquence
// maximale. C'était l'erreur de ranger deux choses ensemble parce qu'elles
// parlent du même capteur : la fréquence maximale se règle une fois par an, la
// mesure se prend TOUS LES MATINS. Une chose qu'on fait quotidiennement ne se
// range pas derrière un engrenage, à trois touches de l'écran où l'on décide de
// sa séance — et c'est justement là qu'elle sert, puisque ce qu'elle dit,
// c'est s'il faut y aller fort aujourd'hui.
//
// ── Ce que cette carte n'est pas ────────────────────────────────────────────
//
// Elle ne suit pas en continu. Une page web ne peut pas : le Bluetooth du
// navigateur s'arrête dès que l'écran se verrouille. C'est écrit dans le volet
// d'explication plutôt que tu, parce qu'une absence non expliquée passe pour
// une panne.

export function CardioDuJour({
  userId,
  seances,
  polarActif,
  onSeanceCreee,
}: {
  userId: string
  /** Les séances connues — elles datent les mesures cardiaques, rangées par identifiant. */
  seances: Array<{ id: string; date: string }>
  /** L'option Polar Flow est-elle allumée pour ce compte ? */
  polarActif: boolean
  onSeanceCreee?: () => void
}) {
  const [historique, setHistorique] = useState<Mesure[]>([])
  const [cardios, setCardios] = useState<CardiosSeances>({})
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  const [relevee, setRelevee] = useState<number | null>(null)
  const [ouvert, setOuvert] = useState<'mesure' | 'historique' | 'aide' | null>(null)

  useEffect(() => {
    if (!userId) return
    loadRepos(userId).then(setHistorique).catch(() => {})
    loadCardios(userId).then(setCardios).catch(() => {})
    loadProfil(userId).then(setProfil).catch(() => {})
    loadFcMaxRelevee(userId).then(setRelevee).catch(() => {})
  }, [userId])

  const derniere = historique[0] ?? null
  const base = baseDe(historique)
  const lecture = lireRecup(derniere, base)
  const couleur = COULEUR_VERDICT[lecture.verdict]
  const bilan = bilanCardiaque(cardios, seances)
  const fcMax = relevee ?? fcMaxEstimee(age(profil))
  const proposition = chercherFcMax(cardios, fcMax)

  function basculer(v: 'mesure' | 'historique' | 'aide') {
    setOuvert((x) => (x === v ? null : v))
  }

  return (
    <section className="card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">❤️ Récupération &amp; charge cardiaque</h2>
        <button onClick={() => basculer('aide')} className="shrink-0 text-[10px] text-muted underline">
          24/24 ?
        </button>
      </div>

      {/* Le verdict du matin, en premier : c'est ce qu'on vient chercher avant
          de décider de la séance. */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base font-bold" style={{ color: couleur }}>
            {lecture.verdict === 'inconnu' ? 'Pas encore de référence' : lecture.verdict}
          </span>
          {lecture.z !== null ? (
            <span className="text-xs tabular-nums" style={{ color: couleur }}>
              {fmtEcart(lecture.z)}
            </span>
          ) : null}
          {derniere ? <span className="text-[10px] text-muted">{quand(derniere.date)}</span> : null}
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted">{lecture.aide}</p>
        {derniere ? (
          <p className="mt-1 text-[11px] text-muted/80">
            {derniere.bpm} bpm
            {derniere.rmssd !== null ? ` · variabilité ${derniere.rmssd} ms` : ' · pas de variabilité'} ·{' '}
            {derniere.intervalles} intervalles
            {base.rmssd !== null ? ` — ta base : ${base.bpm} bpm · ${base.rmssd} ms (± ${base.ecartType}), sur ${base.mesures} mesures` : ''}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => basculer('mesure')}
          className={`chip text-[11px] ${ouvert === 'mesure' ? 'bg-copper/20 text-copper' : 'bg-bg text-ink'}`}
        >
          {ouvert === 'mesure' ? '▴ Mesure du matin' : '▾ Prendre la mesure'}
        </button>
        {historique.length ? (
          <button
            onClick={() => basculer('historique')}
            className={`chip text-[11px] ${ouvert === 'historique' ? 'bg-copper/20 text-copper' : 'bg-bg text-muted'}`}
          >
            {ouvert === 'historique' ? '▴' : '▾'} {historique.length} mesure{historique.length > 1 ? 's' : ''}
          </button>
        ) : null}
      </div>

      {ouvert === 'mesure' ? <MesureRepos userId={userId} historique={historique} onFini={setHistorique} /> : null}

      {ouvert === 'historique' ? (
        <Historique
          historique={historique}
          onOublier={(date) => {
            oublierRepos(userId, date, historique).then(setHistorique).catch(() => {})
          }}
        />
      ) : null}

      {ouvert === 'aide' ? <PourquoiPasEnContinu /> : null}

      {proposition && fcMax !== null ? (
        <PropositionFcMax
          p={proposition}
          actuelle={fcMax}
          estimee={relevee === null}
          date={seances.find((x) => x.id === proposition.sessionId)?.date ?? null}
          onRetenir={() => {
            saveFcMaxRelevee(userId, proposition.bpm)
              .then(() => setRelevee(proposition.bpm))
              .catch(() => {})
          }}
        />
      ) : null}

      <ChargeSemaine bilan={bilan} />

      {polarActif ? <PolarFlowSeances userId={userId} journal={seances} onSeanceCreee={onSeanceCreee} /> : null}
    </section>
  )
}

function quand(iso: string): string {
  const d = new Date(iso)
  const jours = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (jours <= 0) return 'aujourd’hui'
  if (jours === 1) return 'hier'
  return `il y a ${jours} jours`
}

/**
 * L'historique, avec de quoi retirer une mesure ratée.
 *
 * Indispensable, et pas un confort : une mesure prise debout, ou pendant
 * laquelle on a parlé, entre dans la base et la déplace — et comme la base sert
 * ensuite de référence à toutes les suivantes, une seule mesure fausse fausse
 * durablement les verdicts. Il faut pouvoir la sortir.
 */
function Historique({ historique, onOublier }: { historique: Mesure[]; onOublier: (date: string) => void }) {
  return (
    <ul className="space-y-1">
      {historique.map((m) => {
        const fiable = mesureFiable(m)
        return (
          <li key={m.date} className="flex items-center gap-2 rounded-xl2 bg-white/[0.03] px-2 py-1.5">
            <span className="w-16 shrink-0 text-[11px] text-muted">
              {new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
            <span className="flex-1 text-[11px] text-ink">
              {m.bpm} bpm{m.rmssd !== null ? ` · ${m.rmssd} ms` : ' · —'}
            </span>
            <span className={`shrink-0 text-[10px] ${fiable ? 'text-muted/70' : 'text-clay'}`}>
              {m.intervalles} int.{fiable ? '' : ` < ${INTERVALLES_MIN}`}
            </span>
            <button
              onClick={() => onOublier(m.date)}
              aria-label="Retirer cette mesure"
              className="shrink-0 px-1 text-[11px] text-muted hover:text-clay"
            >
              ✕
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * La charge cardiaque de la semaine.
 *
 * Elle ne rend pas de verdict — celui de la charge vit dans la carte de
 * récupération, en MET-minutes, et deux verdicts de charge côte à côte
 * finiraient par se contredire. Ici on montre des minutes : combien de facile,
 * combien de dur, et si la semaine pèse plus que d'habitude.
 */
function ChargeSemaine({ bilan }: { bilan: BilanCardiaque }) {
  const ecart = ecartMoyenne(bilan)
  if (!bilan.seances) {
    return (
      <p className="border-t border-line/40 pt-2 text-[11px] text-muted">
        Aucune séance mesurée au brassard ces 7 derniers jours.
      </p>
    )
  }
  return (
    <div className="border-t border-line/40 pt-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">7 derniers jours</span>
        <span className="text-xs font-bold text-ink">{bilan.trimp} points de charge</span>
        {ecart !== null ? (
          <span className={`text-[11px] tabular-nums ${ecart > 0 ? 'text-copper' : 'text-muted'}`}>
            {ecart > 0 ? '+' : ''}
            {ecart} % vs habitude
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        {bilan.seances} séance{bilan.seances > 1 ? 's' : ''} mesurée{bilan.seances > 1 ? 's' : ''} ·{' '}
        {bilan.minutesFaciles} min faciles · {bilan.minutesDures} min dures
        {bilan.partDure !== null ? ` (${Math.round(bilan.partDure * 100)} % de l’effort)` : ''}
      </p>
    </div>
  )
}

/**
 * La réponse à « pourquoi pas en permanence ».
 *
 * Écrite ici et pas seulement dite une fois : la question revient à chaque fois
 * qu'on ouvre l'écran et qu'il ne montre rien de la nuit.
 */
function PourquoiPasEnContinu() {
  return (
    <div className="space-y-1.5 rounded-xl2 border border-line/60 bg-white/[0.02] p-2.5 text-[11px] leading-snug text-muted">
      <p className="font-semibold text-ink">Pourquoi pas de suivi 24/24 ici</p>
      <p>
        Couanac parle au brassard par le Bluetooth du navigateur. Ce Bluetooth-là s’arrête dès que l’écran se verrouille
        ou qu’on change d’application : le navigateur coupe la page en arrière-plan, et rien ne peut l’en empêcher. Une
        application web n’a pas le droit de tourner en fond, quelle qu’elle soit.
      </p>
      <p>
        Le capteur, lui, sait enregistrer seul (mode vert) — mais il faut ensuite aller chercher le fichier dans sa
        mémoire, et seule l’application Polar sait le faire aujourd’hui.
      </p>
      <p className="text-ink">
        Ce qui marche, et ce que fait cette carte : une mesure de deux minutes chaque matin, toujours dans la même
        position, et la comparaison à ta propre base. C’est exactement l’information qu’un suivi continu sert à
        produire.
      </p>
    </div>
  )
}


/**
 * « Tu es monté plus haut que ce qu'on te suppose. »
 *
 * Proposé, jamais appliqué. Un capteur optique produit des artefacts : un
 * brassard qui glisse et une trame part à 210 sans que le cœur ait bougé. Le
 * calcul ne peut pas distinguer l'artefact de l'effort — les deux sont un
 * nombre élevé au milieu de nombres plus bas. La personne, elle, se souvient si
 * elle a tout donné ce jour-là.
 *
 * D'où la date et le nombre de trames à l'écran : de quoi reconnaître la
 * séance, et de quoi juger si le chiffre est solide.
 */
function PropositionFcMax({
  p,
  actuelle,
  estimee,
  date,
  onRetenir,
}: {
  p: Proposition
  actuelle: number
  /** La valeur actuelle est-elle une estimation d'après l'âge ? */
  estimee: boolean
  date: string | null
  onRetenir: () => void
}) {
  return (
    <div className="rounded-xl2 border border-copper/40 bg-copper/5 p-2.5">
      <div className="text-[11px] font-bold text-copper">Fréquence maximale à revoir</div>
      <p className="mt-0.5 text-[11px] leading-snug text-ink">
        Une séance a atteint <b>{p.bpm} bpm</b>, au-dessus des {actuelle} bpm {estimee ? 'estimés d’après ton âge' : 'que tu as relevés'}.
        {date ? ` Séance du ${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.` : ''}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-muted">
        {p.mesures > 0 ? `${p.mesures} trames sur cette séance. ` : 'Mesure relevée via Polar Flow. '}
        Un brassard qui glisse suffit à faire partir une trame trop haut — ne retiens cette valeur que si tu te souviens
        d’avoir vraiment tout donné. Tes zones se décaleraient d’environ {decalageZone(actuelle, p.bpm, 0.8)} bpm au
        seuil.
      </p>
      <button onClick={onRetenir} className="btn-ghost mt-1.5 px-2 py-1 text-[11px] text-copper">
        Retenir {p.bpm} bpm
      </button>
    </div>
  )
}
