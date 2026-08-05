import { supabase } from './supabase'
import { ecrireCache, lireCache } from './cache'

// Qui voit quoi.
//
// Un seul compte voit tout de plein droit — le propriétaire. Pour les autres,
// c'est lui qui décide section par section, depuis les réglages.
//
// Deux règles qui ne se remplacent pas :
//
//   · la NAVIGATION cache ce qui n'est pas accordé. C'est le confort ;
//   · les ROUTES le refusent aussi. C'est la garantie — une adresse tapée à la
//     main, un signet, un lien reçu contournent le menu sans effort ;
//   · et la BASE le refuse encore, par ses politiques. C'est la seule barrière
//     qui tienne : tout ce qui vit dans le navigateur est modifiable par qui
//     l'exécute. Les deux premières rendent l'application juste, la troisième
//     la rend sûre.

/**
 * Le propriétaire, désigné par son adresse et non par son identifiant :
 * l'identifiant d'un compte recréé changerait, l'adresse non.
 *
 * ⚠️ Cette adresse est écrite ICI et dans les politiques de `perso_acces`. Deux
 * endroits, parce que la règle doit tenir côté base — où elle est
 * infalsifiable — autant que côté écran, où elle décide de ce qu'on affiche.
 * Le banc `acces` vérifie que les deux disent la même chose.
 */
export const PROPRIETAIRE = 'maximilien@ferme-promethee.fr'

export function estProprietaire(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === PROPRIETAIRE
}

export type Section =
  | 'agenda'
  | 'notes'
  | 'partage'
  | 'behourd'
  | 'course'
  | 'musculation'
  | 'brassage'
  | 'mails'

export const SECTIONS: Array<{ id: Section; label: string; icone: string; route: string; aide: string }> = [
  { id: 'agenda', label: 'Agenda', icone: '📅', route: '/agenda', aide: 'Rendez-vous et journée.' },
  { id: 'notes', label: 'Notes', icone: '📝', route: '/notes', aide: 'Notes, listes et tâches.' },
  { id: 'partage', label: 'À deux', icone: '💛', route: '/partage', aide: 'Ce qui est partagé entre vous.' },
  { id: 'behourd', label: 'Béhourd', icone: '🛡️', route: '/behourd', aide: 'Suivi de l’armure.' },
  { id: 'course', label: 'Course à pied', icone: '🏃', route: '/course', aide: 'Journal des sorties et progression.' },
  { id: 'musculation', label: 'Musculation', icone: '🏋️', route: '/musculation', aide: 'Séances, mannequin, récupération.' },
  { id: 'brassage', label: 'Brassage', icone: '🍺', route: '/brassage', aide: 'Brassins et fermentations.' },
  { id: 'mails', label: 'Mails', icone: '✉️', route: '/mails', aide: 'Boîte de réception (hors navigation).' },
]

/**
 * Sections toujours ouvertes, à tout le monde.
 *
 * L'accueil et les réglages n'ont jamais à être accordés : les retirer
 * enfermerait le compte dans une application sans porte de sortie — plus de
 * déconnexion, plus rien.
 */
export const TOUJOURS: string[] = ['/', '/reglages']

/**
 * Ce qu'un compte reçoit à sa création : la musculation et son agenda.
 *
 * C'est le socle — sans l'une on ne peut rien enregistrer, sans l'autre on ne
 * voit pas ses journées. Le reste s'accorde au cas par cas.
 *
 * ⚠️ Le défaut qui FAIT FOI est celui du déclencheur `perso_acces_nouveau_compte`
 * en base : il s'applique à la création du compte, avant même la première
 * connexion, et rien dans le navigateur ne doit pouvoir en décider. La liste
 * ci-dessous ne sert qu'à l'afficher. Le banc vérifie qu'elles concordent.
 */
export const DEFAUT_NOUVEAU_COMPTE: Section[] = ['musculation', 'agenda']

export interface Acces {
  user_id: string
  email: string | null
  sections: Section[]
}

/**
 * Le cache local, lu tout de suite au démarrage.
 *
 * Sans lui, la barre de navigation s'affiche vide puis se remplit — un
 * clignotement à chaque ouverture. Il ne fait AUTORITÉ sur rien : il décide de
 * ce qu'on montre pendant le premier dixième de seconde, la base décide de ce
 * qu'on peut réellement lire.
 *
 * Et il est rattaché au COMPTE : sans ça, le compte suivant sur le même
 * appareil démarrait sur les sections du précédent — et si la lecture en base
 * échouait, il y restait.
 */
export function accesEnCache(): Section[] | null {
  return lireCache<Section[] | null>('acces', null)
}

/** Les sections du compte courant. Le propriétaire a tout, sans lire la base. */
export async function chargerAcces(userId: string, email: string | null | undefined): Promise<Section[]> {
  if (estProprietaire(email)) {
    const tout = SECTIONS.map((s) => s.id)
    ecrireCache('acces', tout)
    return tout
  }
  const { data, error } = await supabase
    .from('perso_acces')
    .select('sections')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    // On ne devine pas en cas de panne : on rend ce qu'on savait déjà, et rien
    // si on ne savait rien. Ouvrir « au cas où » ferait de l'incident réseau
    // une porte dérobée.
    console.warn('Lecture des accès échouée :', error.message)
    return accesEnCache() ?? []
  }
  const sections = ((data?.sections as Section[]) ?? []).filter((s) => SECTIONS.some((x) => x.id === s))
  ecrireCache('acces', sections)
  return sections
}

/**
 * La liste des comptes et leurs accès. Réservé au propriétaire par la base :
 * un autre compte ne verra que sa propre ligne, quoi qu'il demande ici.
 *
 * L'adresse est recopiée dans cette table à la création du compte — `auth.users`
 * n'est pas lisible depuis le navigateur, et un écran qui n'afficherait que des
 * identifiants ne permettrait pas de savoir à qui on accorde quoi.
 */
export async function listerComptes(): Promise<Acces[]> {
  const { data, error } = await supabase.from('perso_acces').select('user_id, email, sections')
  if (error) throw new Error(error.message)
  const lignes = (data ?? []) as Array<{ user_id: string; email: string | null; sections: Section[] }>
  return lignes
    .map((l) => ({ user_id: l.user_id, email: l.email, sections: l.sections ?? [] }))
    .sort((a, b) => (a.email ?? a.user_id).localeCompare(b.email ?? b.user_id))
}

export async function enregistrerAcces(userId: string, sections: Section[]): Promise<void> {
  const { error } = await supabase
    .from('perso_acces')
    .upsert(
      { user_id: userId, sections, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error(error.message)
}

/**
 * Laquelle des deux disciplines afficher, croisée avec les accès.
 *
 * Le réglage choisit entre béhourd et course — mais il ne peut choisir que
 * parmi ce qui est ACCORDÉ. Si une seule des deux l'est, c'est celle-là,
 * quel que soit le réglage : sinon un compte à qui on a ouvert la course, et
 * dont le réglage est resté sur béhourd, se retrouve sans onglet du tout sans
 * comprendre pourquoi.
 */
export function disciplineAffichee(
  choisie: 'behourd' | 'course',
  sections: Section[],
): 'behourd' | 'course' | null {
  const accordees = (['behourd', 'course'] as const).filter((d) => sections.includes(d))
  if (accordees.length === 0) return null
  return accordees.includes(choisie) ? choisie : accordees[0]
}

/** La route est-elle ouverte à ces sections ? */
export function routeAutorisee(route: string, sections: Section[]): boolean {
  if (TOUJOURS.includes(route)) return true
  const s = SECTIONS.find((x) => x.route === route)
  // Une route inconnue de la table (une redirection, un rattrapage) n'est pas
  // gardée : elle ne montre rien par elle-même.
  return s ? sections.includes(s.id) : true
}
