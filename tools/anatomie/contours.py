"""Contours vectoriels des composantes, dans le repère du mannequin.

On lisse, on quantifie, on étiquette — comme dans segmente.py —, puis on extrait
le contour de chaque composante, on le simplifie, et on l'écrit en chemin SVG
dans le repère de Couanac : le corps va de y=4 (sommet du crâne) à y=336 (plante
des pieds), centré sur x=0.

L'échelle est UNIFORME sur les deux axes : une échelle par axe déformerait le
corps, et un muscle déformé ne ressemble plus à rien.
"""
import sys, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from skimage import measure

nom = sys.argv[1]
im = Image.open(f'tools/anatomie/planches/{nom}.png').convert('RGB')
a = np.asarray(im).astype(int)

lum = a.sum(2)
fond, trait = lum > 690, lum < 300
chair = ~fond & ~trait

lisse = im.filter(ImageFilter.MedianFilter(size=9))
q = np.asarray(lisse.quantize(colors=28, method=Image.MEDIANCUT).convert('RGB')).astype(int)
palette = np.unique(q[chair].reshape(-1, 3), axis=0)

# Le corps entier : c'est lui qui fixe l'échelle et le centre.
corps = ndimage.binary_closing(~fond, np.ones((9, 9)))
ys, xs = np.where(corps)
y0, y1 = ys.min(), ys.max()
cx = (xs.min() + xs.max()) / 2
ECH = (336 - 4) / (y1 - y0)

def vers_svg(pt):
    y, x = pt
    return ((x - cx) * ECH, 4 + (y - y0) * ECH)

def chemin(contour, tol):
    pts = measure.approximate_polygon(contour, tolerance=tol)
    if len(pts) < 4:
        return None
    uv = [vers_svg(p) for p in pts]
    # Courbes de Catmull-Rom converties en Bézier : un contour tracé en
    # segments droits redonnerait exactement les dalles qu'on vient de quitter.
    d = f"M{uv[0][0]:.1f},{uv[0][1]:.1f}"
    n = len(uv)
    for i in range(n):
        p0, p1, p2, p3 = uv[(i - 1) % n], uv[i], uv[(i + 1) % n], uv[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d + " Z"

sorties = []
for c in palette:
    m = chair & (q[:, :, 0] == c[0]) & (q[:, :, 1] == c[1]) & (q[:, :, 2] == c[2])
    m = ndimage.binary_closing(m, np.ones((7, 7)))
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    for k in range(1, n + 1):
        z = lab == k
        aire = int(z.sum())
        if aire < 2500:
            continue
        cs = measure.find_contours(z.astype(float), 0.5)
        if not cs:
            continue
        cont = max(cs, key=len)
        # Tolérance de simplification. À 3 px, on garde les dentelures que le
        # filtre médian laisse au bord des aplats : le trapèze ressortait en
        # scie. À 9, le contour reste fidèle à la forme et perd le bruit — un
        # muscle n'a pas de dents.
        d = chemin(cont, tol=9.0)
        if not d:
            continue
        zy, zx = np.where(z)
        sorties.append({
            'aire': aire,
            'centre': [round((zx.mean() - cx) * ECH, 1), round(4 + (zy.mean() - y0) * ECH, 1)],
            'boite': [round((zx.min() - cx) * ECH, 1), round(4 + (zy.min() - y0) * ECH, 1),
                      round((zx.max() - cx) * ECH, 1), round(4 + (zy.max() - y0) * ECH, 1)],
            'd': d,
        })

sorties.sort(key=lambda s: -s['aire'])
for i, s in enumerate(sorties):
    s['id'] = i
json.dump({'echelle': ECH, 'largeur': round((xs.max() - xs.min()) * ECH, 1), 'comps': sorties},
          open(f'tools/anatomie/planches/{nom}-contours.json', 'w'))
print(f"{nom} : {len(sorties)} contours · largeur du corps {round((xs.max()-xs.min())*ECH,1)} unités")
for s in sorties[:8]:
    print(f"  {s['id']:>2}  aire {s['aire']:>6}  centre {s['centre']}  boîte {s['boite']}")
