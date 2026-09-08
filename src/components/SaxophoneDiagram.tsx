import { SAX_KEYS, saxKey, type SaxKey } from '../lib/saxophone'

// Le saxophone dessiné comme il est : bec, col, corps, culasse, pavillon.
//
// Et surtout : les clés sont posées LÀ OÙ ELLES SONT sur l'instrument — les
// nacres au centre du corps, les palmes en haut à gauche, les spatules des
// auriculaires de part et d'autre du bas. La version d'avant les alignait en
// deux colonnes flottantes reliées par des traits : lisible, mais il fallait
// traduire mentalement « troisième rond de la colonne de gauche » en un doigt
// posé quelque part. Là, on regarde l'image et on pose les doigts.

/** Le vert des clés enfoncées — la page l'utilise aussi pour ses pastilles. */
export const CLE_ACTIVE = '#7fd39a'

const FACE_ACTIVE = '#4fa96c'
const BORD_ACTIF = '#cdf5dc'
const FACE_INACTIVE = '#f1e8d7'
const BORD_INACTIF = '#79491a'
const CUVETTE = '#a97620'
const CUVETTE_BORD = '#6b3c10'

type Forme = 'nacre' | 'bis' | 'palme' | 'spatule' | 'laterale' | 'pouce'

interface Place {
  x: number
  y: number
  forme: Forme
  /** Degrés : les spatules et les palmes ne sont pas d'aplomb sur le corps. */
  rot?: number
}

const PLACES: Record<SaxKey, Place> = {
  palmF: { x: 96, y: 113, forme: 'palme', rot: -24 },
  palmEb: { x: 94, y: 129, forme: 'palme', rot: -16 },
  palmD: { x: 92, y: 145, forme: 'palme', rot: -8 },
  octave: { x: 74, y: 171, forme: 'pouce', rot: -8 },
  bis: { x: 98, y: 169, forme: 'bis' },
  gauche1: { x: 111, y: 156, forme: 'nacre' },
  gauche2: { x: 112, y: 181, forme: 'nacre' },
  gauche3: { x: 113, y: 205, forme: 'nacre' },
  gsharp: { x: 103, y: 220, forme: 'spatule', rot: -22 },
  lowB: { x: 84, y: 230, forme: 'spatule', rot: 16 },
  lowCsharp: { x: 103, y: 242, forme: 'spatule', rot: -8 },
  lowBb: { x: 84, y: 251, forme: 'spatule', rot: 16 },
  sideE: { x: 147, y: 223, forme: 'laterale' },
  droite1: { x: 117, y: 262, forme: 'nacre' },
  droite2: { x: 118, y: 286, forme: 'nacre' },
  droite3: { x: 119, y: 310, forme: 'nacre' },
  lowC: { x: 137, y: 325, forme: 'spatule', rot: -28 },
  lowEb: { x: 149, y: 338, forme: 'spatule', rot: -28 },
}

/** Rayons du halo, par forme : il déborde de la clé sans manger la voisine. */
const HALO: Record<Forme, [number, number]> = {
  nacre: [15, 15],
  bis: [11, 11],
  palme: [15, 11],
  spatule: [15, 12],
  laterale: [11, 17],
  pouce: [14, 11],
}

function Defs() {
  return (
    <defs>
      {/* Le laiton, en UN SEUL dégradé pour tout le tube — corps, culasse et
          pavillon compris. Deux bandes claires, une par tube : celle du corps
          vers x=108, celle du pavillon vers x=196, séparées par le creux
          d'ombre de l'entre-deux. Un dégradé par tronçon donnait une marche de
          luminosité en travers du tube à chaque jointure. */}
      <linearGradient id="sax-laiton" x1="82" y1="0" x2="232" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#6b3c0f" />
        <stop offset="0.087" stopColor="#c68d35" />
        <stop offset="0.173" stopColor="#f6dc9c" />
        <stop offset="0.293" stopColor="#d59a35" />
        <stop offset="0.427" stopColor="#8f5a1b" />
        <stop offset="0.507" stopColor="#75450f" />
        <stop offset="0.6" stopColor="#c1892f" />
        <stop offset="0.76" stopColor="#f7dfa2" />
        <stop offset="0.893" stopColor="#cd9231" />
        <stop offset="1" stopColor="#6b3c0f" />
      </linearGradient>
      {/* La culasse s'enfonce dans l'ombre en tournant : sans ça, le demi-tour
          est aussi éclairé que la face avant et le tube paraît plat.
          L'ombre reste NULLE jusqu'à y=372, sous les deux jointures (y=346 côté
          corps, y=358 côté pavillon) : un dégradé qui commençait à s'assombrir
          dès le bord du tracé posait un trait net en travers du tube — neuf
          points de luminance d'un coup, mesurés à l'écran. */}
      <linearGradient id="sax-ombre-bas" x1="0" y1="340" x2="0" y2="424" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#2a1705" stopOpacity="0" />
        <stop offset="0.381" stopColor="#2a1705" stopOpacity="0" />
        <stop offset="1" stopColor="#2a1705" stopOpacity="0.55" />
      </linearGradient>
      {/* La platine des spatules : un peu de relief, sinon c'est une tache. */}
      <linearGradient id="sax-platine" x1="76" y1="216" x2="112" y2="256" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#c69235" />
        <stop offset="0.5" stopColor="#9a6a1d" />
        <stop offset="1" stopColor="#70450f" />
      </linearGradient>
      <linearGradient id="sax-col" x1="92" y1="96" x2="122" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#8a5318" />
        <stop offset="0.35" stopColor="#f2d38d" />
        <stop offset="0.7" stopColor="#c68c31" />
        <stop offset="1" stopColor="#6f3f10" />
      </linearGradient>
      {/* Le bec est en ébonite : noir mat, il fait respirer tout le laiton. */}
      <linearGradient id="sax-bec" x1="0" y1="24" x2="0" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4a423a" />
        <stop offset="0.45" stopColor="#2a251f" />
        <stop offset="1" stopColor="#15120e" />
      </linearGradient>
      {/* L'intérieur du pavillon : on doit y voir un trou, pas une plaque. */}
      <radialGradient id="sax-gorge" cx="0.5" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#8a5a1c" />
        <stop offset="0.6" stopColor="#4a2c08" />
        <stop offset="1" stopColor="#241503" />
      </radialGradient>
      {/* Une ombre portée décolle l'instrument du fond sombre de la carte. */}
      <filter id="sax-ombre" x="-20%" y="-10%" width="140%" height="125%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.5" />
      </filter>
    </defs>
  )
}

/**
 * La silhouette entière du tube, d'un seul tenant : on descend l'arête gauche
 * du corps, on contourne la culasse, on remonte le pavillon jusqu'au bord,
 * puis on redescend par l'arête intérieure. Un seul chemin pour l'aplat ET le
 * contour — découpé en trois morceaux, chaque jointure laissait une couture en
 * travers du tube.
 */
const SILHOUETTE =
  'M86,100 C84,180 83,264 84,346 C82,398 108,422 146,420 C182,418 204,392 204,354 ' +
  'C208,326 212,300 218,281 C222,269 227,260 232,254 L160,275 ' +
  'C163,278 165,283 168,290 C172,306 175,330 176,358 C177,366 178,375 174,378 ' +
  'C164,382 158,372 152,346 C150,264 143,180 134,100 Z'

/** La culasse seule, pour y poser l'ombre du demi-tour. */
const CULASSE =
  'M84,346 C82,398 108,422 146,420 C182,418 204,392 204,354 L176,358 ' +
  'C177,366 178,375 174,378 C164,382 158,372 152,346 Z'

/** Le corps de l'instrument, sans les clés. */
function Instrument() {
  return (
    <g filter="url(#sax-ombre)">
      {/* ── Le tube, aplat et contour d'un seul trait ─────────────────────── */}
      <path d={SILHOUETTE} fill="url(#sax-laiton)" stroke="#5d340c" strokeWidth="1.4" strokeLinejoin="round" />
      <path d={CULASSE} fill="url(#sax-ombre-bas)" />

      {/* ── Col ──────────────────────────────────────────────────────────── */}
      <path
        d="M126,104 C131,62 116,36 84,33 L86,55 C111,56 100,76 96,104 Z"
        fill="url(#sax-col)"
        stroke="#5d340c"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* ── Reflets ──────────────────────────────────────────────────────── */}
      <path d="M97,112 C95,190 94,268 95,338" fill="none" stroke="#ffeec6" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
      <path d="M180,346 C179,326 182,308 187,294" fill="none" stroke="#ffeec6" strokeWidth="2" strokeLinecap="round" opacity="0.28" />
      {/* Protège-culasse : la petite garde vissée sous le demi-tour. */}
      <path d="M96,378 C104,404 124,414 148,412" fill="none" stroke="#7d4c12" strokeWidth="5" strokeLinecap="round" opacity="0.5" />

      {/* ── Mécanique ────────────────────────────────────────────────────── */}
      {/* La tringle des nacres : c'est elle qui fait « saxophone » plutôt que
          « tuyau avec des pastilles ». */}
      <path d="M129,152 C133,214 134,268 131,316" fill="none" stroke="#b98526" strokeWidth="3.6" strokeLinecap="round" opacity="0.85" />
      {/* Clés latérales voisines, en laiton comme la mécanique : elles existent
          sur l'instrument mais aucun doigté standard d'ici ne les demande — la
          couleur les range du côté du mécanisme, pas des clés à presser. */}
      <g fill="#b07d27" stroke="#7a4a13" strokeWidth="1.1">
        <rect x="139" y="182" width="10" height="13" rx="5" />
        <rect x="139" y="199" width="10" height="13" rx="5" />
      </g>
      {/* Plateau des spatules d'auriculaire gauche : sur l'instrument, les
          quatre leviers sont montés sur une même platine. */}
      <ellipse
        cx="94"
        cy="236"
        rx="21"
        ry="25"
        transform="rotate(-10 94 236)"
        fill="url(#sax-platine)"
        stroke="#6b3c10"
        strokeWidth="1.2"
        opacity="0.85"
      />
      {/* Attache du pavillon sur le corps. */}
      <path d="M149,299 L169,295" stroke="#8c5c15" strokeWidth="5" strokeLinecap="round" />
      {/* Tige de la clé d'octave, qui rejoint le pouce (au dos). */}
      <path d="M80,171 L89,168" stroke="#b98526" strokeWidth="3.4" strokeLinecap="round" />

      {/* ── Gorge du pavillon ────────────────────────────────────────────── */}
      <ellipse
        cx="196"
        cy="264"
        rx="38"
        ry="14"
        transform="rotate(-16 196 264)"
        fill="url(#sax-gorge)"
        stroke="#f0cd86"
        strokeWidth="2.8"
      />

      {/* ── Bague du col, bec, ligature, anche ───────────────────────────── */}
      <ellipse cx="110" cy="102" rx="24" ry="6" fill="#b8842a" stroke="#5d340c" strokeWidth="1.2" />
      <circle cx="136" cy="106" r="4" fill="#c99436" stroke="#5d340c" strokeWidth="1.2" />
      <path
        d="M88,32 C70,28 48,28 35,34 C28,38 23,43 26,48 C30,53 36,55 43,56 C59,59 76,58 88,56 Z"
        fill="url(#sax-bec)"
        stroke="#100e0b"
        strokeWidth="1.2"
      />
      <path d="M45,56 C59,59 74,58 86,56 L86,51 C74,53 59,54 47,51 Z" fill="#e6d8b4" opacity="0.85" />
      <path d="M70,29.5 C74,40 74,47 70,58" fill="none" stroke="#cf9a35" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M79,30.5 C83,40 83,46 79,57" fill="none" stroke="#cf9a35" strokeWidth="4.2" strokeLinecap="round" />
    </g>
  )
}

function Cle({ id, actif }: { id: SaxKey; actif: boolean }) {
  const p = PLACES[id]
  const meta = saxKey(id)
  const face = actif ? FACE_ACTIVE : FACE_INACTIVE
  const bord = actif ? BORD_ACTIF : BORD_INACTIF
  const [hx, hy] = HALO[p.forme]

  const dessin = () => {
    switch (p.forme) {
      case 'nacre':
        return (
          <>
            <circle cx={p.x} cy={p.y} r="10.5" fill={CUVETTE} stroke={CUVETTE_BORD} strokeWidth="1.1" />
            <circle cx={p.x} cy={p.y} r="7.2" fill={face} stroke={bord} strokeWidth="1.3" />
          </>
        )
      case 'bis':
        return (
          <>
            <circle cx={p.x} cy={p.y} r="7" fill={CUVETTE} stroke={CUVETTE_BORD} strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r="4.4" fill={face} stroke={bord} strokeWidth="1.1" />
          </>
        )
      case 'palme':
        return <rect x={p.x - 9} y={p.y - 5} width="18" height="10" rx="5" fill={face} stroke={bord} strokeWidth="1.3" />
      case 'spatule':
        return <rect x={p.x - 8.5} y={p.y - 6} width="17" height="12" rx="6" fill={face} stroke={bord} strokeWidth="1.3" />
      case 'laterale':
        return <rect x={p.x - 5.5} y={p.y - 11} width="11" height="22" rx="5.5" fill={face} stroke={bord} strokeWidth="1.3" />
      case 'pouce':
        return <rect x={p.x - 8} y={p.y - 6} width="16" height="12" rx="6" fill={face} stroke={bord} strokeWidth="1.3" />
    }
  }

  return (
    <g transform={p.rot ? `rotate(${p.rot} ${p.x} ${p.y})` : undefined}>
      <title>{meta.aide}</title>
      {actif ? <ellipse cx={p.x} cy={p.y} rx={hx} ry={hy} fill={CLE_ACTIVE} opacity="0.28" /> : null}
      {dessin()}
    </g>
  )
}

export function SaxophoneDiagram({ keys }: { keys: SaxKey[] }) {
  const actives = new Set(keys)
  const nommees = keys.map((k) => saxKey(k).nom).join(', ')

  return (
    <svg
      viewBox="10 16 230 416"
      className="mx-auto w-full max-w-[15rem]"
      role="img"
      aria-label={keys.length ? `Clés à presser : ${nommees}.` : 'Aucune clé à presser.'}
    >
      <Defs />
      <Instrument />
      {SAX_KEYS.map((k) => (
        <Cle key={k.id} id={k.id} actif={actives.has(k.id)} />
      ))}
    </svg>
  )
}
