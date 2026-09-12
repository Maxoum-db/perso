import type { ExoInput, MuscuTemplate } from './muscu'
import type { FaconLigne } from './modeleLignes'

// Envoyer une séance à quelqu'un, et la recevoir.
//
// Par un CODE à copier-coller, et pas par la base. Trois raisons, dans l'ordre
// où elles comptent :
//
//   · ça marche avec n'importe qui. Mon frère n'a pas encore de compte, Andréa
//     n'est pas dans le même espace partagé que lui, et un ami de la salle n'en
//     aura jamais. Un code part par SMS, par WhatsApp, par mail ;
//   · ça ne demande aucune table, aucune politique, aucune migration. Une
//     séance partagée n'est pas une donnée à garder : c'est un message ;
//   · ça se relit. Le code est du texte ; qui veut savoir ce qu'il envoie peut
//     le décoder, et rien ne part à l'insu de personne.
//
// ── Ce que le code contient, et rien d'autre ────────────────────────────────
//
// Le nom de la séance, son icône, sa durée, ses notes, ses exercices avec
// séries/reps/charges, et les consignes de ligne (version douce, descente
// freinée). PAS d'identifiant de compte, pas d'adresse, pas de date : un code
// qui traîne dans une conversation ne doit rien dire de qui l'a écrit.

/** Le format du code. Changé le jour où le contenu change de forme. */
const VERSION = 1
const PREFIXE = 'COUANAC-SEANCE'

export interface SeancePartagee {
  nom: string
  icone: string
  duree: number | null
  notes: string
  exos: Array<{
    nom: string
    muscles: string
    series: number
    reps: string
    charge: number | null
    notes: string
    facon?: FaconLigne
  }>
}

/** Base64 « URL-safe » : un code qui survit à un copier-coller dans n'importe quoi. */
function encoder(texte: string): string {
  const octets = new TextEncoder().encode(texte)
  let binaire = ''
  for (const o of octets) binaire += String.fromCharCode(o)
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decoder(code: string): string {
  const brut = code.replace(/-/g, '+').replace(/_/g, '/')
  const binaire = atob(brut + '='.repeat((4 - (brut.length % 4)) % 4))
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
  return new TextDecoder().decode(octets)
}

/** Le code à envoyer. Une seule ligne, préfixe lisible en tête pour qu'on sache ce que c'est. */
export function coderSeance(
  tpl: Pick<MuscuTemplate, 'name' | 'icon' | 'duration_min' | 'notes'>,
  exos: Array<ExoInput & { facon?: FaconLigne }>,
): string {
  const charge: SeancePartagee = {
    nom: tpl.name,
    icone: tpl.icon,
    duree: tpl.duration_min,
    notes: tpl.notes,
    exos: exos.map((e) => ({
      nom: e.name,
      muscles: e.muscle_group,
      series: e.sets,
      reps: e.reps,
      charge: e.weight_kg,
      notes: e.notes,
      ...(e.facon && Object.keys(e.facon).length ? { facon: e.facon } : {}),
    })),
  }
  return `${PREFIXE}-v${VERSION}-${encoder(JSON.stringify(charge))}`
}

export class CodeInvalide extends Error {}

/**
 * Relit un code reçu.
 *
 * Tolérant sur la forme — espaces, retours à la ligne, guillemets ajoutés par
 * une messagerie —, strict sur le fond : un code qu'on ne comprend pas donne
 * une erreur, jamais une séance à moitié lue. Une séance vide importée en
 * silence, c'est pire qu'un refus : on croit l'avoir reçue.
 */
export function decoderSeance(codeBrut: string): SeancePartagee {
  const nettoye = codeBrut.trim().replace(/\s+/g, '').replace(/^["'«»]+|["'«»]+$/g, '')
  const debut = nettoye.indexOf(PREFIXE)
  if (debut < 0) throw new CodeInvalide('Ce texte ne contient pas de code de séance Couanac.')
  const reste = nettoye.slice(debut + PREFIXE.length)
  const m = /^-v(\d+)-(.+)$/.exec(reste)
  if (!m) throw new CodeInvalide('Code de séance incomplet — il manque la fin.')
  if (Number(m[1]) > VERSION) {
    throw new CodeInvalide(
      `Ce code vient d'une version plus récente de Couanac (v${m[1]}). Mets l'application à jour.`,
    )
  }
  let brut: unknown
  try {
    brut = JSON.parse(decoder(m[2]))
  } catch {
    throw new CodeInvalide('Code de séance abîmé — il a probablement été coupé au copier-coller.')
  }
  const o = brut as Partial<SeancePartagee>
  if (!o || typeof o !== 'object' || !Array.isArray(o.exos)) {
    throw new CodeInvalide('Code de séance illisible.')
  }
  const exos = o.exos
    .filter((e) => e && typeof e === 'object' && typeof e.nom === 'string' && e.nom.trim())
    .map((e) => ({
      nom: String(e.nom).trim(),
      muscles: typeof e.muscles === 'string' ? e.muscles : '',
      // Bornés à la relecture : un code bricolé à la main ne doit pas pouvoir
      // écrire 10 000 séries dans le catalogue de celui qui l'importe.
      series: Math.max(1, Math.min(99, Math.round(Number(e.series) || 1))),
      reps: typeof e.reps === 'string' ? e.reps : '10',
      charge: typeof e.charge === 'number' && Number.isFinite(e.charge) ? e.charge : null,
      notes: typeof e.notes === 'string' ? e.notes : '',
      ...(e.facon && typeof e.facon === 'object'
        ? {
            facon: {
              ...(e.facon.doux ? { doux: true as const } : {}),
              ...(e.facon.negatif ? { negatif: true as const } : {}),
            },
          }
        : {}),
    }))
  if (!exos.length) throw new CodeInvalide('Ce code ne contient aucun exercice.')
  return {
    nom: typeof o.nom === 'string' && o.nom.trim() ? o.nom.trim() : 'Séance reçue',
    icone: typeof o.icone === 'string' && o.icone.trim() ? o.icone : '📨',
    duree: typeof o.duree === 'number' && Number.isFinite(o.duree) ? o.duree : null,
    notes: typeof o.notes === 'string' ? o.notes : '',
    exos,
  }
}
