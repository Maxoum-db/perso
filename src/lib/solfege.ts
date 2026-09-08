// Un cours de solfège pour saxophoniste.
//
// Le solfège général se trouve partout ; ce qui manque toujours, c'est le
// raccord avec l'instrument qu'on a entre les mains. Chaque leçon finit donc
// par ce que la règle donne SUR un saxophone — pas une remarque en passant,
// la moitié du propos. C'est pour ça que le cours vit dans cette section-là
// et pas dans un coin « culture générale ».
//
// L'ordre est celui où les notions s'appuient les unes sur les autres : la
// portée avant la clé, la clé avant les noms, les noms avant les demi-tons,
// les demi-tons avant les altérations. On peut lire dans le désordre, mais
// pas apprendre dans le désordre.

export interface Lecon {
  id: string
  icone: string
  titre: string
  /** Ce qu'il faut retenir, en une phrase. */
  cle: string
  corps: string[]
  /** Ce que la règle donne sur l'instrument. Jamais vide : c'est le sujet. */
  saxophone: string
  /** Une note de la table à montrer sur la portée, quand ça vaut mieux qu'un paragraphe. */
  exemple?: string
}

export const LECONS: Lecon[] = [
  {
    id: 'portee',
    icone: '🎼',
    titre: 'La portée',
    cle: 'Cinq lignes, quatre interlignes : la hauteur d’un son se lit à la place qu’il occupe.',
    corps: [
      'Une portée, ce sont cinq lignes horizontales et les quatre espaces entre elles. Une note se pose soit SUR une ligne, soit DANS un interligne : plus elle est haut placée, plus le son est aigu. Il n’y a rien d’autre à comprendre — tout le reste du solfège vient se poser là-dessus.',
      'Neuf places, donc, alors que ton saxophone a trente-deux notes. Pour celles qui dépassent, on ajoute de petits bouts de ligne, un par degré : les lignes supplémentaires. Le Si♭ grave en demande une en dessous, le Fa aigu trois au-dessus.',
    ],
    saxophone:
      'Le saxophone ne lit QUE la clé de sol, quelle que soit sa taille — alto, ténor, soprano, baryton. Une partition de saxophone ne te demandera jamais de déchiffrer une autre clé : c’est une chose de moins à apprendre, contrairement au pianiste qui en lit deux.',
    exemple: 'fa3',
  },
  {
    id: 'cle-de-sol',
    // Une clé et pas le glyphe musical 𝄞 : il vit hors du plan Unicode de base
    // et les polices d'Android ne le portent pas toutes — ce serait un carré
    // vide en tête de la leçon qui parle justement de ce signe. Même raison que
    // pour la clé dessinée à la main sur la portée.
    icone: '🗝️',
    titre: 'La clé de sol',
    cle: 'Elle nomme la deuxième ligne « Sol ». Tout le reste s’en déduit.',
    corps: [
      'Sans clé, une portée ne dit rien : elle donne des hauteurs les unes par rapport aux autres, pas des noms. La clé de sol s’enroule autour de la deuxième ligne en partant du bas et déclare : celle-là, c’est le Sol. C’est de là que vient son nom, et c’est tout son travail.',
      'Une fois ce Sol posé, les autres suivent de proche en proche : la ligne au-dessus est un Si, l’interligne en dessous un Fa. On ne mémorise pas neuf positions, on en mémorise une et on compte à partir d’elle.',
    ],
    saxophone:
      'Regarde le dessin de la clé dans l’onglet Doigtés : sa boucle est centrée sur la deuxième ligne, pas ailleurs. Ce n’est pas décoratif — c’est exactement ce qu’elle affirme.',
  },
  {
    id: 'noms',
    icone: '🔤',
    titre: 'Le nom des notes',
    cle: 'Sept noms qui tournent en boucle : Do Ré Mi Fa Sol La Si, puis Do à nouveau.',
    corps: [
      'L’alphabet musical ne compte que sept noms. Arrivé au Si, on repart au Do — mais une octave plus haut : même nom, même couleur, son deux fois plus rapide. C’est pour ça que ton instrument a un Ré grave, un Ré médium et un Ré aigu, et qu’on les appelle tous les trois « Ré ».',
      'Sur la portée, ces sept noms se suivent sans jamais sauter : ligne, interligne, ligne, interligne… Deux notes voisines sur le papier sont deux noms voisins dans l’alphabet. Si tu sais lire une note, tu sais lire ses deux voisines sans rien apprendre de plus.',
    ],
    saxophone:
      'Le classement « Par note », dans les réglages, range la liste exactement comme ça : les trois Ré ensemble, les trois Fa ensemble. C’est la meilleure façon de voir qu’un même nom se joue de deux ou trois manières selon l’octave.',
  },
  {
    id: 'tons',
    icone: '📏',
    titre: 'Ton et demi-ton',
    cle: 'Le demi-ton est le plus petit pas. Un ton en vaut deux.',
    corps: [
      'Entre deux notes, l’écart se compte en tons et en demi-tons. Le demi-ton est le plus petit pas de notre musique ; le ton en vaut exactement deux.',
      'Le piège est là : les sept noms ne sont PAS également espacés. De Mi à Fa, et de Si à Do, il n’y a qu’un demi-ton — rien ne se glisse entre les deux. Partout ailleurs il y a un ton, donc une note intermédiaire, qui portera un dièse ou un bémol.',
    ],
    saxophone:
      'Un demi-ton, c’est exactement le doigté suivant dans la liste chromatique — les flèches ◀ ▶ de la barre de notes t’y emmènent une par une. Vérifie-le : entre Mi grave et Fa grave, la liste ne propose rien ; entre Fa grave et Sol grave, elle propose un Fa♯.',
  },
  {
    id: 'alterations',
    icone: '♯',
    titre: 'Dièse, bémol, bécarre',
    cle: '♯ monte d’un demi-ton, ♭ descend d’un demi-ton, ♮ annule les deux.',
    corps: [
      'Ces trois signes s’appellent des altérations. Le dièse monte la note d’un demi-ton, le bémol la descend d’un demi-ton, le bécarre efface l’un ou l’autre et rend la note naturelle.',
      'Trois règles que leur oubli fait payer cher. Le signe s’écrit AVANT la note sur la portée, mais se dit après : on écrit le dièse puis la note, on lit « do dièse ». Il vaut jusqu’à la fin de la MESURE, et pas seulement pour la note qu’il touche. Et il ne vaut que pour cette hauteur-là : un dièse posé sur le Do du milieu ne diésé pas le Do de l’octave au-dessus.',
      'Enfin, deux noms tombent souvent sur le même son : le Do monté d’un demi-ton et le Ré descendu d’un demi-ton sont la même hauteur. On dit qu’ils sont enharmoniques, et on écrit celui qui va avec la tonalité du morceau — pas celui qu’on préfère.',
    ],
    saxophone:
      'Do♯ et Ré♭ sont le MÊME doigté : une seule clé, un seul son, deux orthographes. Ma table a dû trancher un nom pour chacun — elle écrit Do♯, Fa♯, Sol♯ d’un côté, Si♭ et Mi♭ de l’autre, les écritures les plus courantes. Si ta partition demande un Ré♭, cherche le Do♯.',
    exemple: 'do2d',
  },
  {
    id: 'armure',
    icone: '🔑',
    titre: 'L’armure',
    cle: 'Les dièses ou bémols groupés après la clé valent pour tout le morceau.',
    corps: [
      'Plutôt que de répéter le même dièse à chaque mesure, on le pose une fois pour toutes juste après la clé : c’est l’armure. Elle s’applique à toutes les notes de ce nom, à toutes les octaves, du début à la fin, sauf indication contraire.',
      'Les dièses arrivent toujours dans le même ordre : Fa, Do, Sol, Ré, La, Mi, Si. Les bémols dans l’ordre exactement inverse : Si, Mi, La, Ré, Sol, Do, Fa. Rien à réciter tout de suite, mais c’est une clé de lecture : un morceau à deux dièses aura forcément Fa♯ et Do♯, jamais un autre couple.',
    ],
    saxophone:
      'L’armure de ta partition ne sera pas celle du pianiste assis à côté de toi, et c’est normal — voir la leçon sur la transposition. Ne « corrige » jamais ton armure sur la sienne : vous ne lisez pas le même papier pour produire le même son.',
  },
  {
    id: 'figures',
    icone: '⏱️',
    titre: 'Les figures et les silences',
    cle: 'La place de la note donne la hauteur ; son dessin donne la durée.',
    corps: [
      'Ronde (creuse, sans queue), blanche (creuse avec queue), noire (pleine avec queue), croche (une barre au bout de la queue), double croche (deux barres). Chacune vaut la moitié de la précédente — c’est tout le système, et il n’a pas d’exception.',
      'À chaque figure répond un silence de même durée : pause, demi-pause, soupir, demi-soupir, quart de soupir. Un silence se joue : il se compte, il s’attend. C’est le défaut le plus répandu chez les débutants — on écourte les silences parce qu’ils n’ont l’air de rien.',
      'Un point placé après une note ajoute la moitié de sa valeur : une blanche pointée vaut trois noires, une noire pointée vaut une noire et une croche.',
    ],
    saxophone:
      'Le silence, au saxophone, c’est le moment où tu reprends ton souffle. Repère-les AVANT de jouer un morceau : c’est là que tu décides où respirer. Sans ça, tu respireras là où ça t’arrange sur le moment, c’est-à-dire au milieu d’une phrase.',
  },
  {
    id: 'mesure',
    icone: '🧱',
    titre: 'La mesure',
    cle: 'Les barres découpent le temps ; le chiffrage dit comment.',
    corps: [
      'Les barres verticales coupent la portée en mesures de durée égale. Le chiffrage — les deux chiffres posés après l’armure — dit laquelle : celui du haut compte les temps par mesure, celui du bas dit quelle figure vaut un temps (4 pour la noire, 8 pour la croche, 2 pour la blanche).',
      '4/4 : quatre noires par mesure, de loin la plus répandue. 3/4 : trois noires, c’est la valse. 6/8 : six croches, qu’on sent en deux groupes de trois — le balancement des marches et des gigues.',
      'Dans toute mesure, le premier temps est le plus fort. C’est lui qui donne l’élan, et c’est à lui qu’on se raccroche quand on s’est perdu en route.',
    ],
    saxophone:
      'Compte à voix haute avant de jouer, puis dans ta tête en jouant. Un métronome te dira si tu as raison : sans lui, on accélère toujours dans les passages faciles et on ralentit dans les difficiles, sans jamais s’en apercevoir.',
  },
  {
    id: 'transposition',
    icone: '🔀',
    titre: 'Le saxophone est transpositeur',
    cle: 'Ton Do écrit ne sonne pas un Do. Et c’est voulu.',
    corps: [
      'Quand tu lis un Do et que tu poses le doigté du Do, il sort autre chose. Sur un alto (en Mi♭), il sort un Mi♭, une sixte majeure plus bas. Sur un ténor (en Si♭), un Si♭ une neuvième plus bas — une octave et un ton. Le soprano sonne un ton en dessous de ce qui est écrit, le baryton une octave et une sixte.',
      'Pourquoi cette complication ? Pour que toute la famille se joue de la même façon. Même doigté, même nom écrit, du soprano au baryton : celui qui passe de l’alto au ténor n’a rien à réapprendre — c’est l’instrument qui change de hauteur, pas le lecteur. C’est un service rendu au musicien, payé par une bizarrerie sur le papier.',
      'Conséquence pratique : ta partition n’est pas celle du pianiste. Quand on te demande de jouer « en Do », comprends « à la hauteur du piano » : il te faut une partition écrite pour ton instrument, ou transposer toi-même.',
    ],
    saxophone:
      'C’est exactement pourquoi cette section n’a aucun réglage d’instrument et une seule table de doigtés : la note ÉCRITE se joue pareil sur un alto, un ténor, un soprano ou un baryton. Ce qui change, c’est ce qu’entendent les gens en face.',
  },
  {
    id: 'nuances',
    icone: '🌬️',
    titre: 'Les nuances',
    cle: 'Le volume s’écrit — et au saxophone, il se joue avec l’air.',
    corps: [
      'Sous la portée, des lettres italiennes donnent le volume : pp très doux, p doux, mf moyennement fort, f fort, ff très fort. Les longues fourchettes ouvrantes demandent un crescendo, de plus en plus fort ; fermantes, un decrescendo.',
      'Ce ne sont pas des mesures absolues mais des rapports : le f d’une berceuse n’est pas celui d’une fanfare. Ce qui compte, c’est l’écart entre les nuances d’un même morceau — jouer tout au même volume, c’est jouer sans rien dire.',
    ],
    saxophone:
      'La nuance ne vient pas des doigts mais du souffle et de l’embouchure, et le piège est là : en soufflant plus fort on monte en justesse, en soufflant doucement on descend. Travailler ses nuances au saxophone, c’est apprendre à changer le volume SANS changer la hauteur — au réglage de l’embouchure, pas à la pression seule.',
  },
]
