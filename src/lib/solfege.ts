// Un cours de solfège pour saxophoniste.
//
// Le solfège général se trouve partout ; ce qui manque toujours, c'est le
// raccord avec l'instrument qu'on a entre les mains. Chaque leçon finit donc
// par ce que la règle donne SUR un saxophone — pas une remarque en passant,
// la moitié du propos.
//
// ── D'où vient ce contenu ───────────────────────────────────────────────────
//
// Il suit le manuel « SOLFÈGE & SAXOPHONE — Du niveau zéro à la lecture
// autonome, sur Yamaha YDS-150 », le document de travail de l'élève. Chaque
// leçon renvoie à sa section : quand l'écran et le manuel se contredisent,
// c'est un défaut à corriger ici, pas une variante à assumer. Le manuel est
// aussi ce qui a permis de trouver — et de prouver — trois doigtés faux dans
// la table de cette section.
//
// L'instrument visé est donc un YDS-150 réglé en Mi♭, c'est-à-dire un ALTO :
// c'est pour ça que la leçon sur la transposition parle de sixte majeure et
// non de généralités sur la famille.
//
// L'ordre est celui où les notions s'appuient les unes sur les autres. On peut
// lire dans le désordre, pas apprendre dans le désordre.

export interface Lecon {
  id: string
  icone: string
  titre: string
  /** Ce qu'il faut retenir, en une phrase. */
  cle: string
  corps: string[]
  /** Listes compactes : mnémoniques, tableaux courts, protocoles. */
  points?: Array<{ titre: string; lignes: string[] }>
  /** Ce que la règle donne sur l'instrument. Jamais vide : c'est le sujet. */
  saxophone: string
  /** Une note de la table à montrer sur la portée, quand ça vaut un paragraphe. */
  exemple?: string
  /** Où creuser dans le manuel. */
  renvoi?: string
}

export const LECONS: Lecon[] = [
  {
    id: 'reglages',
    icone: '🎛️',
    titre: 'Régler le YDS-150',
    cle: 'Transposition sur Mi♭, et on n’y touche plus pendant six mois.',
    corps: [
      'Le YDS-150 sait transposer électroniquement en Mi♭, en Si♭ ou en Ut. Le mode Mi♭ est le réglage « saxophone alto » : c’est celui de ce cours, de la table de doigtés, et de la quasi-totalité du répertoire pédagogique.',
      'Le mode Ut est tentant — il fait sonner tes doigtés à la hauteur du piano, donc tu peux lire une partition de flûte sans rien transposer. C’est une facilité qui coûte cher : le jour où tu joues avec d’autres sur un vrai alto, personne ne transposera pour toi, et tu n’auras pas construit la compétence. Garde-le pour dépanner, jamais pour travailler.',
    ],
    points: [
      {
        titre: 'Les réglages à poser une fois',
        lignes: [
          'Transposition : Mi♭ (alto) — le seul qui compte',
          'Diapason : 440 Hz',
          'Voix : un son d’alto neutre, pas un son effeté',
          'Réverbération : au minimum — elle flatte et cache les défauts',
          'Capteur de morsure : actif, sensibilité faible',
        ],
      },
    ],
    saxophone:
      'Le YDS-150 a les doigtés exacts d’un alto acoustique : tout ce que tu apprends ici est transférable à 100 %. En revanche il ne te sanctionne pas — pas de couac, pas de justesse à rattraper. La discipline de souffle et d’embouchure, c’est à toi de te l’imposer.',
    renvoi: '§0.1 et §0.2',
  },
  {
    id: 'portee',
    icone: '🎼',
    titre: 'La portée',
    cle: 'Cinq lignes, quatre interlignes : la hauteur se lit à la place qu’occupe la note.',
    corps: [
      'Une note se pose soit SUR une ligne, soit DANS un interligne : plus elle est haut placée, plus le son est aigu. Neuf places en tout — et ton instrument a plus de trente notes. Pour celles qui dépassent, on ajoute de petits bouts de ligne, un par degré : les lignes supplémentaires.',
      'Les deux repères absolus à ancrer en premier : la 2ᵉ ligne est le Sol (celui qu’entoure la boucle de la clé), et le Do central est SOUS la portée, sur la première ligne supplémentaire.',
    ],
    points: [
      {
        titre: 'Les 5 lignes, de bas en haut',
        lignes: ['Mi – Sol – Si – Ré – Fa', '« Mistral Solide Siffle Régulier Facilement »'],
      },
      {
        titre: 'Les 4 interlignes, de bas en haut',
        lignes: ['Fa – La – Do – Mi', 'En anglais : F A C E — imbattable.'],
      },
    ],
    saxophone:
      'Le saxophone ne lit QUE la clé de sol, quelle que soit sa taille. Une chose de moins à apprendre — le pianiste, lui, en lit deux. Ton étendue écrite va du Si♭ grave, sous la portée, au Fa♯ aigu, bien au-dessus.',
    exemple: 'fa3',
    renvoi: '§1.2 et §1.4',
  },
  {
    id: 'cle-de-sol',
    icone: '🗝️',
    titre: 'La clé de sol',
    cle: 'Elle nomme la deuxième ligne « Sol ». Tout le reste s’en déduit.',
    corps: [
      'Sans clé, une portée ne donne que des hauteurs les unes par rapport aux autres, pas des noms. La clé de sol s’enroule autour de la deuxième ligne en partant du bas et déclare : celle-là, c’est le Sol. C’est de là que vient son nom, et c’est tout son travail.',
      'Il existe aussi une clé de fa (basse, trombone, main gauche du piano) et une clé d’ut (alto, violoncelle). Tu ne les liras jamais sur une partition de saxophone.',
    ],
    saxophone:
      'Regarde le dessin de la clé dans l’onglet Doigtés : sa boucle est centrée sur la deuxième ligne, pas ailleurs. Ce n’est pas décoratif — c’est exactement ce qu’elle affirme.',
    renvoi: '§1.3',
  },
  {
    id: 'noms',
    icone: '🔤',
    titre: 'Le nom des notes',
    cle: 'Sept noms en boucle : Do Ré Mi Fa Sol La Si. Et leurs équivalents anglais.',
    corps: [
      'Arrivé au Si, on repart au Do — une octave plus haut : même nom, son deux fois plus rapide. C’est pour ça que ton instrument a un Ré grave, un Ré médium et un Ré aigu, et qu’on les appelle tous les trois « Ré ».',
      'Sur la portée, ces sept noms se suivent sans jamais sauter : ligne, interligne, ligne, interligne… Deux notes voisines sur le papier sont deux noms voisins dans l’alphabet.',
      'Les noms anglo-saxons sont indispensables dès qu’on touche au jazz, aux grilles d’accords ou aux méthodes anglaises. Le moyen de s’en souvenir : l’alphabet commence au La. A B C D E F G = La Si Do Ré Mi Fa Sol.',
    ],
    points: [
      {
        titre: 'Français → anglais',
        lignes: ['Do=C · Ré=D · Mi=E · Fa=F', 'Sol=G · La=A · Si=B', '⚠️ En allemand, H = Si et B = Si♭.'],
      },
    ],
    saxophone:
      'Le classement « Par note », dans les réglages, range la liste exactement comme ça : les trois Ré ensemble, les trois Fa ensemble. C’est la meilleure façon de voir qu’un même nom se joue de deux ou trois manières selon l’octave.',
    renvoi: '§1.4',
  },
  {
    id: 'lire',
    icone: '👁️',
    titre: 'Lire sans compter',
    cle: 'Quatre ancres, puis des intervalles et des formes. Jamais « Mi Sol Si… ».',
    corps: [
      'Le débutant lit en récitant : « la note est sur la 3ᵉ ligne, donc Mi Sol Si… c’est un Si ». C’est lent, et ça ne monte jamais en vitesse — parce que la méthode elle-même plafonne, pas parce qu’on manque d’entraînement.',
      'La lecture rapide repose sur trois piliers. Des ANCRES : quatre notes reconnues instantanément, qui découpent la portée. Des INTERVALLES : une fois l’ancre trouvée, la note suivante se lit par rapport à la précédente — une tierce se voit d’un coup d’œil, ligne à ligne ou interligne à interligne. Des FORMES : une gamme, un arpège, une broderie ont un dessin reconnaissable. À terme on lit des groupes, comme on lit des mots et non des lettres.',
    ],
    points: [
      {
        titre: 'Les quatre ancres à mémoriser',
        lignes: ['Sol (2ᵉ ligne)', 'Do (3ᵉ interligne)', 'Do (1ʳᵉ ligne suppl. dessous)', 'Sol (au-dessus de la 5ᵉ ligne)'],
      },
      {
        titre: 'Exercice quotidien, 3 minutes',
        lignes: ['Une note tirée au hasard : dire son nom ET poser le doigté', 'sans regarder tes mains.', 'Objectif à 8 semaines : 60 notes/minute sans erreur.'],
      },
    ],
    saxophone:
      'Dire le nom ne suffit pas : c’est le doigté qui doit venir tout seul. Sers-toi des flèches ◀ ▶ de l’onglet Doigtés pour t’interroger — tu vois la note sur la portée, tu poses les doigts, tu vérifies sur le schéma.',
    renvoi: '§1.5',
  },
  {
    id: 'tons',
    icone: '📏',
    titre: 'Ton et demi-ton',
    cle: 'L’octave contient douze demi-tons. Les sept noms ne les couvrent pas régulièrement.',
    corps: [
      'Le demi-ton est le plus petit pas de notre musique ; le ton en vaut exactement deux. L’octave se divise en douze demi-tons égaux.',
      'Le piège est là : les sept noms ne sont PAS également espacés. De Mi à Fa, et de Si à Do, il n’y a qu’un demi-ton — rien ne se glisse entre les deux. Partout ailleurs il y a un ton, donc une note intermédiaire, qui portera un dièse ou un bémol. Sur un clavier, ça se voit d’un coup : pas de touche noire entre Mi et Fa, ni entre Si et Do.',
      'Toute la théorie découle de ces deux demi-tons naturels. Mémorise-les une fois pour toutes.',
    ],
    saxophone:
      'Un demi-ton, c’est exactement le doigté suivant dans la liste chromatique — les flèches ◀ ▶ y mènent une par une. Vérifie-le : entre Mi grave et Fa grave, la liste ne propose rien ; entre Fa grave et Sol grave, elle propose un Fa♯.',
    renvoi: '§3.1',
  },
  {
    id: 'alterations',
    icone: '♯',
    titre: 'Dièse, bémol, bécarre',
    cle: '♯ monte d’un demi-ton, ♭ descend d’un demi-ton, ♮ annule les deux.',
    corps: [
      'Le double dièse — noté ♯♯, ou « x » dans beaucoup d’éditions — monte de deux demi-tons, le double bémol descend de deux. Rares, mais ils existent, et ils ne sont pas décoratifs : ils viennent de la logique des tonalités.',
      'Deux noms tombent souvent sur le même son : le Do monté d’un demi-ton et le Ré descendu d’un demi-ton sont la même hauteur. On les dit enharmoniques. Alors pourquoi deux noms ? Parce que le nom encode la FONCTION. Dans un accord de La majeur (La–Do♯–Mi), la tierce doit s’appeler « Do quelque chose » ; l’écrire Ré♭ rendrait l’accord illisible. Le son est le même, le sens ne l’est pas.',
    ],
    points: [
      {
        titre: 'Les quatre règles de portée',
        lignes: [
          '1. Devant une note, l’altération vaut pour TOUTE LA MESURE…',
          '2. …mais sur cette note et à CETTE OCTAVE seulement.',
          '3. La barre de mesure l’annule — sauf note liée par-dessus.',
          '4. À la clé (l’armure), elle vaut pour tout le morceau et toutes les octaves.',
        ],
      },
      {
        titre: 'Le piège classique',
        lignes: ['Dans « Fa♯ – Sol – Fa – La », le troisième Fa est dièse aussi.', 'Beaucoup d’éditions le rappellent entre parenthèses. Pas toutes.'],
      },
    ],
    saxophone:
      'Do♯ et Ré♭ sont le MÊME doigté : une seule clé, un seul son, deux orthographes. La table a dû trancher un nom pour chacun — elle écrit Do♯, Fa♯, Sol♯ d’un côté, Si♭ et Mi♭ de l’autre. Si ta partition demande un Ré♭, cherche le Do♯.',
    exemple: 'do2d',
    renvoi: '§3.2 et §3.3',
  },
  {
    id: 'intervalles',
    icone: '📐',
    titre: 'Les intervalles',
    cle: 'Un nombre (combien de noms) et une qualité (combien de demi-tons).',
    corps: [
      'Le NOMBRE se compte sur les noms, bornes incluses : Do → Mi passe par Do, Ré, Mi — c’est une tierce. On compte les noms, jamais les demi-tons.',
      'La QUALITÉ précise l’écart exact. Deux familles à ne pas mélanger. L’unisson, la quarte, la quinte et l’octave sont JUSTES (et peuvent être augmentés ou diminués) — il n’existe pas de « quarte majeure ». La seconde, la tierce, la sixte et la septième sont MAJEURES ou MINEURES (une mineure vaut une majeure moins un demi-ton).',
      'Le triton (six demi-tons) est le seul qui coupe l’octave en deux parts égales. Instable, dissonant, c’est le moteur du système tonal — le Moyen Âge l’appelait diabolus in musica.',
    ],
    points: [
      {
        titre: 'À reconnaître à l’oreille',
        lignes: [
          '2 demi-tons — 2ᵈᵉ majeure — Frère Jacques',
          '4 — 3ᶜᵉ majeure — Au clair de la lune',
          '5 — 4ᵗᵉ juste — La Marseillaise',
          '7 — 5ᵗᵉ juste — Ah vous dirai-je maman',
          '9 — 6ᵗᵉ majeure — My Way',
          '12 — octave — Over the Rainbow',
        ],
      },
    ],
    saxophone:
      'Retiens la sixte majeure (9 demi-tons) : c’est exactement l’écart entre ce que tu lis et ce que le public entend sur ton alto. Chante chaque intervalle avant de le jouer — c’est ce qui construit l’oreille, et c’est ce qui te permettra un jour de jouer ce que tu entends.',
    renvoi: '§3.4',
  },
  {
    id: 'figures',
    icone: '⏱️',
    titre: 'Les figures et les silences',
    cle: 'La place de la note donne la hauteur ; son dessin donne la durée.',
    corps: [
      'Ronde, blanche, noire, croche, double croche : chacune vaut la moitié de la précédente. C’est tout le système, et il n’a pas d’exception.',
      'À chaque figure répond un silence de même durée : pause, demi-pause, soupir, demi-soupir, quart de soupir. Un silence se joue — il se compte, il s’attend. C’est le défaut le plus répandu chez les autodidactes : on écourte les silences parce qu’ils n’ont l’air de rien.',
      'Un point après la note ajoute la moitié de sa valeur : blanche pointée = trois noires. Et attention à ne pas confondre la liaison de PROLONGATION (deux notes de même hauteur, on n’en joue qu’une, longue) avec la liaison de PHRASÉ (hauteurs différentes, à jouer sans redonner de coup de langue). Même dessin, sens opposés.',
    ],
    points: [
      {
        titre: 'Les tempos, en battements par minute',
        lignes: ['Largo 40-60 · Adagio 66-76 · Andante 76-108', 'Moderato 108-120 · Allegro 120-156 · Presto 168-200'],
      },
      {
        titre: 'Pause ou demi-pause ?',
        lignes: ['La pause est plus lourde : elle PEND sous la 4ᵉ ligne.', 'La demi-pause est plus légère : elle FLOTTE sur la 3ᵉ.'],
      },
    ],
    saxophone:
      'Le silence, c’est le moment où tu respires. Repère-les AVANT de jouer et marque-les au crayon d’une virgule : c’est un réflexe professionnel. Sans ça, tu respireras là où ça t’arrange sur le moment, c’est-à-dire au milieu d’une phrase.',
    renvoi: '§2.2 à §2.4',
  },
  {
    id: 'mesure',
    icone: '🧱',
    titre: 'La mesure et le comptage',
    cle: 'Le chiffrage du haut compte les temps, celui du bas dit quelle figure vaut un temps.',
    corps: [
      '4 en bas = la noire, 8 = la croche, 2 = la blanche. Donc 3/4 : trois noires, la valse. 4/4 : le standard absolu. Le C barré (¢) est un 4/4 compté à deux, très fréquent en big band.',
      'Dans toute mesure, le premier temps est le plus fort ; en 4/4, le troisième est secondairement accentué. C’est cette grille que la musique confirme (marche, classique) ou contredit exprès (jazz, funk).',
      'Une anacrouse, ce sont une ou deux notes placées AVANT la première mesure complète. La Marseillaise, Happy Birthday, la plupart des standards commencent comme ça : compte la mesure entière dans ta tête et entre sur le bon temps.',
    ],
    points: [
      {
        titre: 'Compter à voix haute — et c’est non négociable',
        lignes: ['Noires : « 1 – 2 – 3 – 4 »', 'Croches : « 1 et 2 et 3 et 4 et »', 'Doubles : « 1 e et a, 2 e et a… »'],
      },
      {
        titre: 'Apprendre un rythme, dans cet ordre',
        lignes: [
          '1. Le lire à voix haute en comptant, sans instrument',
          '2. Le frapper dans les mains, métronome à 60',
          '3. Le chanter sur une seule note',
          '4. Le jouer sur une seule note',
          '5. Seulement alors : avec les vraies hauteurs',
        ],
      },
    ],
    saxophone:
      'Sauter les étapes 1 à 4 est la cause numéro un des blocages. Et repère les reprises, D.C., D.S. et Coda AVANT de jouer : la plupart des accidents de lecture en groupe viennent de là.',
    renvoi: '§2.5 à §2.8',
  },
  {
    id: 'ternaire',
    icone: '🔁',
    titre: 'Binaire, ternaire, syncope, swing',
    cle: 'La question n’est pas combien de temps par mesure, mais en combien de parts se divise UN temps.',
    corps: [
      'Binaire : le temps se divise en deux (2/4, 3/4, 4/4). Ternaire : il se divise en trois, et l’unité de temps devient une figure pointée (6/8, 9/8, 12/8).',
      'En mesure composée, le chiffrage ment en apparence : le chiffre du haut compte les SUBDIVISIONS, pas les temps. Divise-le par trois. Un 6/8 fait donc deux temps, pas six — et se compte « UN-la-li, DEUX-la-li ». Compter à six détruit le balancement. Piège classique : la valse est en 3/4, donc binaire à trois temps.',
      'Contretemps et syncope se confondent souvent. Test simple : si le temps fort est SILENCIEUX, c’est un contretemps ; s’il est occupé par une note commencée avant, c’est une syncope. La syncope est le moteur du jazz, du funk, de la salsa, du reggae.',
    ],
    points: [
      {
        titre: 'Le swing',
        lignes: [
          'Écrit en croches égales, joué en croches inégales (≈ 2:1).',
          'Le rapport varie avec le tempo — presque égal quand ça va vite.',
          'Ce sont les croches EN LEVÉE qui sont accentuées, pas les temps.',
          'Ça ne s’apprend pas en lisant : ça s’attrape en écoutant.',
        ],
      },
    ],
    saxophone:
      'Le swing tient autant au coup de langue qu’à la durée : « dou-dat », les notes descendantes en levée souvent liées. Repique quatre mesures d’un solo lent et compare-toi à l’original — aucune notation ne remplace l’imitation.',
    renvoi: '§5',
  },
  {
    id: 'gammes',
    icone: '🔑',
    titre: 'Gammes, armures, cycle des quintes',
    cle: 'Une seule formule d’intervalles fabrique toutes les gammes majeures.',
    corps: [
      'La gamme majeure, c’est ton – ton – demi-ton – ton – ton – ton – demi-ton. Les deux demi-tons tombent toujours entre les degrés III–IV et VII–I. Applique cette formule à n’importe quelle note et tu obtiens sa gamme majeure.',
      'Pour la construire : écris d’abord les sept noms dans l’ordre à partir de la tonique — un nom par degré, jamais deux fois le même, jamais un degré sauté — puis ajuste avec des altérations pour respecter la formule.',
      'Plutôt que de répéter ces altérations partout, on les groupe à la clé : c’est l’armure. Elle vaut pour tout le morceau, à toutes les octaves.',
    ],
    points: [
      {
        titre: 'L’ordre des dièses — invariable',
        lignes: ['Fa – Do – Sol – Ré – La – Mi – Si', '« Faites Donc Sollicitement Réparer La Minuscule Sirène »'],
      },
      {
        titre: 'L’ordre des bémols — exactement l’inverse',
        lignes: ['Si – Mi – La – Ré – Sol – Do – Fa'],
      },
      {
        titre: 'Trouver la tonalité d’un coup d’œil',
        lignes: [
          'Dièses : un demi-ton AU-DESSUS du dernier dièse.',
          'Bémols : c’est l’AVANT-DERNIER bémol.',
          'Exception à retenir : un seul bémol = Fa majeur.',
        ],
      },
    ],
    saxophone:
      'Dessine le cycle des quintes à la main, de mémoire, une fois par semaine pendant deux mois : c’est l’exercice théorique au meilleur rapport temps/bénéfice. Il donne d’un coup les armures, les tonalités voisines et l’ordre dans lequel travailler tes gammes.',
    renvoi: '§4.2 et §4.3',
  },
  {
    id: 'transposition',
    icone: '🔀',
    titre: 'Ton alto est en Mi♭',
    cle: 'La note que tu lis sonne une sixte majeure plus bas. Et c’est voulu.',
    corps: [
      'Tu lis un Do, tu poses le doigté du Do, et il sort un Mi♭. Ton instrument est transpositeur : l’écrit et l’entendu diffèrent d’une sixte majeure.',
      'Pourquoi cette complication ? Pour que toute la famille se joue pareil. Même doigté, même nom écrit, du soprano au baryton : celui qui passe de l’alto au ténor n’a rien à réapprendre — c’est l’instrument qui change de hauteur, pas le lecteur. Un service rendu au musicien, payé par une bizarrerie sur le papier.',
      'Conséquence : ta partition n’est pas celle du pianiste, et vos armures ne se ressemblent pas. Ne « corrige » jamais la tienne sur la sienne.',
    ],
    points: [
      {
        titre: 'Les quatre lignes à savoir par cœur',
        lignes: ['Concert Si♭ → tu joues en Sol', 'Concert Mi♭ → tu joues en Do', 'Concert Fa → tu joues en Ré', 'Concert Do → tu joues en La'],
      },
      {
        titre: 'Lire une partition en Ut, l’astuce',
        lignes: [
          'Une sixte au-dessus = une TIERCE EN DESSOUS, à l’octave supérieure.',
          'Une tierce se voit d’un coup d’œil : ligne→ligne, interligne→interligne.',
          'Puis armure concert + 3 dièses.',
        ],
      },
    ],
    saxophone:
      'Quand l’orchestre s’accorde sur un Si♭ concert, tu joues un Sol écrit. Et quand un guitariste annonce « on est en Mi », tu es en Do♯ majeur — sept dièses. C’est aussi pourquoi cette section n’a qu’une table de doigtés : la note ÉCRITE se joue pareil sur tous les saxophones.',
    renvoi: '§6',
  },
  {
    id: 'souffle',
    icone: '🌬️',
    titre: 'Le souffle et l’attaque',
    cle: 'Le souffle est continu ; seule la langue interrompt le son.',
    corps: [
      'La respiration utile est abdominale : à l’inspiration le ventre s’écarte, les épaules ne bougent pas. Ce qui compte n’est pas le volume d’air mais la RÉGULARITÉ du débit. Un son qui fait des vagues est un son mal soutenu.',
      'L’attaque vient de la langue, dont la pointe touche l’anche puis la quitte. Le mouvement est un RETRAIT, pas un coup : la langue libère l’anche, elle ne frappe pas. Image juste : l’air est un tuyau ouvert en permanence, la langue est le doigt qui coupe brièvement le jet.',
      'Les sons tenus sont l’exercice fondateur, celui que les professionnels font toute leur vie. Dix minutes par jour.',
    ],
    points: [
      {
        titre: 'Les trois syllabes d’attaque',
        lignes: ['« Tou » : nette, marquée (staccato, accents)', '« Dou » : douce, legato articulé', '« Lou » : presque pas d’attaque, très lié'],
      },
      {
        titre: 'Sons tenus — le protocole',
        lignes: [
          'Métronome à 60. Sol, huit temps, nuance moyenne.',
          'Ni variation de hauteur, ni de volume, ni de timbre.',
          'Quatre temps de repos, puis un demi-ton en dessous.',
          'Descendre jusqu’au Si♭ grave, puis remonter.',
        ],
      },
    ],
    saxophone:
      'Sur le YDS-150 l’anche ne vibre pas, mais la géométrie de l’embouchure est identique à celle d’un alto acoustique : dents du haut posées, lèvre inférieure en coussin léger, coins serrés vers le centre, mâchoire souple — ne mords pas. Le capteur de morsure est ton meilleur détecteur de défaut : si les notes vacillent sans que tu le veuilles, c’est que tu serres.',
    renvoi: '§8',
  },
  {
    id: 'nuances',
    icone: '🎚️',
    titre: 'Nuances et phrasé',
    cle: 'Le volume s’écrit — et au saxophone, il se joue avec l’air.',
    corps: [
      'pp très doux, p doux, mf moyennement fort, f fort, ff très fort. Les longues fourchettes ouvrantes demandent un crescendo, fermantes un decrescendo.',
      'Ce ne sont pas des mesures absolues mais des rapports : le f d’une berceuse n’est pas celui d’une fanfare. Ce qui compte, c’est l’écart entre les nuances d’un même morceau — jouer tout au même volume, c’est jouer sans rien dire.',
    ],
    points: [
      {
        titre: 'Les articulations écrites',
        lignes: [
          'Liaison ⌒ : une seule attaque, les doigts font le reste',
          'Point : note écourtée — pas plus forte',
          'Trait : tenue à pleine valeur, légèrement appuyée',
          'Accent > : attaque plus énergique, puis retour',
        ],
      },
    ],
    saxophone:
      'La nuance ne vient pas des doigts mais du souffle et de l’embouchure, et le piège est là : en soufflant plus fort on monte en justesse, en soufflant doucement on descend. Travailler ses nuances, c’est apprendre à changer le volume SANS changer la hauteur.',
    renvoi: '§9',
  },
  {
    id: 'lecture-a-vue',
    icone: '👀',
    titre: 'Lire à vue',
    cle: 'Soixante secondes d’observation, puis on ne s’arrête plus.',
    corps: [
      'Lire à vue, c’est jouer une partition jamais vue, du premier coup, sans s’arrêter. Ça se prépare : une minute d’observation avant de poser les doigts change tout.',
      'Entraînement : un morceau NOUVEAU chaque jour, cinq minutes, jamais rejoué. Le matériel ne manque pas — recueils de déchiffrage, partitions du domaine public, méthodes pour débutants, et les partitions de flûte lues en transposition.',
    ],
    points: [
      {
        titre: 'Le protocole des soixante secondes',
        lignes: [
          '1. Chiffrage : binaire ou ternaire, combien de temps',
          '2. Armure : combien d’altérations, quelle tonalité',
          '3. Tempo et caractère',
          '4. Structure : reprises, D.C., D.S., Coda',
          '5. Étendue : est-ce dans mon registre ?',
          '6. Le passage le plus difficile — chante-le mentalement',
          '7. Les respirations, marquées au crayon',
        ],
      },
      {
        titre: 'Les cinq règles d’or',
        lignes: [
          '1. Ne t’arrête JAMAIS — saute au prochain temps fort repérable.',
          '2. Le rythme prime sur les hauteurs.',
          '3. L’œil est une à deux mesures devant les doigts.',
          '4. Le tempo se règle sur le passage le plus DIFFICILE.',
          '5. Lis les groupes, pas les notes.',
        ],
      },
    ],
    saxophone:
      'Une fausse note s’oublie, un arrêt détruit la performance. Et vérifie l’étendue avant de commencer : si le morceau descend sous le Si♭ grave ou monte au-dessus du Fa♯ aigu, il te faudra le transposer ou l’adapter — mieux vaut le savoir avant la première mesure.',
    renvoi: '§11.1',
  },
]
