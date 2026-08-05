"""Remplace les tracés écrits à la main par les contours DÉCALQUÉS.

On ne remplace que les correspondances sans ambiguïté : un contour de la planche
qui recouvre exactement une région du modèle. Les régions PROFONDES — supra-
épineux, sous-scapulaire, transverse, multifides, rotateurs de hanche — ne
figurent sur aucune planche de surface et gardent leur tracé écrit à la main.

Les tracés du mannequin sont dessinés en demi-corps GAUCHE puis reflétés. On ne
prend donc que les contours à x négatif ; ceux qui franchissent l'axe (fessiers,
grand droit) sont rognés à la moitié gauche.
"""
import json, re, sys

# id du contour → région. Établi en regardant l'aperçu numéroté produit par
# segmente.py, et vérifié sur les boîtes englobantes.
FACE = {
    17: 'serratus',        # digitations du flanc, sous l'aisselle
    20: 'obliques',        # nappe du flanc, du gril costal à la crête
    4:  'vastusLat',       # masse externe de la cuisse
    22: 'vastusMed',       # goutte au-dessus du genou
    11: 'tibialis',        # jambier antérieur, en dehors du tibia
    13: 'gastroc',         # jumeau interne, visible de face
}
DOS = {
    5:  'lats',            # le V du grand dorsal
    6:  'trapsUpper',      # trapèze, moitié gauche
    7:  'bicepsFemoris',   # ischio externe
    1:  'gastroc',         # jumeau, vue de dos
    10: 'erectors',        # colonnes para-vertébrales
}
# Ceux-là franchissent l'axe et sont rognés.
ROGNER = {'lats', 'trapsUpper', 'erectors'}

def points(d):
    return [(float(a), float(b)) for a, b in
            re.findall(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', d)]

def rogne(d):
    """Ramène tout ce qui dépasse l'axe à x = -0.4.

    Un tracé qui franchit la ligne médiane se dédouble au centre du corps une
    fois reflété — c'est le défaut qui avait donné une bande unique entre les
    deux cuisses à la place du gracile. On préfère un bord droit sur l'axe, qui
    est d'ailleurs ce que fait l'anatomie : le trapèze et les érecteurs se
    rejoignent sur la colonne.
    """
    return re.sub(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)',
                  lambda m: f"{min(float(m.group(1)), -0.4):.1f},{m.group(2)}", d)

p = 'src/components/MuscleBodyDiagram.tsx'
s = open(p).read()
i = s.index("export const FRONT_HALF")
mid = s.index("export const BACK_HALF")
fin = s.index("\n]\n", mid) + 3
avant, face, dos, apres = s[:i], s[i:mid], s[mid:fin], s[fin:]

faits = []
for bloc_nom, bloc, table in (('face', face, FACE), ('dos', dos, DOS)):
    data = json.load(open(f'tools/anatomie/planches/{bloc_nom}-contours.json'))
    par_id = {c['id']: c for c in data['comps']}
    for cid, region in table.items():
        c = par_id.get(cid)
        if c is None:
            print(f'  ⚠ contour {cid} absent de {bloc_nom}')
            continue
        d = c['d']
        xs = [x for x, _ in points(d)]
        if region in ROGNER:
            d = rogne(d)
        elif max(xs) > 0:
            print(f'  ⚠ {region} franchit l’axe sans être rogné (max x {max(xs):.1f})')
            continue
        motif = re.compile(r"\['" + region + r"', (?:'[^']*'(?:\s*\+\s*)?)+\]")
        remplacé, n = motif.subn(f"['{region}', '{d}']", bloc, count=1)
        if n:
            bloc = remplacé
            faits.append(f'{bloc_nom}:{region}')
        else:
            print(f'  ⚠ {region} introuvable dans {bloc_nom}')
    if bloc_nom == 'face':
        face = bloc
    else:
        dos = bloc

open(p, 'w').write(avant + face + dos + apres)
print(f'{len(faits)} tracés décalqués : ' + ' · '.join(faits))
