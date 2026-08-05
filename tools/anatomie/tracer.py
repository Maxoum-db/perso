#!/usr/bin/env python3
"""Décalque les pièces de `decoupe.py` en tracés SVG pour le mannequin.

Génère `src/components/mannequinTrace.ts` : la totalité de la géométrie du
mannequin, les deux faces, dans un seul repère. C'est le point important — la
version précédente mélangeait onze contours décalqués avec quarante formes
dessinées à la main, et le raccord se voyait partout. Ici tout vient de la même
planche, donc tout se raccorde.

Trois familles de tracés :
  · les pièces nommées      → un muscle du modèle ;
  · les pièces neutres      → os, tendons, main, crâne : le corps entre les
                              muscles, sans quoi le fond passe au travers ;
  · les muscles PROFONDS    → aucun ne figure sur une planche de surface. Ils
                              sont déduits d'une pièce hôte par une homothétie,
                              pour qu'ils parlent la même langue géométrique
                              que le reste, et sont dessinés PAR-DESSUS : sous
                              le pectoral, un petit pectoral est invisible.
"""

import re
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage
from skimage import measure

RACINE = Path(__file__).resolve().parent
PLANCHES = RACINE / "planches"
SORTIE = RACINE.parent.parent / "src" / "components" / "mannequinTrace.ts"

# Repères verticaux du mannequin, hérités du tracé à la main : la vignette et
# le plein écran cadrent là-dessus, et les deux faces doivent se superposer.
HAUT, BAS = 4.0, 338.0
LISSAGE = 3.0        # sigma du flou avant extraction du contour, en pixels
PAS = 26.0           # longueur d'arc visée entre deux points de contrôle, en px
POINTS_MAX = 34      # au-delà, on alourdit le DOM sans que ça se voie
# La silhouette fait à elle seule dix fois le périmètre d'un muscle : lui
# appliquer le même plafond la réduisait à trente-quatre points, et le corps
# perdait sa tête, ses mains et ses pieds au profit de moignons.
#
# Elle est aussi rééchantillonnée bien plus fin. Au pas des muscles, la corde
# de 26 px coupait dans les courbures serrées — un doigt, une cheville, le
# galbe du deltoïde — et le muscle du bord dépassait du corps.
POINTS_SILHOUETTE, PAS_SILHOUETTE = 420, 13.0
# Et dilatée de quelques pixels : elle est DERRIÈRE tout le reste, personne ne
# voit un corps un demi-millimètre plus large, mais elle contient alors ses
# muscles quoi qu'il arrive au lissage.
MARGE_SILHOUETTE = 4


# ── Nommage des pièces ──────────────────────────────────────────────────────
#
# Relevé à l'œil sur `planches/<nom>-parts.png`. Une pièce absente de la table
# est du corps neutre : os, tendon, aponévrose, main, pied, crâne.

FACE = {
    0: "COUPE_QUADRICEPS",   # une seule tache rouge : voir COUPES
    1: "pecLower", 5: "pecUpper", 20: "serratus", 26: "serratus",
    2: "biceps", 7: "deltLat", 19: "deltAnt", 9: "brachioradialis",
    16: "forearmExt", 32: "forearmExt", 33: "forearmFlex", 34: "forearmFlex",
    38: "fingerFlex", 43: "fingerFlex",
    25: "neck", 36: "trapsUpper", 37: "trapsUpper",
    6: "rectus", 15: "rectus", 17: "rectus", 18: "rectus", 12: "obliques",
    24: "tfl", 8: "hipFlexors", 31: "hipFlexors",
    10: "vastusMed", 21: "adductors", 29: "adductors", 35: "adductors",
    30: "gracilis",
    4: "tibialis", 14: "gastroc", 23: "soleus", 22: "fibularis",
}

DOS = {
    0: "gluteMax", 29: "gluteMed",
    1: "COUPE_TRAPEZE",      # les trois faisceaux ne font qu'une pièce
    2: "lats", 10: "erectors", 39: "erectors", 27: "quadratusLumborum",
    34: "multifidus",
    9: "rotatorCuff", 40: "teresMinor", 17: "teres", 25: "teres",
    42: "rhomboids", 22: "deltPost",
    8: "tricepsLong", 23: "tricepsLat",
    11: "forearmExt", 15: "forearmExt", 30: "forearmFlex", 41: "forearmFlex",
    21: "neckExt", 35: "levator",
    13: "bicepsFemoris", 6: "bicepsFemoris", 26: "bicepsFemoris", 24: "tfl",
    7: "hamsInner", 19: "hamsInner", 31: "hamsInner", 37: "hamsInner",
    4: "gastroc", 5: "gastroc", 32: "soleus", 38: "soleus",
}


# ── Découpes ────────────────────────────────────────────────────────────────
#
# La planche fond en une seule tache ce que le modèle distingue. On recoupe à
# la main, en fraction de la largeur (ou de la hauteur) de la pièce.

COUPES = {
    # Quadriceps : le trait qui sépare le droit fémoral du vaste latéral est
    # dessiné mais ne se referme ni en haut ni en bas — les composantes
    # connexes n'y voient donc qu'un seul muscle. Coupe en x, la fraction se
    # comptant depuis le bord EXTERNE (la planche est vue de face, la moitié
    # décalquée est celle de gauche, donc le dehors est à gauche).
    "COUPE_QUADRICEPS": ("x", [(-0.40, 0.46, "vastusLat"), (0.46, 1.40, "rectusFemoris")], 0.28),
    # Trapèze : un seul éventail sur la planche, trois faisceaux dans le modèle.
    "COUPE_TRAPEZE": ("y", [(-0.40, 0.36, "trapsUpper"), (0.36, 0.62, "trapsMid"),
                            (0.62, 1.40, "trapsLow")], -0.30),
}


# ── Muscles profonds ────────────────────────────────────────────────────────
#
# (face, pièce hôte, échelle x, échelle y, décalage x, décalage y en fraction
# de la taille de l'hôte). Aucun n'affleure : ils sont déduits d'un voisin et
# posés par-dessus, sinon ils ne se verraient jamais.

# Décalés vers le BORD de leur hôte, jamais centrés : une homothétie centrée
# donne un ovale concentrique au milieu du muscle, et ça ne se lit pas comme un
# muscle dessous mais comme un trou dedans — deux yeux au milieu des pectoraux.
PROFONDS = [
    ("face", 1, "pecMinor", 0.30, 0.30, -0.26, -0.28),          # apophyse coracoïde
    ("face", 2, "brachialis", 0.55, 0.34, -0.18, 0.30),         # distal, en dehors du biceps
    ("face", 2, "coracobrachialis", 0.30, 0.30, 0.22, -0.32),   # proximal, en dedans
    ("face", 33, "pronators", 0.70, 0.50, 0.15, -0.25),         # rond pronateur, au coude
    ("face", 12, "transversus", 0.70, 0.50, 0.05, 0.28),        # sangle basse
    ("dos", 9, "supraspinatus", 0.75, 0.30, 0.02, -0.55),       # au-dessus de l'épine
    ("dos", 9, "subscapularis", 0.45, 0.40, -0.20, 0.25),
    ("dos", 0, "hipRotators", 0.50, 0.22, 0.10, -0.32),         # pelvitrochantériens
    # Les scalènes sont sous le sterno-cléido-mastoïdien, en arrière : on les
    # déduit de lui, décalés vers le dehors, sinon ils atterrissent sur la
    # clavicule — ce que faisait la pièce 37, qui est du trapèze.
    ("face", 25, "scalenes", 0.55, 0.60, -0.55, 0.20),
    ("dos", 38, "tibPost", 0.70, 0.62, 0.10, -0.10),
]


# ── Géométrie ───────────────────────────────────────────────────────────────

def plus_grosse(m: np.ndarray) -> np.ndarray:
    """Une pièce peut traîner un îlot détaché : on garde le morceau principal."""
    lab, n = ndimage.label(m)
    if n <= 1:
        return m
    tailles = np.bincount(lab.ravel())
    tailles[0] = 0
    return lab == int(tailles.argmax())


def contour(m: np.ndarray) -> np.ndarray:
    """Contour lissé, en (x, y) pixels, du masque donné."""
    m = plus_grosse(ndimage.binary_fill_holes(m))
    # Une marge de flou hors du cadre ferait rentrer le contour : on borde.
    flou = ndimage.gaussian_filter(np.pad(m, 8).astype(np.float32), LISSAGE)
    lignes = measure.find_contours(flou, 0.5)
    if not lignes:
        return np.empty((0, 2))
    c = max(lignes, key=len) - 8
    return c[:, ::-1]


def reechantillonner(c: np.ndarray, maxi: int = POINTS_MAX, pas: float = PAS) -> np.ndarray:
    """Rééchantillonne le contour fermé à pas d'arc constant."""
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(np.r_[c, c[:1]], axis=0).T))]
    n = int(np.clip(round(d[-1] / pas), 8, maxi))
    cible = np.linspace(0, d[-1], n, endpoint=False)
    return np.c_[np.interp(cible, d, np.r_[c, c[:1]][:, 0]),
                 np.interp(cible, d, np.r_[c, c[:1]][:, 1])]


def bezier(p: np.ndarray, borne: float = 0.0) -> str:
    """Catmull-Rom fermé → cubiques de Bézier. Aucune arête, que des courbes.

    Les points de contrôle sont bornés à l'axe eux aussi : borner les seuls
    points d'ancrage laissait la courbe repasser de l'autre côté du corps, et
    le tracé se dédoublait au milieu une fois mis en miroir. La silhouette,
    elle, franchit l'axe d'un cheveu (`borne`) : sans ça le grand droit affleure
    exactement son bord, et « dedans » n'y veut plus rien dire.
    """
    n = len(p)
    xy = lambda q: f"{min(q[0], borne):.1f},{q[1]:.1f}"
    bouts = [f"M{xy(p[0])}"]
    for i in range(n):
        p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
        bouts.append(f"C{xy(p1 + (p2 - p0) / 6)} {xy(p2 - (p3 - p1) / 6)} {xy(p2)}")
    return " ".join(bouts) + "Z"


def homothetie(m: np.ndarray, kx: float, ky: float, dx: float, dy: float) -> np.ndarray:
    """Réduit un masque autour de son centre et le décale, en fraction de sa taille."""
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    lx, ly = x1 - x0, y1 - y0
    nx = np.clip(((xs - cx) * kx + cx + dx * lx).round().astype(int), 0, m.shape[1] - 1)
    ny = np.clip(((ys - cy) * ky + cy + dy * ly).round().astype(int), 0, m.shape[0] - 1)
    out = np.zeros_like(m)
    out[ny, nx] = True
    # L'homothétie laisse des trous d'un pixel : on les referme.
    return ndimage.binary_closing(out, np.ones((5, 5)))


def coupe(m: np.ndarray, axe: str, tranches: list, biais: float = 0.0) -> list:
    """Recoupe une pièce fondue en plusieurs muscles, par tranche relative.

    `biais` incline la coupe : une coupe franchement horizontale à travers le
    trapèze donne trois dalles rectangulaires empilées, et une dalle se voit
    pour ce qu'elle est. Inclinée, la limite suit le sens des fibres.
    """
    ys, xs = np.nonzero(m)
    a0, a1 = (xs.min(), xs.max()) if axe == "x" else (ys.min(), ys.max())
    dedans = xs if axe == "x" else ys
    autre = ys if axe == "x" else xs
    b0, b1 = autre.min(), autre.max()
    dedans = dedans - biais * (a1 - a0) * (autre - b0) / max(b1 - b0, 1)
    out = []
    for u, v, region in tranches:
        garde = (dedans >= a0 + u * (a1 - a0)) & (dedans <= a0 + v * (a1 - a0))
        bout = np.zeros_like(m)
        bout[ys[garde], xs[garde]] = True
        out.append((region, bout))
    return out


# ── Chaîne ──────────────────────────────────────────────────────────────────

def repere(pile: np.ndarray, corps: np.ndarray) -> tuple:
    """Échelle et origine qui amènent la planche dans le repère du mannequin."""
    ys, xs = np.nonzero(corps)
    y0, y1 = ys.min(), ys.max()
    k = (BAS - HAUT) / (y1 - y0)
    # L'axe médian est le bord droit de la moitié conservée.
    return k, xs.max(), y0


def silhouette_pleine(corps: np.ndarray, k: float, axe: int, y0: int) -> str:
    """Le corps ENTIER en un seul tracé : la moitié et son miroir.

    Deux éléments mis en miroir recevaient chacun le voile de volume, et la
    bande où ils se recouvrent le recevait deux fois — une couture claire du
    crâne aux talons. Un seul tracé, un seul voile, plus de couture. Le miroir
    est parcouru À L'ENVERS pour garder le même sens de rotation, sinon les
    deux sous-chemins s'annulent au milieu et le corps s'y troue.
    """
    c = reechantillonner(contour(ndimage.binary_dilation(corps, iterations=MARGE_SILHOUETTE)),
                         POINTS_SILHOUETTE, PAS_SILHOUETTE)
    c[:, 0] = (c[:, 0] - axe) * k
    c[:, 1] = HAUT + (c[:, 1] - y0) * k
    miroir = c[::-1].copy()
    miroir[:, 0] *= -1
    return f"{bezier(c, MARGE_SILHOUETTE * k)} {bezier(miroir, 1e9)}"


def tracer(nom: str, table: dict) -> dict:
    d = np.load(PLANCHES / f"{nom}-parts.npz")
    pile, corps = d["pile"], d["corps"]
    k, axe, y0 = repere(pile, corps)

    def vers_svg(m: np.ndarray, maxi: int = POINTS_MAX, pas: float = PAS,
                 borne: float = 0.0) -> str:
        c = contour(m)
        if len(c) < 8:
            return ""
        c = reechantillonner(c, maxi, pas)
        # Le lissage peut faire déborder un tracé de quelques dixièmes au-delà
        # de l'axe : mis en miroir, ça se dédoublerait au milieu du corps.
        c[:, 0] = np.minimum((c[:, 0] - axe) * k, borne)
        c[:, 1] = HAUT + (c[:, 1] - y0) * k
        return bezier(c, borne)

    surface: list[tuple[str, str]] = []
    for i in range(int(pile.max()) + 1):
        m = pile == i
        region = table.get(i)
        if region is None:
            continue
        if region.startswith("COUPE_"):
            axe_c, tranches, *biais = COUPES[region]
            for r, bout in coupe(m, axe_c, tranches, *biais):
                surface.append((r, vers_svg(bout)))
        else:
            surface.append((region, vers_svg(m)))

    # Clippés au corps : un décalage un peu franc ferait déborder le tracé hors
    # de la silhouette, et un muscle flotterait à côté du bras.
    profonds = [(r, vers_svg(homothetie(pile == hote, kx, ky, dx, dy) & corps))
                for face, hote, r, kx, ky, dx, dy in PROFONDS if face == nom]

    return {
        "silhouette": silhouette_pleine(corps, k, axe, y0),
        "muscles": [[r, d] for r, d in surface + profonds if d],
    }


EN_TETE = '''// Géométrie du mannequin — FICHIER GÉNÉRÉ, ne pas modifier à la main.
//
// Produit par `tools/anatomie/tracer.py` à partir des planches
// `tools/anatomie/planches/{face,dos}.png`. Pour changer une forme, on change
// le nommage des pièces dans le script et on régénère : c'est la seule façon
// de garder les deux faces dans la même géométrie.
//
// Repère : demi-corps, x de -@DEMI@ à 0, y de @HAUT@ à @BAS@. L'autre moitié
// est obtenue par symétrie scale(-1,1) au moment du rendu.

import type { MuscleRegion } from '../lib/muscles'

export type Trace = [MuscleRegion | 'neutral', string]

'''


def bloc(nom: str, valeur, commentaire: str) -> str:
    if isinstance(valeur, str):
        return f"{commentaire}\nexport const {nom} = '{valeur}'\n\n"
    if valeur and isinstance(valeur[0], list):
        lignes = "".join(f"  ['{r}', '{d}'],\n" for r, d in valeur)
        return f"{commentaire}\nexport const {nom}: Trace[] = [\n{lignes}]\n\n"
    lignes = "".join(f"  '{d}',\n" for d in valeur)
    return f"{commentaire}\nexport const {nom}: string[] = [\n{lignes}]\n\n"


def rendu(face: dict, dos: dict) -> str:
    demi = max(abs(float(v)) for r in (face, dos)
               for v in re.findall(r"(-?\d+\.\d+),", r["silhouette"]))
    out = (EN_TETE.replace('@DEMI@', str(round(demi)))
           .replace('@HAUT@', f'{HAUT:g}').replace('@BAS@', f'{BAS:g}'))
    for nom, r, quoi in (("FACE", face, "de face"), ("DOS", dos, "de dos")):
        out += bloc(f"SILHOUETTE_{nom}", r["silhouette"],
                    f"/** Contour du demi-corps {quoi} : le fond ne passe jamais entre deux tracés. */")
        out += bloc(f"{'FRONT' if nom == 'FACE' else 'BACK'}_HALF", r["muscles"],
                    f"/** Les muscles {quoi}, du plus superficiel au plus profond. */")
    return out


if __name__ == "__main__":
    face = tracer("face", FACE)
    dos = tracer("dos", DOS)
    SORTIE.write_text(rendu(face, dos), encoding="utf-8")
    for nom, r in (("face", face), ("dos", dos)):
        print(f"{nom:5} · {len(r['muscles']):2} muscles")
    print(f"→ {SORTIE.relative_to(RACINE.parent.parent)} "
          f"({SORTIE.stat().st_size // 1024} ko)")
