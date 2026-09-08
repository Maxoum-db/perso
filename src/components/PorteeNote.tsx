import type { SaxNote } from '../lib/saxophone'

// La note sur une portée, en clé de sol.
//
// C'est la note ÉCRITE, celle qu'on lit sur la partition — la même pour tous
// les saxophones. Ce qui sort de l'instrument est transposé (un alto en Mi♭
// sonne une sixte majeure plus bas), mais ça ne regarde ni le lecteur ni les
// doigts : on lit ce qui est écrit, on pose le doigté d'en face.

/** Écart entre deux lignes de la portée. */
const PAS = 8
/** Ordonnée de la ligne du bas (le Mi), qui sert d'origine aux degrés. */
const Y_MI = 74
const X_NOTE = 104
const X_ALTERATION = 84

/** L'ordonnée d'un degré : un degré = un demi-interligne. */
const y = (degre: number) => Y_MI - (degre * PAS) / 2

/**
 * Les lignes supplémentaires à tracer pour une note hors de la portée.
 *
 * Toutes celles qui séparent la note de la portée, la sienne comprise si elle
 * est sur une ligne. Une note dans l'interligne juste sous la portée (le Si
 * grave, degré -3) réclame quand même celle du Do : sans elle, rien ne dit à
 * quelle hauteur elle pend.
 */
function lignesSupplementaires(degre: number): number[] {
  const lignes: number[] = []
  for (let d = 10; d <= degre; d += 2) lignes.push(d)
  for (let d = -2; d >= degre; d -= 2) lignes.push(d)
  return lignes
}

/**
 * La clé de sol, tracée à la main — directement dans les repères de la portée,
 * pour que ses points remarquables tombent sur les bonnes lignes.
 *
 * En un seul trait, comme elle s'écrit : on part de l'œil de la spirale, posé
 * sur la ligne du Sol — c'est tout son propos, c'est elle qui nomme la clé —,
 * on déroule la boucle autour en s'élargissant, on monte au-dessus de la
 * portée, on retourne la volute du haut, et on redescend en traversant la
 * boucle jusqu'à la queue crochetée sous la portée.
 *
 * Dessinée et pas écrite en caractère : le glyphe musical Unicode (U+1D11E)
 * vit hors du plan multilingue de base, et les polices d'Android ne le portent
 * pas toutes — ce serait un carré vide à la place de la clé, sur le téléphone
 * de celui qui s'en sert.
 */
const CLE_SOL =
  'M20,66 C24.5,65.5 27,68 26.5,72 C26,76.5 21,80 15.5,79 ' +
  'C10,78 7,72 8.5,66 C10,60.5 15,57.5 19,57.5 ' +
  'C23,52 27,46 27.5,38 C28,30 24.5,24 20,25.5 ' +
  'C15.5,27 14.5,33 17,39.5 C19,45.5 22.5,54 23,62 ' +
  'C23.5,71 23,80.5 21.5,87.5 C20,93.5 15,96.5 11.5,94 ' +
  'C9,92 9.5,88 12,87.5'

function Alteration({ type, cy }: { type: 'diese' | 'bemol'; cy: number }) {
  const commun = {
    stroke: 'rgb(var(--copper))',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    fill: 'none',
  }
  if (type === 'diese') {
    return (
      <g transform={`translate(${X_ALTERATION} ${cy})`} {...commun}>
        <line x1="-2.6" y1="-6.5" x2="-2.6" y2="6" />
        <line x1="2.6" y1="-7.5" x2="2.6" y2="5" />
        <line x1="-5.4" y1="-1.6" x2="5.4" y2="-3.2" />
        <line x1="-5.4" y1="3.4" x2="5.4" y2="1.8" />
      </g>
    )
  }
  return (
    <g transform={`translate(${X_ALTERATION} ${cy})`} {...commun} strokeLinejoin="round">
      <path d="M-2,-9.5 L-2,4.5 C2,1.5 4.6,0 4.6,-2.2 C4.6,-4.4 1.4,-4.2 -2,-1" />
    </g>
  )
}

export function PorteeNote({ note }: { note: SaxNote }) {
  const cy = y(note.degre)
  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 150 100"
        className="mx-auto w-full max-w-[11rem]"
        role="img"
        aria-label={`${note.label} sur la portée, en clé de sol`}
      >
        <g stroke="rgb(var(--ink))" strokeWidth="1" opacity="0.5">
          {[0, 2, 4, 6, 8].map((d) => (
            <line key={d} x1="6" y1={y(d)} x2="144" y2={y(d)} />
          ))}
        </g>

        <path
          d={CLE_SOL}
          fill="none"
          stroke="rgb(var(--ink))"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        <g stroke="rgb(var(--copper))" strokeWidth="1.2" strokeLinecap="round">
          {lignesSupplementaires(note.degre).map((d) => (
            <line key={d} x1={X_NOTE - 11} y1={y(d)} x2={X_NOTE + 11} y2={y(d)} />
          ))}
        </g>

        {note.alteration ? <Alteration type={note.alteration} cy={cy} /> : null}

        {/* Une ronde : sans queue ni durée, elle ne dit qu'une hauteur — c'est
            exactement ce qu'on lui demande ici. */}
        <ellipse
          cx={X_NOTE}
          cy={cy}
          rx="6"
          ry="4.2"
          transform={`rotate(-18 ${X_NOTE} ${cy})`}
          fill="none"
          stroke="rgb(var(--copper))"
          strokeWidth="2.6"
        />
      </svg>
      <p className="text-center text-[10px] text-muted">Note écrite, en clé de sol — la même sur tous les saxophones.</p>
    </div>
  )
}
