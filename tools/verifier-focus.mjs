#!/usr/bin/env node
// Garde-fou des points faibles (lib/focus).
//
// Un point faible ne se signale jamais quand il est mal réglé. Il ne plante
// pas, il ne s'affiche pas en rouge : le générateur réserve des places pour
// des muscles que rien ne vise, ne trouve personne pour les prendre, et rend
// une séance ordinaire. À l'écran, la case est cochée — on croit viser.
//
// Trois façons d'en arriver là, toutes attrapées ici :
//   · une région mal orthographiée (« tricepsLatt ») : elle ne désigne aucun
//     muscle, et le focus perd silencieusement une partie de sa cible ;
//   · un point faible que le catalogue ne peut pas nourrir : les places
//     réservées se remplissent alors avec n'importe quoi ;
//   · un ancien identifiant qui traîne dans le renvoi de compatibilité et
//     pointe vers un focus supprimé — le report rate, et le réglage
//     enregistré disparaît.
//
// Tourne au `prebuild`, comme les deux autres vérificateurs.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dossier = await mkdtemp(join(tmpdir(), 'verif-focus-'))

/**
 * `focus.ts` tire le KV, donc le client Supabase : on regroupe en visant le
 * navigateur (la cible réelle) et on neutralise les variables d'environnement.
 * Rien n'est exécuté au chargement de ces modules — que des données.
 */
async function charger(chemin, nom) {
  const sortie = join(dossier, nom)
  await build({
    entryPoints: [join(RACINE, chemin)],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: sortie,
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': '"https://verificateur.invalid"',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '"aucune"',
      'import.meta.env': '{}',
    },
  })
  return import(pathToFileURL(sortie).href)
}

let focus
let muscles
let exercices
try {
  focus = await charger('src/lib/focus.ts', 'focus.mjs')
  muscles = await charger('src/lib/muscles.ts', 'muscles.mjs')
  exercices = await charger('src/data/exercises.ts', 'exercices.mjs')
} finally {
  await rm(dossier, { recursive: true, force: true })
}

const { FOCUS, FOCUS_IDS, FOCUS_RECUP, normaliserFocus, placesFocus } = focus
const { MUSCLE_LABELS, regionsForGroup } = muscles
const { EXERCISE_LIBRARY } = exercices

const erreurs = []

// 1. La liste proposée à l'écran et la table doivent dire la même chose.
//    FocusPicker parcourt FOCUS_IDS et lit FOCUS[id] : un identifiant présent
//    d'un seul côté donne soit une case morte, soit un point faible que rien
//    ne propose jamais.
for (const id of FOCUS_IDS) {
  if (!FOCUS[id]) erreurs.push(`liste : « ${id} » est proposé à l'écran mais absent de la table`)
}
for (const id of Object.keys(FOCUS)) {
  if (!FOCUS_IDS.includes(id)) erreurs.push(`liste : « ${id} » existe dans la table mais n'est proposé nulle part`)
}

// 2. Toute région citée doit désigner un vrai muscle.
//    `regionsDuFocus` construit un Set sans rien vérifier : une région
//    inconnue n'y produit aucune erreur, elle rétrécit juste la cible.
for (const [id, f] of Object.entries(FOCUS)) {
  for (const r of f.regions) {
    if (!(r in MUSCLE_LABELS)) erreurs.push(`focus « ${f.label} » : « ${r} » ne désigne aucun muscle`)
  }
  if (new Set(f.regions).size !== f.regions.length) {
    erreurs.push(`focus « ${f.label} » : une région est citée deux fois`)
  }
  // Le mode récupération est le seul à viser un ÉTAT et non des muscles.
  if (!f.regions.length && id !== FOCUS_RECUP) {
    erreurs.push(`focus « ${f.label} » : aucune région — il ne viserait rien`)
  }
  if (!f.label?.trim() || !f.emoji?.trim()) erreurs.push(`focus « ${id} » : libellé ou emoji manquant`)
}

// 3. Deux points faibles ne doivent pas viser le même muscle.
//    Se chevaucher, c'est deux cases dont on ne sait plus laquelle cocher — et
//    en cocher les deux consomme les deux places de FOCUS_MAX pour une seule
//    cible réelle. Le dos et le haut du corps se recouvraient ainsi ; c'est
//    précisément ce qui a fait remplacer « Haut du corps » par « Bras ».
const ids = Object.keys(FOCUS).filter((id) => FOCUS[id].regions.length)
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = new Set(FOCUS[ids[i]].regions)
    const communes = FOCUS[ids[j]].regions.filter((r) => a.has(r))
    // Le dos partage volontairement ses lombaires avec la ceinture abdominale
    // et son deltoïde postérieur avec rien d'autre : on ne s'inquiète qu'au
    // recouvrement LARGE, celui qui rend un des deux choix inutile.
    const part = communes.length / Math.min(a.size, FOCUS[ids[j]].regions.length)
    if (part > 0.5) {
      erreurs.push(
        `focus : « ${FOCUS[ids[i]].label} » et « ${FOCUS[ids[j]].label} » visent ` +
          `${communes.length} muscles en commun (${Math.round(part * 100)} %) — l'un des deux ne sert plus`,
      )
    }
  }
}

// 4. Le catalogue doit pouvoir remplir les places réservées, en MUSCULATION.
//    `placesFocus` en réserve trois sur une séance de six. Si le catalogue ne
//    propose pas au moins autant d'exercices qui VISENT ces muscles, le
//    générateur comble avec des mouvements qui les effleurent : la séance
//    porte le nom du point faible sans le travailler.
//
//    Deux exclusions, et elles ne sont pas cosmétiques — sans elles le compte
//    ment. Un premier jet acceptait un focus réduit au seul coraco-brachial :
//    cinq exercices le « visaient », dont « sauna ou bain chaud » et deux
//    séances d'étirements. Elles déclarent « Corps entier:1 », que
//    `regionsForGroup` étale sur cinquante-quatre muscles — donc sur n'importe
//    quel focus. Un contrôle qu'un bain chaud suffit à satisfaire ne contrôle
//    rien.
//      · les exercices de récupération ne comptent pas : ils ne travaillent
//        aucun point faible, c'est leur objet ;
//      · un libellé qui peint huit muscles ou plus (« Corps entier », « Haut
//        du corps », « Jambes ») ne vise pas, il balaie.
const MIN = placesFocus(6, 1)
const LARGEUR_MAX = 8
for (const [id, f] of Object.entries(FOCUS)) {
  if (!f.regions.length) continue
  const cible = new Set(f.regions)
  const cibles = EXERCISE_LIBRARY.filter((e) =>
    e.kind !== 'recuperation' &&
    e.groups.split(',').some((part) => {
      const [libelle, poids] = part.split(':')
      const regions = regionsForGroup(libelle.trim())
      return (
        parseFloat(poids ?? '1') >= 0.8 &&
        regions.length < LARGEUR_MAX &&
        regions.some((r) => cible.has(r))
      )
    }),
  )
  if (cibles.length < MIN) {
    erreurs.push(
      `focus « ${f.label} » : ${cibles.length} exercice(s) le visent en cible principale, ` +
        `il en faut ${MIN} pour tenir les places réservées d'une séance`,
    )
  }
}

// 5. Le renvoi des anciens noms doit aboutir.
//    Un ancien identifiant qui pointe vers un focus supprimé retombe au filtre
//    et le réglage enregistré s'évapore, ce que le renvoi existe justement pour
//    empêcher. On le vérifie par le comportement, pas par la table interne.
const ANCIENS = { haut: 'bras' }
for (const [ancien, attendu] of Object.entries(ANCIENS)) {
  const obtenu = normaliserFocus([ancien])
  if (obtenu.length !== 1 || obtenu[0] !== attendu) {
    erreurs.push(
      `compatibilité : l'ancien réglage « ${ancien} » devrait devenir « ${attendu} », ` +
        `il donne ${JSON.stringify(obtenu)}`,
    )
  }
  if (FOCUS_IDS.includes(ancien)) {
    erreurs.push(`compatibilité : « ${ancien} » est à la fois un ancien nom et un focus proposé`)
  }
}
// Le renvoi ne doit rien inventer : un identifiant inconnu reste écarté, et une
// liste vide reste vide — c'est ainsi qu'on dit « aucun point faible ».
if (normaliserFocus(['pipo']).length) erreurs.push('compatibilité : un identifiant inconnu n\'est plus écarté')
if (normaliserFocus([]).length) erreurs.push('compatibilité : une sélection vide ne reste pas vide')

if (erreurs.length) {
  console.error(`\n✘ Points faibles : ${erreurs.length} problème(s)\n`)
  for (const e of erreurs) console.error(`  · ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✔ Points faibles : ${FOCUS_IDS.length} entrées, toutes visées par le catalogue — rien à signaler.`)
