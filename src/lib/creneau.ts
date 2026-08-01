// Quand caser la séance dans la journée.
//
// L'accueil sait ce qu'il y a à faire et combien de temps ça prend ; l'agenda
// sait ce qui occupe la journée. Croiser les deux répond à la seule question qui
// reste — « je la mets où ? » — sans avoir à ouvrir l'agenda et compter les
// trous à la main.

export interface Occupe {
  debut: number
  fin: number
}

export interface Creneau {
  debut: number
  fin: number
}

/** Heure à partir de laquelle on ne propose plus de séance. */
export const FIN_DE_JOURNEE = 22

/**
 * Fusionne les occupations qui se chevauchent ou se touchent.
 *
 * Deux réunions qui s'enchaînent ne laissent pas de trou entre elles : les
 * traiter séparément aurait fait apparaître des créneaux de zéro minute, et
 * pire, aurait coupé un vrai trou en deux morceaux trop courts.
 */
export function fusionner(occupes: Occupe[]): Occupe[] {
  const tries = [...occupes].filter((o) => o.fin > o.debut).sort((a, b) => a.debut - b.debut)
  const out: Occupe[] = []
  for (const o of tries) {
    const dernier = out[out.length - 1]
    if (dernier && o.debut <= dernier.fin) dernier.fin = Math.max(dernier.fin, o.fin)
    else out.push({ ...o })
  }
  return out
}

/**
 * Le premier trou d'au moins `minutes`, entre maintenant et la fin de journée.
 *
 * Rend `null` quand il n'y en a pas : c'est une réponse, et elle vaut mieux
 * qu'un créneau trop court proposé quand même. Le début est arrondi au quart
 * d'heure supérieur — « 19:00 » se retient, « 18:47 » se recalcule.
 */
export function premierCreneau(
  occupes: Occupe[],
  minutes: number,
  maintenant: number,
  finJournee: number,
): Creneau | null {
  const besoin = minutes * 60000
  let curseur = arrondirAuQuartDHeure(maintenant)
  for (const o of fusionner(occupes)) {
    if (o.fin <= curseur) continue
    if (o.debut - curseur >= besoin) return { debut: curseur, fin: curseur + besoin }
    curseur = Math.max(curseur, arrondirAuQuartDHeure(o.fin))
  }
  return finJournee - curseur >= besoin ? { debut: curseur, fin: curseur + besoin } : null
}

const QUART = 15 * 60000

function arrondirAuQuartDHeure(t: number): number {
  return Math.ceil(t / QUART) * QUART
}

/** L'instant de fin de journée, pour une date donnée. */
export function finDeJournee(maintenant: number): number {
  const d = new Date(maintenant)
  d.setHours(FIN_DE_JOURNEE, 0, 0, 0)
  return d.getTime()
}

/** « 19:00 → 20:00 ». */
export function fmtCreneau(c: Creneau): string {
  const h = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${h(c.debut)} → ${h(c.fin)}`
}
