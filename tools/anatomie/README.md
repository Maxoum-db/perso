# Décalquage des planches anatomiques

Le mannequin de récupération a besoin de **54 régions vectorielles nommées**,
recolorées en continu et cliquables une par une. Aucun jeu libre n'existe à
cette granularité — vérifié : `react-body-highlighter` en a 22,
`human-body-react` 15, et leurs tracés sont en polygones basse définition.

Les tracés ont donc longtemps été écrits à la main, de mémoire. Cet outillage
les remplace par un **décalquage** d'une planche de référence : on garde le
contrôle des noms et du câblage, on gagne les formes réelles.

## Les planches

`planches/face.png` et `planches/dos.png` : écorché musculaire en aplats,
contours nets, projection orthographique, fond blanc, sans texte. C'est le seul
format exploitable — un rendu ombré ne donne pas de frontières franches, et un
corps en perspective interdit d'exploiter la symétrie.

## La chaîne

    python3 tools/anatomie/segmente.py face   # aperçu numéroté des composantes
    python3 tools/anatomie/contours.py face   # contours vectoriels en JSON

`segmente.py` sert à REGARDER : il numérote les composantes sur la planche pour
qu'on puisse attribuer chacune à sa région.

`contours.py` produit les chemins, dans le repère du mannequin — corps de y=4
(sommet du crâne) à y=336 (plante des pieds), centré sur x=0, échelle uniforme
sur les deux axes.

Deux précautions qui ne sautent pas aux yeux :

* **les stries de fibres découpent chaque muscle en lamelles.** Un filtre médian
  les efface avant la quantification : une ligne d'un pixel disparaît quand
  l'aplat autour reste intact, tandis qu'un vrai contour survit. Sans ce filtre,
  le grand pectoral ressort en douze morceaux ;
* **les contours sont convertis en courbes de Bézier** et non en segments. Un
  contour en lignes droites redonnerait exactement les dalles rectangulaires que
  ce travail cherche à quitter.

## Ce qui reste

L'attribution des composantes aux 54 régions, et l'intégration. Deux points à
traiter au passage :

1. la planche a les bras écartés en position anatomique, le mannequin les a le
   long du corps : le corps décalqué fait 151 unités de large contre 120 au
   `viewBox` actuel, qu'il faudra élargir dans les deux vues ;
2. une dizaine de régions sont PROFONDES — supra-épineux, sous-scapulaire,
   transverse, multifides, rotateurs de hanche — et n'apparaissent sur aucune
   planche de surface. Elles gardent leur tracé écrit à la main.
