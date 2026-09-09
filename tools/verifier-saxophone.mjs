#!/usr/bin/env node
// Garde-fou de la section saxophone : la table de doigtés et le cours.
//
// Ce qui a motivé ce fichier : cinq doigtés faux sont restés en place des
// semaines sans que rien ne le signale. Le Si♭ grave — la note la plus basse
// de l'instrument — pressait la spatule de Mi♭, qui MONTE le son ; le Do♯
// grave pressait à la fois la spatule de Do et celle de Do♯, ce qui donne un
// Do ; le Si grave en pressait deux aussi ; le Mi et le Fa aigus passaient par
// une clé latérale là où le standard est les trois clés de paume. Rien ne se
// voyait à l'écran : le dessin allume sagement les clés qu'on lui donne, même
// quand elles se contredisent. Il a fallu le manuel de l'élève pour s'en
// apercevoir.
//
// Les contrôles ci-dessous auraient attrapé les cinq — sans manuel, par la
// seule cohérence interne de la table. Ils tournent au `prebuild`.
//
// Comme pour l'étiquetage : on importe le VRAI module, transpilé par esbuild,
// plutôt que de relire le fichier à coups d'expressions régulières. Un
// contrôle qui lit les données autrement que l'application finit par valider
// autre chose qu'elle.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const dossier = await mkdtemp(join(tmpdir(), 'verif-saxophone-'))
let sax
let cours
try {
  // `saxophone.ts` tire `cache.ts` et `solfege.ts` : on regroupe, sinon les
  // imports relatifs ne résoudraient plus depuis le dossier temporaire.
  const sortie = join(dossier, 'saxophone.mjs')
  await build({
    entryPoints: [join(RACINE, 'src/lib/saxophone.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile: sortie,
    logLevel: 'silent',
  })
  const sortieCours = join(dossier, 'solfege.mjs')
  await build({
    entryPoints: [join(RACINE, 'src/lib/solfege.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile: sortieCours,
    logLevel: 'silent',
  })
  sax = await import(pathToFileURL(sortie).href)
  cours = await import(pathToFileURL(sortieCours).href)
} finally {
  await rm(dossier, { recursive: true, force: true })
}

const { SAX_NOTES, SAX_KEYS, CLASSEMENTS, groupesDeNotes, ETAT_SAX_DEFAUT, noteVoisine } = sax
const { LECONS } = cours

const erreurs = []
const parId = new Map(SAX_NOTES.map((n) => [n.id, n]))
const jeu = (n) => new Set(n.keys)
const inclus = (a, b) => [...a].every((k) => b.has(k))

// 1. Une note ne presse qu'UNE seule clé du bas de l'instrument.
//    Les quatre spatules de l'auriculaire gauche et celle de l'auriculaire
//    droit ouvrent chacune un trou différent, tout en bas du pavillon : elles
//    s'excluent. En presser deux, c'est demander deux notes à la fois — dans
//    les faits c'est la plus haute qui sort, donc pas celle qu'on croit.
//    C'était le défaut du Si grave, du Do♯ grave et du Si♭ grave.
const GRAVES = ['lowBb', 'lowB', 'lowC', 'lowCsharp', 'lowEb']
for (const note of SAX_NOTES) {
  const posees = note.keys.filter((k) => GRAVES.includes(k))
  if (posees.length > 1) {
    erreurs.push(`doigté : « ${note.label} » presse ${posees.length} spatules graves à la fois (${posees.join(', ')})`)
  }
}

// 2. Chaque spatule grave appartient à UNE note, et c'est la sienne.
//    La spatule de Mi♭ n'a rien à faire sur un Si♭ : chacune porte le nom de
//    la note qu'elle donne, et n'a pas d'autre emploi dans la table.
const PROPRIETAIRE = { lowBb: 'sib1', lowB: 'si1', lowC: 'do1', lowCsharp: 'do1d', lowEb: 'mib1' }
for (const [cle, attendue] of Object.entries(PROPRIETAIRE)) {
  // Le Mi♭ existe aux deux octaves : la clé sert au grave et à son octave.
  const porteuses = SAX_NOTES.filter((n) => n.keys.includes(cle)).map((n) => n.id)
  const admises = porteuses.filter((id) => id !== attendue && octaveDe(id) !== attendue)
  if (!porteuses.includes(attendue)) {
    erreurs.push(`doigté : la spatule « ${cle} » n'est posée par aucune note — « ${attendue} » devrait la presser`)
  }
  for (const id of admises) {
    erreurs.push(`doigté : « ${parId.get(id).label} » presse la spatule « ${cle} », qui n'appartient qu'à « ${attendue} »`)
  }
}

/** L'octave inférieure d'une note, par sa place sur la portée. */
function octaveDe(id) {
  const n = parId.get(id)
  if (!n) return null
  const bas = SAX_NOTES.find((m) => m.degre === n.degre - 7 && m.alteration === n.alteration)
  return bas ? bas.id : null
}

// 3. Dans la PREMIÈRE octave, le pouce est la seule différence.
//    Du Ré grave au La grave, la note du dessus se doigte exactement comme
//    celle du dessous, plus la clé d'octave. La règle ne vaut que là, et c'est
//    normal : les quatre notes sous le Ré (Si♭, Si, Do, Do♯) se prennent aux
//    spatules du pavillon alors que leurs octaves se prennent à doigts ouverts
//    ou à la « bis » ; et à partir du Ré aigu on quitte le pouce pour les clés
//    de paume, qui obéissent au contrôle suivant. On exclut donc les paires
//    dont la note basse touche le pavillon, et celles dont la note basse a
//    déjà la clé d'octave — elles sont dans la deuxième octave.
const PAVILLON = ['lowBb', 'lowB', 'lowC', 'lowCsharp']
for (const haute of SAX_NOTES) {
  const basId = octaveDe(haute.id)
  if (!basId) continue
  const basse = parId.get(basId)
  if (basse.keys.some((k) => PAVILLON.includes(k))) continue
  if (basse.keys.includes('octave')) continue
  const attendu = new Set([...basse.keys, 'octave'])
  const obtenu = jeu(haute)
  if (attendu.size !== obtenu.size || !inclus(attendu, obtenu)) {
    erreurs.push(
      `doigté : « ${haute.label} » devrait être « ${basse.label} » + clé d'octave ` +
        `(attendu ${[...attendu].sort().join('+')}, trouvé ${[...obtenu].sort().join('+')})`,
    )
  }
}

// 4. En haut, on empile les clés de paume, on ne les remplace pas.
//    Du Ré aigu au Fa aigu, chaque note reprend le doigté de la précédente et
//    y ajoute une clé. Une note du haut qui n'est PAS un sur-ensemble de celle
//    d'en dessous a pris un raccourci — c'était le cas du Mi et du Fa aigus,
//    qui passaient par une clé latérale et perdaient les clés de paume.
const HAUT = ['re3', 'mib3', 'mi3', 'fa3']
for (let i = 1; i < HAUT.length; i++) {
  const bas = parId.get(HAUT[i - 1])
  const haut = parId.get(HAUT[i])
  if (!bas || !haut) {
    erreurs.push(`doigté : la suite du haut cite « ${HAUT[i - 1]} » ou « ${HAUT[i]} », absent de la table`)
    continue
  }
  if (!inclus(jeu(bas), jeu(haut)) || haut.keys.length <= bas.keys.length) {
    erreurs.push(
      `doigté : « ${haut.label} » devrait ajouter une clé à « ${bas.label} », pas en changer ` +
        `(${bas.keys.join('+') || '—'} → ${haut.keys.join('+') || '—'})`,
    )
  }
}

// 5. Deux notes différentes ne peuvent pas avoir le même doigté.
//    Sauf les enharmonies assumées, que la table n'écrit qu'une fois : ici,
//    une collision veut dire qu'un des deux doigtés est faux, et l'écran
//    montrerait la même image pour deux notes sans que ça se remarque.
const parDoigte = new Map()
for (const note of SAX_NOTES) {
  const signature = [...note.keys].sort().join('+') || '(aucune clé)'
  if (parDoigte.has(signature)) {
    erreurs.push(`doigté : « ${note.label} » et « ${parDoigte.get(signature)} » ont le même doigté (${signature})`)
  } else {
    parDoigte.set(signature, note.label)
  }
}

// 6. Pas de clé orpheline, pas de clé inconnue, pas de doublon.
//    Une clé du schéma que plus aucune note ne presse est un vestige : elle
//    reste dessinée, jamais allumée. C'est ce qu'est devenue la clé latérale
//    de Mi le jour où le Mi aigu est repassé par les clés de paume.
const connues = new Set(SAX_KEYS.map((k) => k.id))
const utilisees = new Set(SAX_NOTES.flatMap((n) => n.keys))
for (const k of connues) {
  if (!utilisees.has(k)) erreurs.push(`clé : « ${k} » est dessinée mais aucune note ne la presse`)
}
for (const note of SAX_NOTES) {
  for (const k of note.keys) {
    if (!connues.has(k)) erreurs.push(`clé : « ${note.label} » presse « ${k} », qui n'existe pas`)
  }
  if (new Set(note.keys).size !== note.keys.length) {
    erreurs.push(`clé : « ${note.label} » répète une clé`)
  }
}

// 7. La table monte, et chaque place de portée ne porte qu'un nom par altération.
//    L'ordre du tableau est celui des flèches ◀ ▶ : s'il n'est pas croissant,
//    « note suivante » descend.
for (let i = 1; i < SAX_NOTES.length; i++) {
  if (SAX_NOTES[i].degre < SAX_NOTES[i - 1].degre) {
    erreurs.push(`ordre : « ${SAX_NOTES[i].label} » est placé après « ${SAX_NOTES[i - 1].label} » mais sonne plus bas`)
  }
}
const places = new Map()
for (const note of SAX_NOTES) {
  const place = `${note.degre}/${note.alteration ?? 'nat'}`
  if (places.has(place)) {
    erreurs.push(`portée : « ${note.label} » et « ${places.get(place)} » s'écrivent au même endroit`)
  } else {
    places.set(place, note.label)
  }
}

// 8. Tout classement doit contenir la note par défaut, et chaque note une fois.
//    Un classement qui ne contient pas la note ouverte à l'arrivée affiche un
//    doigté qu'aucune liste ne propose, et les flèches ne le retrouvent plus.
//    C'est exactement ce qui s'est produit quand « Sans altération » est
//    apparu alors que la note par défaut était le Si♭ grave.
for (const c of CLASSEMENTS) {
  const groupes = groupesDeNotes(c.id)
  const vues = new Map()
  for (const g of groupes) {
    for (const n of g.notes) {
      if (vues.has(n.id)) {
        erreurs.push(`classement « ${c.label} » : « ${n.label} » apparaît dans « ${vues.get(n.id)} » et « ${g.label} »`)
      } else {
        vues.set(n.id, g.label)
      }
    }
  }
  if (!vues.has(ETAT_SAX_DEFAUT.note)) {
    erreurs.push(`classement « ${c.label} » : ne contient pas la note par défaut (${ETAT_SAX_DEFAUT.note})`)
  }
  const cles = groupes.map((g) => g.cle)
  if (new Set(cles).size !== cles.length) {
    erreurs.push(`classement « ${c.label} » : deux groupes portent la même clé de repli`)
  }
  // Les flèches ne doivent laisser aucune note hors d'atteinte.
  let atteintes = 1
  for (let n = noteVoisine(ETAT_SAX_DEFAUT.note, 1, c.id); n; n = noteVoisine(n.id, 1, c.id)) atteintes++
  for (let n = noteVoisine(ETAT_SAX_DEFAUT.note, -1, c.id); n; n = noteVoisine(n.id, -1, c.id)) atteintes++
  if (atteintes !== vues.size) {
    erreurs.push(`classement « ${c.label} » : les flèches atteignent ${atteintes} notes sur ${vues.size}`)
  }
}

// 9. Aucun glyphe hors du plan multilingue de base dans un texte affiché.
//    Android ne dessine pas les symboles musicaux Unicode (𝄞, 𝄪, U+1D100…) :
//    ils sortent en rectangle vide sur le téléphone visé, et sur rien d'autre
//    — donc jamais en développement. Deux fois le piège s'est refermé. Les
//    émojis, eux, sont couverts par les polices du système : on ne vise que
//    les blocs musicaux et mathématiques.
const textes = [
  ...SAX_KEYS.flatMap((k) => [k.nom, k.aide]),
  ...SAX_NOTES.map((n) => n.label),
  ...LECONS.flatMap((l) => [
    l.icone,
    l.titre,
    l.cle,
    l.saxophone,
    l.renvoi ?? '',
    ...l.corps,
    ...(l.points ?? []).flatMap((p) => [p.titre, ...p.lignes]),
  ]),
]
for (const texte of textes) {
  for (const ch of texte) {
    const point = ch.codePointAt(0)
    if (point >= 0x1d000 && point <= 0x1d7ff) {
      erreurs.push(
        `police : « ${texte.slice(0, 40)}… » contient U+${point.toString(16).toUpperCase()}, ` +
          `que les polices Android ne dessinent pas`,
      )
      break
    }
  }
}

// 10. Le cours : identifiants uniques, exemples réels, raccord instrumental.
//     Un `exemple` qui ne désigne aucune note ne casse rien — la portée
//     disparaît simplement, et la leçon perd son illustration en silence.
const idsLecons = new Set()
for (const l of LECONS) {
  if (idsLecons.has(l.id)) erreurs.push(`cours : deux leçons portent l'identifiant « ${l.id} »`)
  idsLecons.add(l.id)
  if (l.exemple && !parId.has(l.exemple)) {
    erreurs.push(`cours : « ${l.titre} » illustre avec « ${l.exemple} », absent de la table`)
  }
  if (!l.saxophone?.trim()) erreurs.push(`cours : « ${l.titre} » n'a pas d'encadré saxophone — c'est le sujet`)
  if (!l.corps.length) erreurs.push(`cours : « ${l.titre} » n'a pas de corps`)
}

if (erreurs.length) {
  console.error(`\n✘ Section saxophone : ${erreurs.length} problème(s)\n`)
  for (const e of erreurs) console.error(`  · ${e}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✔ Section saxophone : ${SAX_NOTES.length} doigtés, ${SAX_KEYS.length} clés, ` +
    `${CLASSEMENTS.length} classements, ${LECONS.length} leçons — rien à signaler.`,
)
