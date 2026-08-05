// Le cache local, rattaché au COMPTE.
//
// Tout ce que l'application garde en local pour s'afficher sans attendre le
// réseau — courbatures, intensités, sommeil, réglages, accès — était rangé sous
// une clé qui ne nommait que la donnée : `hubperso.kv.muscu_intensites`. Sur un
// appareil utilisé par deux comptes, ou simplement après une déconnexion, le
// suivant lisait donc les valeurs du précédent.
//
// Deux conséquences, l'une visible et l'autre pas :
//
//   · au démarrage, l'écran montre les performances de quelqu'un d'autre
//     pendant le temps d'un aller-retour réseau ;
//   · et si cette lecture ÉCHOUE, le repli est ce même cache — les valeurs de
//     l'autre compte ne sont alors pas seulement affichées un instant, elles
//     font autorité pour toute la session.
//
// Ici, chaque clé porte l'identifiant du compte. Sans compte connu, il n'y a
// pas de cache du tout : mieux vaut un écran qui attend qu'un écran qui ment.

/** Marqueur du compte dont les caches sont en place, pour détecter un changement. */
const CLE_COMPTE = 'hubperso.compte'

/**
 * Préfixes purgés au changement de compte et à la déconnexion.
 *
 * Le préfixage suffit à ce qu'un compte ne LISE jamais le cache d'un autre. La
 * purge sert à autre chose : ne pas laisser les données de quelqu'un traîner
 * sur un appareil partagé après qu'il s'est déconnecté.
 *
 * `spotify.` et `hubperso.google.` en font partie : ce sont des jetons d'accès
 * à des comptes tiers, et ils n'ont aucune raison de survivre à leur session.
 */
const PREFIXES = ['hubperso.', 'spotify.']

/**
 * Le compte connecté, lu de façon SYNCHRONE dans la session persistée.
 *
 * On ne se contente pas d'un marqueur qu'on écrirait de notre côté : les caches
 * sont lus dès le premier rendu, avant que `getSession()` n'ait répondu. Un
 * marqueur mis à jour après coup laisserait donc, à chaque changement de
 * compte, une poignée d'images affichant les données du précédent — exactement
 * ce qu'on cherche à supprimer.
 *
 * Supabase range la session sous `sb-<projet>-auth-token`. Si ce format change,
 * on ne trouve rien, `cleCache` rend `null`, et l'application attend le réseau
 * au lieu de montrer n'importe quoi. C'est le bon sens de l'échec.
 */
export function compteEnCache(): string | null {
  try {
    for (const cle of Object.keys(localStorage)) {
      if (!/^sb-.*-auth-token$/.test(cle)) continue
      const brut = localStorage.getItem(cle)
      if (!brut) continue
      const id = JSON.parse(brut)?.user?.id
      if (typeof id === 'string' && id) return id
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Déclare le compte courant, et purge tout si ce n'est pas le même qu'avant.
 *
 * Appelée à chaque changement de session. C'est elle qui rattrape le cas où
 * l'on se déconnecte sans passer par le bouton — session expirée, jeton
 * révoqué, deuxième compte ouvert dans le même navigateur.
 */
export function fixerCompte(userId: string): void {
  try {
    if (localStorage.getItem(CLE_COMPTE) === userId) return
    viderCaches()
    localStorage.setItem(CLE_COMPTE, userId)
  } catch {
    /* ignore */
  }
}

export function viderCaches(): void {
  try {
    const aJeter = Object.keys(localStorage).filter((k) => PREFIXES.some((p) => k.startsWith(p)))
    for (const k of aJeter) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

/**
 * La clé complète d'une entrée de cache, ou `null` faute de compte connu.
 *
 * Le `null` n'est pas un cas d'erreur à contourner : il dit « on ne sait pas à
 * qui appartiendrait cette donnée », et la seule réponse juste est alors de ne
 * rien lire et de ne rien écrire.
 */
export function cleCache(nom: string): string | null {
  const compte = compteEnCache()
  return compte ? `hubperso.${compte}.${nom}` : null
}

export function lireCache<T>(nom: string, fallback: T): T {
  const cle = cleCache(nom)
  if (!cle) return fallback
  try {
    const brut = localStorage.getItem(cle)
    if (brut) return JSON.parse(brut) as T
  } catch {
    /* ignore */
  }
  return fallback
}

export function ecrireCache<T>(nom: string, valeur: T): void {
  const cle = cleCache(nom)
  if (!cle) return
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* ignore */
  }
}
