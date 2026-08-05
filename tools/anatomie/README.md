# Le mannequin, décalqué

Le mannequin de récupération a besoin de **54 régions vectorielles nommées**,
recolorées en continu et cliquables une par une. Aucun jeu libre n'existe à
cette granularité — vérifié : `react-body-highlighter` en a 22,
`human-body-react` 15, et leurs tracés sont en polygones basse définition.

La géométrie n'est donc plus écrite à la main : elle est **décalquée** de deux
planches anatomiques, et le résultat vit dans `src/components/mannequinTrace.ts`
— fichier généré, à ne jamais retoucher directement.

## Pourquoi tout reprendre

La version d'avant mélangeait deux géométries : une quarantaine de ventres
musculaires inventés à la main, et onze contours relevés sur une planche, posés
par-dessus. Chaque raccord se voyait — un muscle qui dépassait du bras, un
liseré de fond entre deux voisins, une épaule décalquée sur un torse dessiné.
Le verdict était sans appel : *« découpage catastrophique, le rendu est
moche »*.

Ici **tout** vient des mêmes deux images : la silhouette, les cinquante-quatre
muscles, les deux faces. Il n'y a plus de raccord parce qu'il n'y a plus deux
géométries.

## Les planches

`planches/face.png` et `planches/dos.png` : écorché musculaire en aplats,
contours nets, projection orthographique, fond blanc, sans texte. C'est le seul
format exploitable — un rendu ombré ne donne pas de frontières franches, et un
corps en perspective interdit d'exploiter la symétrie.

## La chaîne

```
planches/face.png          planches/dos.png       ← les sources
        └──────── decoupe.py ──────┘               ← une pièce par muscle
   planches/*-parts.npz    planches/*-parts.png    ← masques + planche numérotée
        └──────── tracer.py ───────┘               ← contours → Bézier
      src/components/mannequinTrace.ts             ← FICHIER GÉNÉRÉ
```

```sh
python3 tools/anatomie/decoupe.py     # re-découpe les deux planches
python3 tools/anatomie/tracer.py      # régénère mannequinTrace.ts
```

### `decoupe.py`

Médiane large pour effacer le trait et les stries, quantification en palette
réduite, composantes connexes. Deux points valent d'être retenus :

* **le trait doit disparaître avant le découpage.** Sinon chaque muscle se
  retrouve bordé d'un liseré vide, et sur fond sombre ça donne des fissures
  noires entre les muscles. Les pixels du trait sont rendus au voisin le plus
  proche — mais seulement à moins de six pixels : sans ce plafond, les vingt
  éclats d'une main étaient tous absorbés par la seule pièce retenue de la main,
  et la main entière devenait un muscle ;
* **le trait sert aussi de séparateur.** Droit fémoral, vaste latéral et vaste
  médial partagent la même teinte : sans lui, le quadriceps ne fait qu'une seule
  tache rouge.

La sortie de repérage `planches/<nom>-parts.png` est numérotée et découpée en
trois bandes agrandies : c'est sur elle qu'on nomme les pièces à l'œil.

### `tracer.py`

Trois tables à tenir à jour, et rien d'autre :

* **`FACE` / `DOS`** — quel numéro de pièce est quel muscle. Une pièce absente
  de la table est du corps neutre : os, tendon, main, pied, crâne. Elle n'est
  pas tracée, la silhouette la porte.
* **`COUPES`** — ce que la planche fond et que le modèle distingue : le
  quadriceps en une tache, le trapèze en un éventail. On recoupe en fractions de
  la pièce, avec un biais pour que la limite suive le sens des fibres — une
  coupe franchement horizontale donne des dalles rectangulaires, et une dalle se
  voit pour ce qu'elle est.
* **`PROFONDS`** — les neuf muscles qui n'affleurent sur aucune planche de
  surface : petit pectoral, sous-scapulaire, sus-épineux, transverse,
  pronateurs, brachial, coraco-brachial, pelvitrochantériens, scalènes. Ils sont
  déduits d'une pièce voisine par homothétie, donc dans la même langue
  géométrique que le reste, et dessinés **par-dessus** : sous le pectoral, un
  petit pectoral ne se verrait jamais. Toujours décalés vers le bord de leur
  hôte — une homothétie centrée donne un ovale concentrique, qui se lit comme un
  trou dans le muscle et non comme un muscle dessous.

Les contours sortent en cubiques de Bézier via Catmull-Rom : aucune arête,
aucun segment droit. Un contour en lignes droites redonnerait exactement les
dalles rectangulaires que ce travail cherche à quitter.

La silhouette est rééchantillonnée bien plus fin que les muscles — au pas des
muscles, la corde coupait dans les courbures serrées d'un doigt ou d'une
cheville, et le muscle du bord dépassait du corps — et légèrement dilatée, de
sorte qu'elle contient toujours ses muscles. Elle est produite **entière**,
miroir compris : deux moitiés recevaient chacune le voile de volume et se
recouvraient au milieu, ce qui laissait une couture claire du crâne aux talons.

## Ce qui garde tout ça honnête

`node .bench/decalque.mjs "$(…liste des muscles…)"` mesure dans Chromium la
propriété qui manquait : **tout tracé de muscle est contenu dans la
silhouette**. Elle est fausse dès qu'on remet deux géométries dans le même
dessin, et un décalage de trois unités — un pour cent de la hauteur du corps —
suffit à la faire tomber (`SECOUSSE=3` pour s'en assurer).

`node .bench/apercu.mjs sortie.png [--noms]` sort une image du fichier généré,
une teinte par muscle et le nom posé dessus : c'est ce qui permet de vérifier
qu'une pièce a bien été nommée pour ce qu'elle est.

## Les fichiers intermédiaires

`planches/*-parts.*` sont générés et ignorés par git : seules les deux planches
et les deux scripts font foi. Pour revoir les numéros, on relance `decoupe.py`,
qui est déterministe.
