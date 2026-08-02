import { INTENSITES } from './intensite'
import { sessionCalories } from './calories'
import { fmtTonnage, seancesRecentes, sessionTonnage, estRessenti, FENETRE_STATS, type MuscuSession } from './muscu'
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

export interface ContexteExport {
  sessions: MuscuSession[]
  bodyWeight: number | null
  weighins?: Weighin[]
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

  const aujourdhui = new Date(maintenant).toLocaleDateString('en-CA')
  const lignes: string[] = [`# Entraînement — ${jours} derniers jours (au ${frDate(aujourdhui)})`, '']

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

  lignes.push('', '## Séances', '')
  for (const s of retenues) {
    lignes.push(blocSeance(s, ctx.bodyWeight))
    lignes.push('')
  }
  return lignes.join('\n').trimEnd() + '\n'
}
