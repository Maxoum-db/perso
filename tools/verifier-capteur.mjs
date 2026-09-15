// Garde-fou de la liaison Bluetooth : UNE seule, partagée par tous les écrans.
//
// ── Ce qui a motivé ce fichier ──────────────────────────────────────────────
//
// La liaison était ouverte par chaque écran qui en avait besoin — la séance en
// cours, l'entraînement de béhourd, la mesure au repos. Trois appels au même
// hook, trois liaisons potentielles, et surtout : `useCapteurCardio` COUPE la
// liaison en se démontant. Quitter l'écran de séance débranchait donc le
// brassard, sans un mot.
//
// La liaison vit maintenant dans `CapteurProvider`, au-dessus de tout, et les
// écrans la consultent avec `useCapteur()`.
//
// Le travers à empêcher est facile à commettre et invisible à l'exécution :
// quelqu'un ajoute un écran cardiaque, tape `useCapteurCardio(...)` comme le
// faisaient les trois autres, et le navigateur ouvre une seconde liaison. Selon
// la pile Bluetooth, elle échoue — ou elle vole la première, et l'écran d'à côté
// se fige sur son dernier battement reçu.
//
// Rien ne le signalerait : pas d'erreur de type, pas d'écran rouge. Juste une
// fréquence qui s'arrête de monter.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = 'src'
const FOURNISSEUR = 'src/lib/capteurContexte.tsx'
const DEFINITION = 'src/lib/capteurCardio.ts'

function fichiers(dossier) {
  const out = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin))
    else if (/\.tsx?$/.test(nom)) out.push(chemin)
  }
  return out
}

const erreurs = []
const appelants = []

for (const chemin of fichiers(RACINE)) {
  const code = readFileSync(chemin, 'utf8')
  // L'APPEL, pas la définition ni le type. `useCapteurCardio(` suivi de
  // n'importe quoi, mais pas précédé de `function `.
  for (const m of code.matchAll(/(^|[^\w.])useCapteurCardio\s*\(/g)) {
    const avant = code.slice(Math.max(0, m.index - 20), m.index + 1)
    if (/function\s*$/.test(avant)) continue
    appelants.push(chemin)
    break
  }
}

const horsFournisseur = appelants.filter((f) => f.replace(/\\/g, '/') !== FOURNISSEUR)
for (const f of horsFournisseur) {
  erreurs.push(
    `${f} appelle useCapteurCardio directement. Une seule liaison Bluetooth doit exister : ` +
      `utilise useCapteur() de src/lib/capteurContexte.tsx.`,
  )
}
if (!appelants.some((f) => f.replace(/\\/g, '/') === FOURNISSEUR)) {
  erreurs.push(`${FOURNISSEUR} n'appelle plus useCapteurCardio : plus personne n'ouvre la liaison.`)
}

// Le fournisseur doit être monté, sinon `useCapteur()` lève à l'ouverture de
// n'importe quel écran — et l'en-tête est sur TOUS les écrans.
const racineApp = readFileSync('src/main.tsx', 'utf8')
if (!/<CapteurProvider>/.test(racineApp)) {
  erreurs.push('src/main.tsx ne monte pas <CapteurProvider> : useCapteur() lèvera partout.')
}

// Le démontage du hook coupe la liaison. C'est ce qui rend son emplacement
// critique — si cette ligne disparaît, la règle ci-dessus perd sa raison d'être
// et le commentaire du fichier devient un mensonge.
const definition = readFileSync(DEFINITION, 'utf8')
if (!/gatt\?\.disconnect\(\)/.test(definition)) {
  erreurs.push(`${DEFINITION} ne coupe plus la liaison au démontage — ce contrôle repose sur ce comportement.`)
}

if (erreurs.length) {
  console.error(`\n✘ Capteur cardiaque : ${erreurs.length} problème(s)\n`)
  for (const e of erreurs) console.error(`  · ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✔ Capteur cardiaque : une seule liaison, ouverte par le fournisseur — rien à signaler.`)
