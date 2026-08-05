"""Décalquage d'une planche anatomique en régions vectorielles.

La planche est en aplats : chaque muscle porte une couleur unie, séparée de ses
voisins par un contour sombre. On peut donc retrouver les muscles par
QUANTIFICATION plutôt qu'à l'œil — on ramène les 170 000 teintes de
l'anti-aliasing à une palette courte, on étiquette les composantes connexes, et
chaque composante assez grande est un muscle.

Sortie : un aperçu numéroté, pour attribuer chaque composante à sa région.
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

nom = sys.argv[1]
im = Image.open(f'tools/anatomie/planches/{nom}.png').convert('RGB')
a = np.asarray(im).astype(int)
H, W = a.shape[:2]

# Les contours sont sombres, le fond est blanc : on écarte les deux avant de
# quantifier, sinon le trait noir devient une « couleur de muscle » à lui seul.
lum = a.sum(2)
fond = lum > 690
trait = lum < 300
chair = ~fond & ~trait

# Les stries de fibres sont de fines lignes sombres DANS les muscles : sans
# précaution, chaque muscle ressort en une dizaine de lamelles. Un filtre médian
# les efface — il remplace chaque pixel par la teinte dominante de son voisinage,
# donc une ligne d'un pixel disparaît quand l'aplat autour reste intact. Les
# vrais contours, eux, sont assez épais pour survivre.
from PIL import ImageFilter
lisse = im.filter(ImageFilter.MedianFilter(size=9))
petite = lisse.quantize(colors=28, method=Image.MEDIANCUT).convert('RGB')
q = np.asarray(petite).astype(int)
palette = np.unique(q[chair].reshape(-1, 3), axis=0)

comps = []
for c in palette:
    m = chair & (q[:, :, 0] == c[0]) & (q[:, :, 1] == c[1]) & (q[:, :, 2] == c[2])
    # On referme les micro-trouées laissées par les stries.
    m = ndimage.binary_closing(m, np.ones((7, 7)))
    lab, n = ndimage.label(m)
    for k in range(1, n + 1):
        z = lab == k
        aire = int(z.sum())
        if aire < 2500:            # bruit, liserés, petites bavures
            continue
        ys, xs = np.where(z)
        comps.append({
            'couleur': [int(v) for v in c],
            'aire': aire,
            'boite': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            'centre': [int(xs.mean()), int(ys.mean())],
        })

comps.sort(key=lambda c: -c['aire'])
for i, c in enumerate(comps):
    c['id'] = i

json.dump({'taille': [W, H], 'comps': comps}, open(f'tools/anatomie/planches/{nom}.json', 'w'))

# Aperçu numéroté.
ap = im.copy().convert('RGB')
d = ImageDraw.Draw(ap)
for c in comps:
    x, y = c['centre']
    d.text((x - 6, y - 6), str(c['id']), fill=(0, 0, 0))
ap.save(f'tools/anatomie/planches/{nom}-apercu.png')
print(f"{nom} : {len(comps)} composantes ≥ 900 px")
for c in comps[:14]:
    print(f"  {c['id']:>3}  aire {c['aire']:>7}  centre {c['centre']}  rgb {c['couleur']}")
