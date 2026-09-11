import { fetchKv, saveKv } from './kv'

// Les déclarations posées sur UNE LIGNE d'une séance : « celle-ci, je l'ai faite
// en version douce », « celle-là, en freinant la descente », « sur celle-ci,
// l'allure était soutenue ».
//
// Trois mécaniques identiques traînaient dans trois fichiers : même clé
// composée, même lecture tolérante, même réécriture par séance, même purge.
// Recopiée une quatrième fois, l'une d'elles aurait fini par perdre la purge ou
// le préfixe — et une déclaration qui survit à la séance qui l'a provoquée
// revient se coller à une autre séance qui prendra le même identifiant jamais,
// mais fait grossir le KV pour toujours.
//
// ── Pourquoi la clé n'est pas l'identifiant de la ligne ──────────────────────
//
// Enregistrer une séance SUPPRIME puis réinsère toutes ses lignes : leurs
// identifiants changent à chaque fois. On indexe donc par séance + nom
// d'exercice, qui, eux, survivent.
//
// ── Pourquoi pas une colonne en base ────────────────────────────────────────
//
// La table des exercices n'en a pas, et on évite les migrations pour un booléen.
// Une entrée KV par utilisateur, comme l'intensité et les courbatures déclarées.

/** `séance::exercice` — stable d'un enregistrement à l'autre. */
export function clefLigne(sessionId: string, nom: string): string {
  return `${sessionId}::${nom.trim().toLowerCase()}`
}

export interface ParLigne<V> {
  /** La clé KV où vit cette déclaration. Unique : cf. `CLES_PRISES`. */
  cleKv: string
  clef: (sessionId: string, nom: string) => string
  load: (userId: string) => Promise<Record<string, V>>
  /**
   * Réécrit les déclarations d'UNE séance : celles qui ne sont plus dans la
   * liste disparaissent. Passer par la séance entière plutôt que par exercice
   * évite de laisser des clés derrière soi quand on retire une ligne du
   * brouillon.
   */
  save: (
    userId: string,
    sessionId: string,
    lignes: Array<{ nom: string; valeur: V }>,
    connues: Record<string, V>,
  ) => Promise<Record<string, V>>
  /** Purge les séances disparues : sans ça le KV grossit sans jamais se vider. */
  nettoyer: (connues: Record<string, V>, idsVivants: Set<string>) => Record<string, V>
}

/**
 * Les clés KV déjà prises.
 *
 * Ces déclarations se créent par copie du fichier voisin — c'est comme ça que
 * `negatif` est né de `douceur`. Oublier de changer la chaîne au passage ne
 * casserait rien de visible : les deux écriraient dans le MÊME sac, et chaque
 * ligne déclarée « version douce » se relirait aussi comme « descente
 * freinée ». Un bonus et un malus sur la même ligne, sans un mot. On refuse à
 * la construction, donc au premier chargement de l'application.
 */
const CLES_PRISES = new Set<string>()

export function declarationParLigne<V>(cleKv: string): ParLigne<V> {
  if (CLES_PRISES.has(cleKv)) {
    throw new Error(`declarationParLigne : la clé KV « ${cleKv} » est déjà utilisée par une autre déclaration`)
  }
  CLES_PRISES.add(cleKv)
  return {
    cleKv,
    clef: clefLigne,
    async load(userId) {
      const v = await fetchKv<Record<string, V>>(userId, cleKv, {})
      return v && typeof v === 'object' ? v : {}
    },
    async save(userId, sessionId, lignes, connues) {
      const prefixe = `${sessionId}::`
      const next: Record<string, V> = {}
      for (const [k, v] of Object.entries(connues)) if (!k.startsWith(prefixe)) next[k] = v
      for (const { nom, valeur } of lignes) if (nom.trim()) next[clefLigne(sessionId, nom)] = valeur
      await saveKv(userId, cleKv, next)
      return next
    },
    nettoyer(connues, idsVivants) {
      const out: Record<string, V> = {}
      for (const [k, v] of Object.entries(connues)) {
        if (idsVivants.has(k.slice(0, k.indexOf('::')))) out[k] = v
      }
      return out
    },
  }
}
