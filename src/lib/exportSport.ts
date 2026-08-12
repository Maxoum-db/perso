import { INTENSITES } from './intensite'
import { sessionCalories } from './calories'
import {
  exerciseProgress,
  fmtTonnage,
  seancesRecentes,
  sessionTonnage,
  estRessenti,
  FENETRE_STATS,
  type MuscuSession,
} from './muscu'
import { bilanCharge, VERDICTS } from './trainingLoad'
import { evaluerForme } from './forme'
import { chargesCourantes } from './charges'
import { etatParZone, fmtDelai, reposParMuscle } from './recuperation'
import { MUSCLE_LABELS } from './muscles'
import { bilanParZone, MIN_OBSERVATIONS, type Observations } from './observations'
import { dette, moyenneNet, qualifieNuit, sommeilNet, type Nuits } from './sommeil'
import { metabolismeDeBase, tendancePoids, type Profil } from './profil'
import { FOCUS, type FocusId } from './focus'
import type { Courbatures } from './soreness'
import type { Weighin } from './workouts'

// Export texte du sport récent, pour aller le coller ailleurs — NotebookLM, une
// note, un message au coach.
//
// Du texte et non du JSON : la destination est un lecteur, humain ou modèle de
// langage, pas un programme. Un JSON de trente séances demande d'être interprété
// avant d'être lu, alors qu'une ligne « Squat barre arrière · 5 × 5 · 100 kg »
// se comprend seule. Les en-têtes en markdown parce que c'est ce que les deux
// savent lire.
//
// Fonction PURE, séparée du bouton : c'est le seul moyen de vérifier ce qui
// sort. Un export construit dans le composant ne se contrôle qu'à l'œil, et une
// séance manquante dans un mur de texte ne se voit pas.

/** Nombre de séances au maximum, même si la fenêtre en contient plus. */
export const PLAFOND_SEANCES = 30

/**
 * Jusqu'où va l'export.
 *
 * Deux portées et non deux fonctions : l'en-tête, le résumé, la fenêtre, le
 * plafond et le format des séances sont les mêmes des deux côtés. Deux
 * assembleurs auraient fini par ne plus produire le même document pour la partie
 * commune — et c'est la partie qu'on relit le plus.
 *
 *   • `sport`   — ce qui s'est passé : le journal et son résumé. Court, se relit
 *                 d'un coup d'œil, se colle dans un message.
 *   • `complet` — tout le module : charge, sommeil, poids, progression,
 *                 récupération, écarts au barème, réglages. Pour faire analyser.
 */
export type PorteeExport = 'sport' | 'complet'

export interface ContexteExport {
  sessions: MuscuSession[]
  bodyWeight: number | null
  weighins?: Weighin[]
  nuits?: Nuits
  observations?: Observations
  courbatures?: Courbatures
  profil?: Profil
  focus?: FocusId[]
  behourd?: boolean
  /** Défaut : `complet`. */
  portee?: PorteeExport
  /** Fenêtre en jours. */
  jours?: number
  maintenant?: number
}

/** « 2 août 2026 », dans la langue de l'appli. */
function frDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Une ligne d'exercice : ce qu'on a fait, et avec quoi. */
function ligneExo(e: MuscuSession['exercises'][number]): string {
  // Le ressenti n'a ni séries ni charge : il porte les zones et leur part. Le
  // formater comme un exercice donnerait « Ressenti de séance · 1 × 1 », soit
  // trois mots faux pour un béhourd de 90 minutes.
  if (estRessenti(e.name)) return `  - Ressenti — zones : ${e.muscle_group}`
  const bouts = [`${e.sets} × ${e.reps}`]
  if (e.weight_kg !== null && e.weight_kg > 0) bouts.push(`${e.weight_kg} kg`)
  else bouts.push('poids du corps')
  if (e.doux) bouts.push('version douce')
  const suffixe = e.notes?.trim() ? ` — ${e.notes.trim()}` : ''
  return `  - ${e.name} · ${bouts.join(' · ')} · [${e.muscle_group}]${suffixe}`
}

function blocSeance(s: MuscuSession, bodyWeight: number | null): string {
  const cal = sessionCalories(s, bodyWeight)
  const tonnage = sessionTonnage(s.exercises)
  const entete = [
    `### ${frDate(s.date)} — ${s.name}`,
    // « estimée » explicitement : sans ça, une durée déduite des exercices se
    // lit comme une durée mesurée, et c'est la seule donnée de la ligne qui
    // n'en soit pas une.
    `Durée : ${cal.minutes} min${cal.dureeEstimee ? ' (estimée)' : ''}`,
    `Dépense : ~${cal.kcal} kcal`,
  ]
  if (tonnage > 0) entete.push(`Tonnage : ${fmtTonnage(tonnage)}`)
  if (s.intensite) entete.push(`Intensité déclarée : ${INTENSITES[s.intensite].label}`)
  const lignes = [entete.join(' · ').replace(' · Durée', '\nDurée')]
  for (const e of s.exercises) lignes.push(ligneExo(e))
  if (s.notes?.trim()) lignes.push(`  Note : ${s.notes.trim()}`)
  return lignes.join('\n')
}

// ── Les blocs ───────────────────────────────────────────────────────────────
//
// Un bloc par question qu'on peut poser aux données, et chacun sa fonction.
// Découpé ainsi plutôt qu'en un seul long formateur parce que c'est ce qui rend
// chaque partie vérifiable séparément — et parce qu'un bloc sans données doit
// pouvoir disparaître sans laisser un titre orphelin derrière lui.

/** Rien à dire ? Le bloc ne s'écrit pas du tout. */
function bloc(titre: string, lignes: string[]): string[] {
  return lignes.length ? [`## ${titre}`, ...lignes, ''] : []
}

/**
 * La charge d'entraînement : l'indicateur de risque, pas le volume.
 *
 * Le ratio aigu sur chronique est ce que le reste ne dit pas — trois grosses
 * séances valent ce qu'elles valent selon ce qu'on faisait le mois d'avant.
 */
function blocCharge(sessions: MuscuSession[], bodyWeight: number | null): string[] {
  const c = bilanCharge(sessions)
  if (c.aigue === 0 && c.chronique === 0) return []
  const forme = evaluerForme(sessions, [])
  const lignes = [
    `- 7 derniers jours : ${Math.round(c.aigue).toLocaleString('fr-FR')} MET·min`,
    `- Moyenne hebdomadaire sur 28 jours : ${Math.round(c.chronique).toLocaleString('fr-FR')} MET·min`,
  ]
  if (c.ratio !== null) {
    lignes.push(`- Ratio aigu/chronique : ${c.ratio.toFixed(2)} — ${VERDICTS[c.verdict].label}`)
    lignes.push(`  ${VERDICTS[c.verdict].conseil}`)
  }
  lignes.push(`- Semaine par semaine (de la plus ancienne) : ${c.semaines.map((s) => Math.round(s)).join(' · ')}`)
  lignes.push(`- État de forme déduit : ${forme.label}`)
  for (const r of forme.raisons) lignes.push(`  · ${r}`)
  if (bodyWeight !== null) lignes.push(`- Poids de référence utilisé pour la dépense : ${bodyWeight} kg`)
  return bloc('Charge d’entraînement', lignes)
}

/**
 * Le sommeil, nuit par nuit.
 *
 * Nuit par nuit et pas seulement en moyenne : c'est le croisement avec les
 * dates de séance qui a de la valeur, et une moyenne l'interdit. C'est aussi la
 * seule donnée du module qui explique une mauvaise séance sans être dedans.
 */
function blocSommeil(nuits: Nuits, jours: number, aujourdhui: string): string[] {
  const debut = new Date(aujourdhui + 'T12:00:00')
  debut.setDate(debut.getDate() - jours + 1)
  const min = debut.toLocaleDateString('en-CA')
  const retenues = Object.entries(nuits)
    .filter(([d]) => d >= min && d <= aujourdhui)
    .sort((a, b) => b[0].localeCompare(a[0]))
  if (!retenues.length) return []
  const moy = moyenneNet(nuits, jours, aujourdhui)
  const lignes = [
    `- Nuits renseignées : ${retenues.length} sur ${jours}`,
    ...(moy !== null ? [`- Sommeil net moyen : ${moy.toFixed(1)} h`] : []),
    `- Dette sur 7 jours (référence 8 h) : ${dette(nuits, 7, aujourdhui).toFixed(1)} h`,
    '',
    '| Réveil | Au lit | Réveils | Éveillé | Net | Qualité |',
    '| --- | --- | --- | --- | --- | --- |',
    ...retenues.map(
      ([d, n]) =>
        `| ${d} | ${n.heures} h | ${n.reveils} | ${n.minutesEveille} min | ${sommeilNet(n).toFixed(1)} h | ${qualifieNuit(n)} |`,
    ),
  ]
  return bloc('Sommeil', lignes)
}

/** Les pesées de la période, et la pente. */
function blocPoids(weighins: Weighin[], profil: Profil | undefined, jours: number, aujourdhui: string): string[] {
  const debut = new Date(aujourdhui + 'T12:00:00')
  debut.setDate(debut.getDate() - jours + 1)
  const min = debut.toLocaleDateString('en-CA')
  const retenues = weighins
    .filter((w) => w.date >= min && w.date <= aujourdhui)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!retenues.length) return []
  const pente = tendancePoids(weighins)
  const lignes: string[] = []
  if (pente !== null) lignes.push(`- Tendance sur 28 jours : ${pente >= 0 ? '+' : '−'}${Math.abs(pente).toFixed(2)} kg/semaine`)
  if (profil) {
    const mb = metabolismeDeBase(profil, retenues[0].weight_kg)
    if (mb !== null) lignes.push(`- Métabolisme de base estimé : ${mb} kcal/jour (${profil.heightCm} cm, ${profil.sex})`)
  }
  lignes.push('', ...retenues.map((w) => `- ${w.date} · ${w.weight_kg} kg`))
  return bloc('Poids', lignes)
}

/**
 * La progression, exercice par exercice.
 *
 * Le bloc qui répond à « est-ce que je progresse » — question qu'aucune liste
 * de séances ne permet de trancher sans tout relire et tout recouper à la main.
 *
 * Calculé sur TOUT l'historique, affiché sur la fenêtre. Les deux, parce qu'ils
 * ne répondent pas à la même chose : un record établi il y a trois mois reste le
 * record, et le tronquer à trente jours ferait passer pour un sommet ce qui
 * n'est qu'une reprise. La courbe, elle, reste dans la fenêtre — sinon un
 * exercice fait depuis deux ans occuperait vingt lignes.
 *
 * Ne sont listés que les exercices touchés PENDANT la fenêtre : le bloc décrit
 * la période, pas la bibliothèque.
 */
function blocProgression(sessions: MuscuSession[], depuis: string): string[] {
  const progres = exerciseProgress(sessions)
    .map((p) => ({ ...p, recents: p.points.filter((pt) => pt.date >= depuis) }))
    // Au moins deux mesures, sinon il n'y a pas de progression à lire — et au
    // moins une dans la fenêtre, sinon l'exercice n'appartient pas à la période.
    .filter((p) => p.points.length >= 2 && p.recents.length >= 1)
    .sort((a, b) => b.recents.length - a.recents.length || b.points.length - a.points.length)
  if (!progres.length) return []
  const lignes: string[] = []
  for (const p of progres) {
    const records: string[] = [`${p.points.length} séances au total`]
    if (p.best) records.push(`record ${p.best.weight} kg le ${p.best.date}`)
    if (p.bestTonnage) records.push(`meilleur tonnage ${fmtTonnage(p.bestTonnage.value)} le ${p.bestTonnage.date}`)
    lignes.push(`- **${p.name}** — ${records.join(' · ')}`)
    lignes.push(
      `  ${p.recents
        .map((pt) => `${pt.date}: ${pt.weight === null ? 'PDC' : pt.weight + ' kg'} ${pt.sets}×${pt.reps}`)
        .join(' | ')}`,
    )
  }
  return bloc('Progression par exercice', [
    '_Records sur tout l’historique ; la courbe ne montre que la période._',
    '',
    ...lignes,
  ])
}

/**
 * L'état de récupération à l'instant de l'export.
 *
 * Une PHOTO, et le texte le dit : contrairement à tout le reste du document,
 * ce bloc n'est pas une série temporelle. Sans cet avertissement, un lecteur en
 * tirerait une tendance qui n'y est pas.
 */
function blocRecuperation(
  sessions: MuscuSession[],
  courbatures: Courbatures,
  nuits: Nuits,
  maintenant: number,
): string[] {
  const zones = etatParZone(reposParMuscle(chargesCourantes(sessions, courbatures, nuits, maintenant)))
  if (!zones.length) return []
  const lignes = [
    '_Photo à l’instant de l’export, pas une série : cette section décrit maintenant, pas la période._',
    '',
    ...zones.map(
      (z) =>
        `- ${z.zone} — ${z.pret ? 'prêt' : `revient dans ${fmtDelai(z.reste)}`}` +
        ` (muscle qui commande : ${MUSCLE_LABELS[z.region]}, ${z.jours.toFixed(1)} j ressentis)`,
    ),
  ]
  return bloc('État de récupération', lignes)
}

/**
 * Ce que tes déclarations disent du barème lui-même.
 *
 * Le seul bloc qui ne parle pas de ton entraînement mais du modèle qui le lit :
 * pour chaque zone, l'écart moyen entre ce que le barème prévoyait et ce que tu
 * as déclaré ressentir. C'est la matière d'un réglage, à condition qu'il y ait
 * assez d'observations — d'où le seuil, rappelé dans le texte plutôt que
 * silencieusement appliqué.
 */
function blocObservations(obs: Observations): string[] {
  const zones = bilanParZone(obs).filter((z) => z.n > 0)
  if (!zones.length) return []
  const lignes = [
    `_Écart entre le barème et ton ressenti déclaré. Positif = tu récupères plus lentement que prévu._`,
    `_En dessous de ${MIN_OBSERVATIONS} observations, l’écart est indicatif et ne justifie aucun réglage._`,
    '',
    '| Zone | Obs. | Écart moyen | Vitesse actuelle | Vitesse suggérée | « Totalement bon » |',
    '| --- | --- | --- | --- | --- | --- |',
    ...zones.map(
      (z) =>
        `| ${z.label} | ${z.n} | ${z.ecart >= 0 ? '+' : '−'}${Math.abs(z.ecart).toFixed(2)} j | ` +
        `${z.vitesse.toFixed(2)} | ${z.n >= MIN_OBSERVATIONS ? z.vitesseSuggeree.toFixed(2) : '—'} | ${z.prets} |`,
    ),
  ]
  return bloc('Ressentis déclarés contre barème', lignes)
}

/** Les réglages qui expliquent pourquoi les séances proposées ressemblent à ça. */
function blocReglages(focus: FocusId[] | undefined, behourd: boolean | undefined): string[] {
  const lignes: string[] = []
  const utiles = focus ?? []
  if (utiles.length) lignes.push(`- Point faible travaillé en priorité : ${utiles.map((f) => FOCUS[f].label).join(', ')}`)
  if (behourd) lignes.push('- Mode béhourd actif : les séances proposées privilégient le port d’armure et le combat.')
  return bloc('Réglages', lignes)
}

/**
 * De quoi lire le document sans connaître l'application.
 *
 * Trois notations y sont opaques pour qui arrive dessus — et c'est justement le
 * cas d'un modèle de langage à qui on colle le texte. Les expliquer coûte cinq
 * lignes et évite une analyse fondée sur un contresens.
 */
function blocLecture(portee: PorteeExport): string[] {
  return [
    '## Comment lire ce document',
    '- `[Quadriceps:1, Grand fessier:0.8]` — les muscles travaillés et leur part dans l’exercice (1 = moteur principal).',
    // Ces deux-là ne servent qu'aux blocs d'analyse : les expliquer dans
    // l'export court apprendrait un vocabulaire qui n'y apparaît nulle part.
    ...(portee === 'complet'
      ? [
          '- « jours ressentis » — jours de récupération au sens du barème, pondérés par l’intensité et la vitesse propre au muscle. Différent des jours écoulés.',
          '- « MET·min » — durée × intensité métabolique. Sert à comparer des séances de nature différente.',
          '- « PDC » — au poids du corps, sans charge additionnelle.',
        ]
      : []),
    '- Les dépenses en kcal sont des ESTIMATIONS de modèle, pas des mesures.',
    '',
  ]
}

/**
 * Le sport des N derniers jours, en texte prêt à coller.
 *
 * Fenêtre GLISSANTE et plafonnée. Les deux, parce que la demande disait les
 * deux — « les 30 derniers jours (30 dernières séances) » — et qu'elles ne
 * coïncident pas : une semaine à cinq séances peut faire déborder la fenêtre.
 * La fenêtre commande, le plafond protège du pavé illisible, et l'en-tête
 * annonce ce qui a réellement été retenu plutôt que de laisser croire à
 * l'exhaustivité.
 */
export function exporterSport(ctx: ContexteExport): string {
  const jours = ctx.jours ?? FENETRE_STATS
  const maintenant = ctx.maintenant ?? Date.now()
  const fenetre = seancesRecentes(ctx.sessions, jours, maintenant)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
  const retenues = fenetre.slice(0, PLAFOND_SEANCES)

  const portee = ctx.portee ?? 'complet'
  const aujourdhui = new Date(maintenant).toLocaleDateString('en-CA')
  const titre = portee === 'complet' ? 'Bilan complet' : 'Entraînement'
  const lignes: string[] = [`# ${titre} — ${jours} derniers jours (au ${frDate(aujourdhui)})`, '']

  if (retenues.length === 0) {
    lignes.push(`Aucune séance enregistrée sur les ${jours} derniers jours.`)
    return lignes.join('\n')
  }

  // Le résumé d'abord : c'est ce qu'on lit quand on ne lit pas tout.
  const kcal = retenues.reduce((t, s) => t + sessionCalories(s, ctx.bodyWeight).kcal, 0)
  const minutes = retenues.reduce((t, s) => t + sessionCalories(s, ctx.bodyWeight).minutes, 0)
  const tonnage = retenues.reduce((t, s) => t + sessionTonnage(s.exercises), 0)
  lignes.push('## Résumé')
  lignes.push(`- Séances : ${retenues.length}${fenetre.length > retenues.length ? ` (sur ${fenetre.length} — les plus récentes)` : ''}`)
  lignes.push(`- Temps total : ${Math.round(minutes / 60)} h ${minutes % 60} min`)
  lignes.push(`- Dépense estimée : ${kcal.toLocaleString('fr-FR')} kcal`)
  if (tonnage > 0) lignes.push(`- Tonnage cumulé : ${fmtTonnage(tonnage)}`)

  const pesees = (ctx.weighins ?? [])
    .filter((w) => w.date <= aujourdhui)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (pesees.length) {
    const derniere = pesees[0]
    // La plus ancienne DE LA FENÊTRE, pas la plus ancienne connue : sur deux
    // ans de pesées, l'écart annoncé aurait été celui de deux ans.
    const debut = new Date(maintenant)
    debut.setDate(debut.getDate() - jours + 1)
    const dansFenetre = pesees.filter((w) => w.date >= debut.toLocaleDateString('en-CA'))
    const premiere = dansFenetre[dansFenetre.length - 1]
    const delta = premiere && premiere !== derniere ? derniere.weight_kg - premiere.weight_kg : null
    lignes.push(
      `- Poids : ${derniere.weight_kg} kg (${frDate(derniere.date)})` +
        (delta !== null ? `, ${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg sur la période` : ''),
    )
  }

  lignes.push('')
  lignes.push(...blocLecture(portee))
  if (portee === 'complet') {
    lignes.push(...blocCharge(retenues, ctx.bodyWeight))
    lignes.push(...blocPoids(ctx.weighins ?? [], ctx.profil, jours, aujourdhui))
    lignes.push(...blocSommeil(ctx.nuits ?? {}, jours, aujourdhui))
  }

  lignes.push('## Séances', '')
  for (const s of retenues) {
    lignes.push(blocSeance(s, ctx.bodyWeight))
    lignes.push('')
  }

  if (portee === 'complet') {
    // Sur TOUTES les séances : les records n'ont pas de raison de s'arrêter à la
    // fenêtre, et `blocProgression` limite la courbe à la période.
    const debutFenetre = new Date(maintenant)
    debutFenetre.setDate(debutFenetre.getDate() - jours + 1)
    lignes.push(...blocProgression(ctx.sessions, debutFenetre.toLocaleDateString('en-CA')))
    // Sur TOUTES les séances aussi : un muscle travaillé il y a quarante jours
    // est justement celui qu'on a oublié, et le masquer ferait dire à la photo
    // que tout va bien.
    lignes.push(...blocRecuperation(ctx.sessions, ctx.courbatures ?? {}, ctx.nuits ?? {}, maintenant))
    lignes.push(...blocObservations(ctx.observations ?? []))
    lignes.push(...blocReglages(ctx.focus, ctx.behourd))
  }

  return lignes.join('\n').trimEnd() + '\n'
}
