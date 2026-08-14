#!/usr/bin/env node
// Garde-fou de la bibliothèque d'exercices.
//
// Ce qui a motivé ce fichier : vingt lignes de séances — dont neuf réellement
// faites — désignaient un exercice sous un nom que plus rien ne connaissait, et
// gardaient donc l'étiquetage grossier de leur premier jour (« Dos »,
// « Full body », et même « Épaules » pour un tirage horizontal). Aucune erreur
// visible à l'écran : l'exercice s'affiche normalement, il désigne simplement la
// moitié des muscles qu'il travaille. C'est le genre de défaut qui ne se signale
// jamais tout seul.
//
// Les quatre contrôles ci-dessous auraient tous les quatre attrapé le problème
// AVANT qu'il ne descende en base. Ils tournent au `prebuild`, donc à chaque
// déploiement.
//
// Les modules de données sont du TypeScript sans dépendance : on les transpile
// avec esbuild (déjà présent, via Vite) et on importe le VRAI contenu, plutôt
// que de le relire à coups d'expressions régulières — un contrôle qui lit le
// fichier autrement que l'application finit par valider autre chose qu'elle.

import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transform } from 'esbuild'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function charger(cheminTs, dossier) {
  const ts = readFileSync(join(RACINE, cheminTs), 'utf8')
  const { code } = await transform(ts, { loader: 'ts', format: 'esm' })
  const sortie = join(dossier, cheminTs.replace(/[/\\]/g, '_') + '.mjs')
  await writeFile(sortie, code, 'utf8')
  return import(pathToFileURL(sortie).href)
}

const dossier = await mkdtemp(join(tmpdir(), 'verif-etiquetage-'))
let exercices
let muscles
try {
  exercices = await charger('src/data/exercises.ts', dossier)
  muscles = await charger('src/lib/muscles.ts', dossier)
} finally {
  await rm(dossier, { recursive: true, force: true })
}

const { EXERCISE_LIBRARY, EXERCISE_RENAMES, cleExercice } = exercices
const { regionsForGroup } = muscles

/** Libellés qui ne désignent volontairement aucun muscle. */
const SANS_MUSCLE = new Set(['cardio'])

const erreurs = []
const nomsBibliotheque = new Set(EXERCISE_LIBRARY.map((e) => cleExercice(e.name)))

// 1. Toute clé de renommage doit être DÉJÀ normalisée.
//    Une clé écrite « Pallof Press » ou avec une apostrophe courbe ne sera
//    jamais trouvée : la recherche se fait sur `cleExercice(nom)`. Le renvoi
//    existe, il ne se déclenche simplement jamais — et rien ne le dit.
for (const cle of Object.keys(EXERCISE_RENAMES)) {
  if (cleExercice(cle) !== cle) {
    erreurs.push(`renommage : la clé « ${cle} » n'est pas normalisée (attendu « ${cleExercice(cle)} »)`)
  }
}

// 2. Toute cible de renommage doit exister dans la bibliothèque.
//    Sinon le renvoi mène à un nom que le catalogue ne portera jamais, et
//    l'exercice reste orphelin — exactement comme s'il n'y avait pas de renvoi.
for (const [cle, cible] of Object.entries(EXERCISE_RENAMES)) {
  if (!nomsBibliotheque.has(cleExercice(cible))) {
    erreurs.push(`renommage : « ${cle} » renvoie vers « ${cible} », absent de la bibliothèque`)
  }
}

// 3. Aucune clé de renommage ne doit être un nom de la bibliothèque.
//    Ce serait renommer un exercice valide par-dessus un autre, et faire
//    disparaître le premier du catalogue.
for (const cle of Object.keys(EXERCISE_RENAMES)) {
  if (nomsBibliotheque.has(cle)) {
    erreurs.push(`renommage : « ${cle} » est un nom de la bibliothèque — il serait renommé par-dessus`)
  }
}

// 4. Tout libellé musculaire doit désigner au moins un muscle.
//    `regionsForGroup` rend un tableau vide sur un libellé inconnu, sans rien
//    signaler : l'exercice est alors invisible sur le mannequin. Un libellé qui
//    ne peint rien est pire qu'un libellé absent — on croit avoir renseigné.
for (const exo of EXERCISE_LIBRARY) {
  for (const part of exo.groups.split(',')) {
    const libelle = part.split(':')[0].trim()
    if (!libelle || SANS_MUSCLE.has(libelle.toLowerCase())) continue
    if (regionsForGroup(libelle).length === 0) {
      erreurs.push(`étiquetage : « ${exo.name} » déclare « ${libelle} », qui ne désigne aucun muscle`)
    }
  }
}

if (erreurs.length) {
  console.error(`\n✘ Étiquetage des exercices : ${erreurs.length} problème(s)\n`)
  for (const e of erreurs) console.error(`  · ${e}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✔ Étiquetage des exercices : ${EXERCISE_LIBRARY.length} exercices, ` +
    `${Object.keys(EXERCISE_RENAMES).length} renvois de nom — rien à signaler.`,
)
