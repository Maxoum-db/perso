#!/usr/bin/env python3
"""Découpe des planches anatomiques en régions musculaires.

Les planches `face2.png` / `dos2.png` sont des aplats de couleur séparés par un
trait sombre. C'est exactement ce qu'il faut pour un découpage automatique — à
une condition : le trait doit disparaître AVANT le découpage, sinon chaque
muscle se retrouve entouré d'un liseré vide et le rendu montre des fissures
noires entre les muscles. C'est ce qui rendait le premier essai « moche ».

La chaîne :
  1. médiane large → les stries de fibres et le trait de contour s'effacent,
     les aplats survivent ;
  2. quantification en une palette réduite, puis fusion des teintes voisines
     (un même muscle peut se scinder en deux entrées de palette) ;
  3. composantes connexes → une par muscle, et les muscles voisins se TOUCHENT
     puisque le trait a disparu ;
  4. planche de repérage numérotée, pour nommer les composantes à l'œil.

Sortie : `planches/<nom>-parts.png` (repérage) et `planches/<nom>-parts.npz`
(masques), consommés par `tracer.py`.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

RACINE = Path(__file__).resolve().parent
PLANCHES = RACINE / "planches"

MEDIANE = 9          # largeur du filtre médian, en pixels
PALETTE = 64         # couleurs demandées à la quantification
FUSION = 46          # distance RGB en deçà de laquelle deux teintes n'en font qu'une
AIRE_MIN = 500       # px : en deçà, c'est un artefact ou un doigt
SEUIL_TRAIT = 0.80   # luminance relative en deçà de laquelle un pixel est un trait
COLMATAGE = 6        # px : distance maximale de rattachement d'un pixel orphelin


def masque_corps(rgb: np.ndarray) -> np.ndarray:
    """Silhouette pleine : tout ce qui n'est pas le fond blanc du bord."""
    blanc = (rgb > 244).all(2)
    fond, _ = ndimage.label(blanc)
    bords = set(fond[0].tolist()) | set(fond[-1].tolist()) | set(fond[:, 0].tolist()) | set(fond[:, -1].tolist())
    bords.discard(0)
    exterieur = np.isin(fond, list(bords))
    return ndimage.binary_fill_holes(~exterieur)


def palette_reduite(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Quantifie puis fusionne les teintes voisines. Rend (index, couleurs)."""
    quant = Image.fromarray(rgb).quantize(colors=PALETTE, method=Image.Quantize.MEDIANCUT)
    idx = np.asarray(quant)
    brute = np.asarray(quant.getpalette()[: PALETTE * 3], dtype=np.int16).reshape(-1, 3)

    # Fusion gloutonne : on parcourt les teintes de la plus fréquente à la plus
    # rare et on rattache chacune au premier chef de file assez proche.
    effectifs = np.bincount(idx.ravel(), minlength=PALETTE)
    chefs: list[int] = []
    vers = np.arange(PALETTE)
    for c in np.argsort(-effectifs):
        if effectifs[c] == 0:
            continue
        proche = next((k for k in chefs if np.abs(brute[c] - brute[k]).sum() < FUSION), None)
        if proche is None:
            chefs.append(int(c))
            vers[c] = c
        else:
            vers[c] = proche
    return vers[idx], brute


def trait_de_contour(rgb: np.ndarray) -> np.ndarray:
    """Le trait noir qui sépare deux muscles de MÊME couleur.

    Sans lui, le quadriceps ne fait qu'une seule tache rouge : droit fémoral,
    vaste latéral et vaste médial partagent la teinte et se retrouvent fondus.
    Le trait est très sombre (moins de la moitié de la luminance locale) là où
    les stries de fibres, elles, restent à quelques pour cent près.
    """
    lum = rgb.astype(np.float32).mean(2)
    return lum / np.maximum(ndimage.median_filter(lum, size=MEDIANE), 1) < SEUIL_TRAIT


def axe_median(corps: np.ndarray) -> int:
    """Colonne qui sépare le corps en deux moitiés d'aire égale."""
    cumul = np.cumsum(corps.sum(0))
    return int(np.searchsorted(cumul, cumul[-1] / 2))


def decouper(nom: str) -> dict:
    rgb = np.asarray(Image.open(PLANCHES / f"{nom}.png").convert("RGB"))
    corps = masque_corps(rgb)

    # On ne garde qu'une moitié : le mannequin est dessiné en demi-corps puis
    # mis en miroir. Découper les deux côtés doublerait le travail de
    # nommage — et introduirait des asymétries là où la planche en a.
    axe = axe_median(corps)
    corps[:, axe + 1:] = False

    lisse = ndimage.median_filter(rgb, size=(MEDIANE, MEDIANE, 1))
    teintes, couleurs = palette_reduite(lisse)
    teintes = np.where(corps & ~trait_de_contour(rgb), teintes, -1)

    masques: list[np.ndarray] = []
    fiches: list[dict] = []
    for t in np.unique(teintes):
        if t < 0:
            continue
        etiquettes, n = ndimage.label(teintes == t)
        for i in range(1, n + 1):
            m = etiquettes == i
            aire = int(m.sum())
            if aire < AIRE_MIN:
                continue
            ys, xs = np.nonzero(m)
            # Le centre de gravité peut tomber hors d'une pièce en croissant :
            # on pose le numéro sur le point le plus « intérieur » à la place.
            dist = ndimage.distance_transform_edt(m)
            cy, cx = np.unravel_index(int(np.argmax(dist)), dist.shape)
            masques.append(m)
            fiches.append({
                "couleur": [int(v) for v in couleurs[t]],
                "aire": aire,
                "centre": [float(cx), float(cy)],
                "boite": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            })

    # Les plus grosses d'abord : les numéros bas désignent les gros muscles,
    # ce qui rend la planche de repérage lisible.
    ordre = sorted(range(len(fiches)), key=lambda i: -fiches[i]["aire"])
    masques = [masques[i] for i in ordre]
    fiches = [fiches[i] for i in ordre]

    pile = np.zeros(rgb.shape[:2], dtype=np.int16) - 1
    for i, m in enumerate(masques):
        pile[m] = i

    # Le trait de contour et les éclats trop petits n'appartiennent encore à
    # personne. On les donne au voisin le plus proche : c'est ce qui fait que
    # les muscles se TOUCHENT au lieu d'être bordés d'un liseré vide — le
    # défaut qui donnait ces fissures noires sur fond sombre.
    orphelin = corps & (pile < 0)
    if orphelin.any():
        # L'EDT mesure la distance aux ZÉROS : on lui donne « non attribué »,
        # elle rend donc l'indice du pixel attribué le plus proche.
        dist, (iy, ix) = ndimage.distance_transform_edt(pile < 0, return_indices=True)
        # Mais seulement de PRÈS. Sans ce plafond, les vingt éclats d'une main
        # — tous sous le seuil d'aire — étaient absorbés par la seule pièce
        # retenue de la main, et la main entière devenait un muscle.
        proche = orphelin & (dist <= COLMATAGE)
        pile[proche] = pile[iy[proche], ix[proche]]
    np.savez_compressed(PLANCHES / f"{nom}-parts.npz", pile=pile, corps=corps)

    reperage(rgb, fiches, PLANCHES / f"{nom}-parts.png")
    (PLANCHES / f"{nom}-parts.json").write_text(
        json.dumps(fiches, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return {"nom": nom, "axe": axe, "pieces": len(fiches), "couvert": float((pile >= 0).sum() / corps.sum())}


POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
# Trois bandes qui se recouvrent : agrandies, les numéros redeviennent lisibles.
BANDES = {"haut": (0.00, 0.36), "milieu": (0.32, 0.68), "bas": (0.64, 1.00)}


def reperage(rgb: np.ndarray, fiches: list[dict], sortie: Path) -> None:
    """Planche numérotée, éclaircie, pour nommer les pièces à l'œil."""
    im = Image.fromarray((rgb * 0.40 + 255 * 0.60).astype(np.uint8))
    d = ImageDraw.Draw(im)
    f28 = ImageFont.truetype(POLICE, 28)
    for i, f in enumerate(fiches):
        x, y = f["centre"]
        # Un centre de gravité peut tomber hors de sa pièce (croissant, anneau) :
        # on le ramène sur un pixel qui lui appartient vraiment.
        d.text((x, y), str(i), fill=(0, 0, 0), font=f28, anchor="mm",
               stroke_width=4, stroke_fill=(255, 255, 255))
    im.save(sortie)
    h = im.height
    for nom, (a, b) in BANDES.items():
        im.crop((0, int(a * h), im.width, int(b * h))).resize(
            (im.width * 3 // 2, int((b - a) * h) * 3 // 2), Image.LANCZOS
        ).save(sortie.with_name(f"{sortie.stem}-{nom}.png"))


if __name__ == "__main__":
    for nom in sys.argv[1:] or ["face", "dos"]:
        r = decouper(nom)
        print(f"{r['nom']:6} · axe x={r['axe']} · {r['pieces']:3} pièces · {r['couvert']:.0%} couvert")
