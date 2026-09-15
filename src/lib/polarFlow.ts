// Ce que Polar Flow rend, et ce qu'on en garde.
//
// ── Pourquoi passer par Polar Flow alors qu'on parle déjà au capteur ────────
//
// Parce que le Bluetooth du navigateur ne marche que téléphone en main, écran
// allumé. Le Verity Sense, lui, sait enregistrer SEUL — mode vert, six cents
// heures de mémoire — et se vide dans l'application Polar au retour. Un béhourd
// dans un champ, une sortie sans téléphone : le capteur a tout, et Couanac n'en
// voyait rien.
//
// AccessLink est le pont. Le capteur enregistre, l'application Polar synchronise
// vers Polar Flow, et on vient lire. Avec un décalage — rien n'arrive avant que
// l'application Polar ait synchronisé.
//
// ⚠️ Et donc : l'application Polar reste indispensable. C'est elle qui vide la
// mémoire du capteur. Sans elle, cette route ne rapporte rien.
//
// ── Ce que le Verity Sense ne donnera PAS ───────────────────────────────────
//
// L'API a des routes `/users/sleep`, `/users/nightly-recharge` et
// `/users/continuous-heart-rate`. Elles existent, et elles resteront vides : ce
// sont des données de MONTRE. Le Verity Sense est un capteur d'entraînement — il
// ne se porte pas la nuit, ne fait pas de stades de sommeil, ne mesure pas en
// continu. Je l'avais annoncé de travers ; ces routes ne sont pas appelées, et
// ce fichier ne prétend pas les lire.
//
// Ce qui arrive vraiment : les SÉANCES. Début, durée, fréquence moyenne et
// maximale, calories, charge d'entraînement, sport, appareil.
//
// ── La route sans transaction, et pourquoi ──────────────────────────────────
//
// AccessLink propose deux chemins vers les séances :
//
//   · le transactionnel — on ouvre une transaction, on lit, on VALIDE. Après
//     validation, les séances ne reviennent plus jamais pour ce client. Une
//     erreur d'écriture après la validation, et la séance est perdue sans
//     recours ;
//   · `GET /v3/exercises` — les trente derniers jours, relisibles autant de fois
//     qu'on veut, rien à valider.
//
// Le second. Une synchronisation qu'on peut relancer sans rien casser vaut
// mieux qu'une qui donne les zones : le transactionnel apporterait le temps par
// zone, que la route simple ne donne pas, au prix d'une destruction
// irréversible à chaque passage. Les séances importées n'ont donc pas de zones,
// et n'entrent pas dans le TRIMP de la semaine — c'est dit à l'écran plutôt que
// comblé par une répartition inventée à partir d'une moyenne.

/** Une séance telle qu'AccessLink la rend, une fois nettoyée. */
export interface SeancePolar {
  /** L'identifiant Polar — c'est lui qui évite les doublons. */
  id: string
  /** Début, en heure locale, tel que Polar l'écrit. */
  debut: string
  /** Durée en secondes. `null` si Polar ne l'a pas donnée. */
  dureeS: number | null
  sport: string | null
  appareil: string | null
  calories: number | null
  /** Distance en mètres. */
  distanceM: number | null
  fcMoyenne: number | null
  fcMax: number | null
  chargePolar: number | null
}

/**
 * Durée ISO 8601 en secondes : « PT2H44M », « PT4S », « PT1H2M3.5S ».
 *
 * Écrit à la main plutôt que pris dans une bibliothèque : c'est le seul format
 * de durée qu'AccessLink emploie, il est borné, et une dépendance de plus pour
 * une regex de trente caractères ne se défend pas.
 *
 * Rend `null` sur tout ce qui n'est pas une durée — y compris « P1D », qu'on ne
 * verra pas ici et qu'il vaut mieux refuser que compter de travers.
 */
export function dureeIsoEnSecondes(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v.trim())
  if (!m) return null
  // « PT » seul valide la regex mais ne porte aucune durée : trois groupes
  // absents, ce n'est pas zéro seconde, c'est une valeur manquante.
  if (m[1] === undefined && m[2] === undefined && m[3] === undefined) return null
  const h = parseFloat(m[1] ?? '0')
  const min = parseFloat(m[2] ?? '0')
  const s = parseFloat(m[3] ?? '0')
  return Math.round(h * 3600 + min * 60 + s)
}

/**
 * Lit un champ que l'API écrit en tirets (`start-time`) et que certains clients
 * rendent en souligné (`start_time`).
 *
 * Le JSON d'AccessLink est en tirets — `member-id`, `resource-uri`,
 * `heart-rate`. Les deux sont acceptés parce que la seule chose que ça coûte
 * est une ligne, et que se tromper coûterait une séance silencieusement vide.
 */
function champ(o: Record<string, unknown>, nom: string): unknown {
  const v = o[nom]
  if (v !== undefined) return v
  return o[nom.replace(/-/g, '_')]
}

function nombre(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Nettoie une séance brute. Rend `null` si elle n'a pas d'identifiant ou pas de
 * début — sans l'un on ne peut pas dédoublonner, sans l'autre on ne peut pas la
 * dater, et une séance qu'on ne peut ni dater ni reconnaître n'est pas une
 * séance.
 */
export function lireSeance(brut: unknown): SeancePolar | null {
  if (!brut || typeof brut !== 'object') return null
  const o = brut as Record<string, unknown>
  // L'identifiant est un entier sur la route transactionnelle et une chaîne
  // hachée sur `/v3/exercises`. On le range en chaîne dans les deux cas.
  const idBrut = champ(o, 'id')
  const id = typeof idBrut === 'number' ? String(idBrut) : texte(idBrut)
  const debut = texte(champ(o, 'start-time'))
  if (!id || !debut) return null

  const fc = champ(o, 'heart-rate')
  const fcObj = fc && typeof fc === 'object' ? (fc as Record<string, unknown>) : {}

  return {
    id,
    debut,
    dureeS: dureeIsoEnSecondes(champ(o, 'duration')),
    sport: texte(champ(o, 'detailed-sport-info')) ?? texte(champ(o, 'sport')),
    appareil: texte(champ(o, 'device')),
    calories: nombre(champ(o, 'calories')),
    distanceM: nombre(champ(o, 'distance')),
    fcMoyenne: nombre(champ(fcObj, 'average')),
    fcMax: nombre(champ(fcObj, 'maximum')),
    chargePolar: nombre(champ(o, 'training-load')),
  }
}

/** Lit une liste, en jetant ce qui n'est pas lisible plutôt que tout refuser. */
export function lireSeances(brut: unknown): SeancePolar[] {
  if (!Array.isArray(brut)) return []
  const out: SeancePolar[] = []
  const vus = new Set<string>()
  for (const x of brut) {
    const s = lireSeance(x)
    // Un identifiant vu deux fois dans la même réponse : on garde le premier.
    // Ça ne devrait pas arriver, et si ça arrive on ne veut pas deux lignes.
    if (s && !vus.has(s.id)) {
      vus.add(s.id)
      out.push(s)
    }
  }
  return out
}

// ── L'affichage ─────────────────────────────────────────────────────────────

/**
 * Le nom du sport, rendu lisible.
 *
 * Polar écrit `WATERSPORTS_WATERSKI` ou `STRENGTH_TRAINING`. On remplace les
 * soulignés par des espaces et on met une majuscule — sans table de traduction :
 * une table pour les deux cents sports de Polar serait fausse le jour où ils en
 * ajoutent un, et « Strength training » se comprend.
 */
export function nomSport(sport: string | null): string {
  if (!sport) return 'Séance'
  const propre = sport.replace(/_/g, ' ').toLowerCase().trim()
  return propre.charAt(0).toUpperCase() + propre.slice(1)
}

/** La date locale (AAAA-MM-JJ) d'une séance, pour la ranger dans le journal. */
export function dateDe(s: SeancePolar): string | null {
  // `start-time` est en heure LOCALE et sans fuseau (« 2008-10-13T10:40:02.000 »).
  // La chaîne porte déjà la bonne date : on la découpe.
  //
  // Le détour par `new Date(...).toISOString()` serait faux. La chaîne sans
  // fuseau est lue comme de l'heure locale, puis `toISOString` la reconvertit en
  // UTC : à Paris (+2 l'été), une séance commencée à 00 h 20 devient 22 h 20 la
  // VEILLE, et se range un jour trop tôt dans le journal.
  //
  // ⚠️ Le contrôle qui l'attrape ne vaut qu'exécuté hors UTC. Sous TZ=UTC les
  // deux écritures rendent le même résultat, et la vérification ne prouve rien.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.debut)
  return m ? m[1] : null
}
