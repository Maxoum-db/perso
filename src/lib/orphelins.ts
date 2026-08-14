import { cleExercice, clefReference } from '../data/exercises'
import { estRessenti, type CatalogExercise, type MuscuSession } from './muscu'

// Les lignes de séance qui ne désignent plus aucun exercice connu.
//
// ── Pourquoi ce fichier existe ──────────────────────────────────────────────
//
// Le défaut qu'il traque a vécu un mois sans se signaler. Vingt lignes de
// séances — dont neuf réellement faites — portaient le nom d'un exercice que le
// catalogue ne connaissait plus, parce qu'il y avait été renommé entre-temps.
// Rien ne le montrait : l'exercice s'affiche normalement, avec son nom, ses
// séries et sa charge. Il désigne simplement la moitié des muscles qu'il
// travaille, et son historique de charge est invisible à la progression.
//
// C'est la forme la plus coûteuse d'erreur de données : celle qui n'a aucun
// symptôme. Le garde-fou de `tools/verifier-etiquetage.mjs` couvre le CODE — la
// bibliothèque et la table de renvois, contrôlées à chaque build. Il ne peut
// rien dire de ce qui est déjà en base, chez chacun. D'où ce compteur, qui lit
// les mêmes données que l'application et répond à la seule question qui compte :
// « est-ce que tout ce que j'ai enregistré est encore rattaché à quelque
// chose ? »
//
// Le calcul reprend exactement la résolution de `appliquerCatalogue` : nom
// exact, puis renvoi. Si les deux échouent là-bas, ils échouent ici — un
// contrôle qui résoudrait autrement que l'application finirait par rassurer à
// tort.

export interface Orphelin {
  /** Le nom tel qu'il est écrit dans les séances. */
  nom: string
  /** Nombre de lignes de séance qui le portent. */
  passages: number
  /** Combien de ces passages portaient une charge — ce qui est perdu pour la progression. */
  passagesCharges: number
  /** Charge maximale enregistrée, s'il y en a une. */
  chargeMax: number | null
  /** Date du dernier passage. */
  derniere: string
}

/**
 * Les exercices du journal que le catalogue ne sait plus nommer.
 *
 * La ligne de RESSENTI est écartée : elle ne désigne aucun exercice par
 * construction, elle porte des zones déclarées à la main. La compter en
 * orphelin ferait clignoter une alerte sur un fonctionnement normal, ce qui est
 * le plus sûr moyen de faire ignorer l'alerte.
 */
export function orphelins(sessions: MuscuSession[], catalog: CatalogExercise[]): Orphelin[] {
  if (catalog.length === 0) return [] // catalogue pas encore chargé : tout serait orphelin
  const connus = new Set(catalog.map((c) => cleExercice(c.name)))
  const par = new Map<string, Orphelin>()

  for (const s of sessions) {
    for (const e of s.exercises) {
      if (estRessenti(e.name)) continue
      const nom = e.name.trim()
      if (!nom) continue
      if (connus.has(cleExercice(nom)) || connus.has(clefReference(nom))) continue

      const cur = par.get(cleExercice(nom)) ?? {
        nom,
        passages: 0,
        passagesCharges: 0,
        chargeMax: null,
        derniere: s.date,
      }
      cur.passages += 1
      if (e.weight_kg !== null && e.weight_kg > 0) {
        cur.passagesCharges += 1
        cur.chargeMax = Math.max(cur.chargeMax ?? 0, e.weight_kg)
      }
      if (s.date > cur.derniere) cur.derniere = s.date
      par.set(cleExercice(nom), cur)
    }
  }

  // Les plus coûteux d'abord : un orphelin chargé fait perdre une progression,
  // un orphelin sans charge ne fait perdre qu'un étiquetage.
  return [...par.values()].sort(
    (a, b) => b.passagesCharges - a.passagesCharges || b.passages - a.passages || a.nom.localeCompare(b.nom),
  )
}

/** Une phrase pour l'écran de réglages. */
export function resumeOrphelins(liste: Orphelin[]): string {
  if (liste.length === 0) return 'Tout le journal est rattaché au catalogue.'
  const lignes = liste.reduce((n, o) => n + o.passages, 0)
  const charges = liste.reduce((n, o) => n + o.passagesCharges, 0)
  const noms = `${liste.length} exercice${liste.length > 1 ? 's' : ''}`
  const passages = `${lignes} ligne${lignes > 1 ? 's' : ''} de séance`
  return charges > 0
    ? `${noms}, ${passages}, dont ${charges} avec une charge qui n’entre plus dans la progression.`
    : `${noms}, ${passages}.`
}
