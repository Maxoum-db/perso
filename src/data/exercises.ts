// Bibliothèque de référence des exercices.
//
// Chaque entrée liste TOUS les groupes musculaires sollicités, avec un
// coefficient d'intensité : 1 = moteur principal, 0.5-0.8 = secondaire,
// 0.3-0.4 = stabilisateur / sollicitation légère.
//
// Elle sert à deux choses (voir ensureLibrary dans lib/muscu.ts) :
//   1. compléter les exercices déjà au catalogue qui n'avaient qu'un groupe ;
//   2. ajouter au catalogue ceux qui manquent.

export interface LibraryExercise {
  name: string
  groups: string // « Pectoraux:1, Triceps:0.5 »
  sets: number
  reps: string
  notes?: string
  /**
   * Activité à part entière (nage, course, béhourd, bois, cardio machine) par
   * opposition à un exercice de salle. Elles comptent dans la récupération
   * musculaire, mais le générateur de séance ne les propose pas comme
   * « exercice » — on ne place pas 20 min de crawl au milieu d'un push.
   *
   * `recuperation` désigne au contraire un travail qui ACCÉLÈRE le retour :
   * il retire un jour de récupération aux zones concernées au lieu d'en
   * ajouter.
   */
  kind?: 'activite' | 'recuperation'
  /**
   * Exercice qui a une VERSION DOUCE : à vide ou très léger, en amplitude
   * complète, sans jamais approcher l'échec. Fait comme ça, il ne fatigue pas —
   * il relance la circulation et rend de l'amplitude —, et il compte alors
   * comme de la récupération, exactement comme un étirement. C'est à la séance
   * qu'on le déclare, exercice par exercice.
   *
   * Ce n'est PAS « on peut mettre moins lourd » : tous les exercices le
   * permettent, et un squat allégé reste un squat. C'est « le geste, à vide,
   * est déjà un exercice de mobilité connu » — un glissé au mur, une rotation
   * externe à l'élastique, une suspension à la barre. Le squat gobelet n'y est
   * donc pas : à vide ce n'est plus le même exercice, c'est le squat profond en
   * tenue, qui a sa propre entrée dans la section récupération.
   */
  adaptable?: true
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // ── Pectoraux ─────────────────────────────────────────────────────────────
  { name: 'Développé couché', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Triceps latéral:0.5, Deltoïde antérieur:0.5, Sous-scapulaire:0.5, Dentelé antérieur:0.4, Petit pectoral:0.4, Triceps longue portion:0.3, Coiffe des rotateurs:0.3', sets: 4, reps: '8' },
  { name: 'Développé couché haltères', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Triceps latéral:0.5, Deltoïde antérieur:0.5, Sous-scapulaire:0.5, Coiffe des rotateurs:0.4, Dentelé antérieur:0.4, Petit pectoral:0.4, Triceps longue portion:0.3', sets: 4, reps: '10', notes: 'Trajectoire libre : plus doux pour l’épaule droite que la barre.' },
  { name: 'Développé incliné barre', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps latéral:0.4, Dentelé antérieur:0.3, Coiffe des rotateurs:0.3, Triceps longue portion:0.3', sets: 4, reps: '10' },
  { name: 'Développé couché incliné haltères', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Grand pectoral:0.6, Sous-scapulaire:0.5, Triceps latéral:0.4, Coiffe des rotateurs:0.4, Dentelé antérieur:0.3, Triceps longue portion:0.3, Petit pectoral:0.3', sets: 3, reps: '12' },
  { name: 'Développé décliné', groups: 'Grand pectoral:1, Triceps latéral:0.6, Dentelé antérieur:0.4, Triceps longue portion:0.4, Pectoral supérieur:0.3, Deltoïde antérieur:0.3, Coiffe des rotateurs:0.3', sets: 3, reps: '10' },
  { name: 'Écarté haltères', groups: 'Grand pectoral:1, Sous-scapulaire:0.6, Pectoral supérieur:0.4, Coiffe des rotateurs:0.4, Petit pectoral:0.4, Deltoïde antérieur:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : ne pas descendre les coudes sous la ligne du buste.' },
  { name: 'Écarté à la poulie', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Petit pectoral:0.4, Deltoïde antérieur:0.3, Coiffe des rotateurs:0.3, Grand droit:0.3, Biceps:0.3, Dentelé antérieur:0.3, Fléchisseurs des doigts:0.3', sets: 3, reps: '15' },
  // Écarté croisé (« cable crossover ») : debout entre deux poulies, on ramène
  // les deux bras devant soi. La hauteur de la poulie change le faisceau visé,
  // et le deltoïde antérieur travaille dur dans les trois — d'où les épaules
  // qui chauffent autant que les pectoraux.
  { name: 'Écarté croisé à la poulie haute', groups: 'Grand pectoral:1, Sous-scapulaire:0.5, Deltoïde antérieur:0.5, Petit pectoral:0.4, Dentelé antérieur:0.4, Pectoral supérieur:0.3, Grand droit:0.3, Obliques:0.3, Coiffe des rotateurs:0.3', sets: 3, reps: '15', notes: 'Poulies en haut, mains ramenées vers le bas et l’avant : cible le faisceau sternal. ⚠️ AC droite : coudes légèrement fléchis, ne pas croiser au-delà du sternum.' },
  { name: 'Écarté croisé à la poulie à hauteur d’épaules', groups: 'Grand pectoral:1, Deltoïde antérieur:0.6, Pectoral supérieur:0.5, Petit pectoral:0.4, Coiffe des rotateurs:0.3, Grand droit:0.3, Biceps:0.3, Dentelé antérieur:0.3, Fléchisseurs des doigts:0.3', sets: 3, reps: '15', notes: 'Poulies à hauteur de poitrine, trajectoire horizontale : la version la plus complète, et la plus exigeante pour l’épaule antérieure.' },
  { name: 'Écarté croisé à la poulie basse', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.7, Grand pectoral:0.6, Coiffe des rotateurs:0.4, Petit pectoral:0.4, Grand droit:0.3, Biceps:0.3, Dentelé antérieur:0.3, Fléchisseurs des doigts:0.3', sets: 3, reps: '15', notes: 'Poulies en bas, mains ramenées vers le haut et l’avant : cible le faisceau claviculaire. ⚠️ AC droite : c’est la variante qui charge le plus l’épaule, monter sans dépasser la ligne des yeux.' },
  { name: 'Écarté à la machine (pec deck)', groups: 'Grand pectoral:1, Sous-scapulaire:0.5, Pectoral supérieur:0.4, Petit pectoral:0.4, Coiffe des rotateurs:0.3, Deltoïde antérieur:0.3', sets: 3, reps: '15' },
  { name: 'Développé pectoraux à la machine', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Triceps latéral:0.5, Deltoïde antérieur:0.4, Triceps longue portion:0.3, Dentelé antérieur:0.3', sets: 3, reps: '12' },
  { name: 'Développé incliné à la machine', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.5, Grand pectoral:0.5, Triceps latéral:0.4, Dentelé antérieur:0.3, Triceps longue portion:0.3, Coiffe des rotateurs:0.3', sets: 4, reps: '12' },
  { name: 'Développé incliné convergent (machine)', groups: 'Pectoral supérieur:1, Grand pectoral:0.6, Deltoïde antérieur:0.5, Triceps latéral:0.4, Sous-scapulaire:0.4, Dentelé antérieur:0.4, Triceps longue portion:0.3, Petit pectoral:0.3', sets: 4, reps: '10' },
  { name: 'Développé incliné convergent (charges libres)', groups: 'Pectoral supérieur:1, Grand pectoral:0.6, Deltoïde antérieur:0.5, Triceps latéral:0.4, Sous-scapulaire:0.4, Dentelé antérieur:0.3, Triceps longue portion:0.3, Petit pectoral:0.3, Coiffe des rotateurs:0.3', sets: 3, reps: '10' },
  { name: 'Pompes', groups: 'Grand pectoral:1, Triceps latéral:0.6, Deltoïde antérieur:0.5, Dentelé antérieur:0.5, Pectoral supérieur:0.4, Grand droit:0.4, Triceps longue portion:0.4, Grand fessier:0.3, Coiffe des rotateurs:0.3', sets: 4, reps: '15' },
  { name: 'Pompes déclinées', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps latéral:0.5, Dentelé antérieur:0.5, Grand droit:0.4, Triceps longue portion:0.3, Coiffe des rotateurs:0.3', sets: 3, reps: '12' },
  { name: 'Dips aux barres parallèles', groups: 'Triceps longue portion:1, Triceps latéral:0.9, Grand pectoral:0.7, Petit pectoral:0.6, Coraco-brachial:0.5, Dentelé antérieur:0.5, Sous-scapulaire:0.4, Deltoïde antérieur:0.4, Trapèze inférieur:0.4, Coiffe des rotateurs:0.4, Pectoral supérieur:0.3, Grand droit:0.3', sets: 3, reps: '10', notes: '⚠️ AC droite : amplitude courte, buste droit.' },
  { name: 'Dips à la machine assistée', groups: 'Triceps longue portion:1, Triceps latéral:0.9, Grand pectoral:0.6, Dentelé antérieur:0.4, Deltoïde antérieur:0.4, Trapèze inférieur:0.3, Pectoral supérieur:0.3, Coiffe des rotateurs:0.3', sets: 3, reps: '10' },
  { name: 'Tirage bras tendus (pull-over)', groups: 'Grand dorsal:1, Grand pectoral:0.7, Grand rond:0.5, Dentelé antérieur:0.4, Triceps longue portion:0.3, Trapèze inférieur:0.3, Grand droit:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12' },

  // ── Dos ───────────────────────────────────────────────────────────────────
  { name: 'Tractions pronation', groups: 'Grand dorsal:1, Grand rond:0.7, Brachial:0.7, Biceps:0.6, Fléchisseurs avant-bras:0.5, Trapèze inférieur:0.5, Fléchisseurs des doigts:0.5, Brachio-radial:0.4, Trapèze moyen:0.4, Rhomboïdes:0.4, Deltoïde postérieur:0.4, Grand droit:0.4', sets: 4, reps: '10' },
  { name: 'Tractions supination', groups: 'Grand dorsal:1, Biceps:0.8, Brachial:0.6, Fléchisseurs des doigts:0.6, Grand rond:0.5, Fléchisseurs avant-bras:0.5, Trapèze inférieur:0.4, Rhomboïdes:0.4, Grand droit:0.4, Trapèze moyen:0.4, Grand pectoral:0.4, Rond pronateur:0.4, Brachio-radial:0.3, Coraco-brachial:0.3, Triceps longue portion:0.3, Obliques:0.3', sets: 4, reps: '10' },
  { name: 'Traction assistée (machine)', groups: 'Grand dorsal:1, Grand rond:0.6, Biceps:0.6, Brachial:0.6, Fléchisseurs des doigts:0.5, Trapèze inférieur:0.5, Brachio-radial:0.4, Fléchisseurs avant-bras:0.4, Trapèze moyen:0.4, Rhomboïdes:0.4, Petit pectoral:0.3, Petit rond:0.3, Deltoïde postérieur:0.3, Grand droit:0.3', sets: 4, reps: '10' },
  { name: 'Tirage vertical prise neutre', groups: 'Grand dorsal:1, Grand rond:0.6, Brachial:0.6, Biceps:0.5, Brachio-radial:0.5, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.4, Rhomboïdes:0.3, Deltoïde postérieur:0.3', sets: 4, reps: '10' },
  { name: 'Tirage vertical devant', groups: 'Grand dorsal:1, Grand rond:0.6, Biceps:0.5, Brachial:0.5, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.4, Rhomboïdes:0.3, Deltoïde postérieur:0.3, Brachio-radial:0.3', sets: 4, reps: '10' },
  { name: 'Tirage buste penché à la barre', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.6, Deltoïde postérieur:0.6, Grand rond:0.5, Biceps:0.5, Brachial:0.5, Érecteurs du rachis:0.5, Fléchisseurs des doigts:0.5, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Multifides:0.4, Grand fessier:0.3, Brachio-radial:0.3, Carré des lombes:0.3', sets: 4, reps: '8' },
  { name: 'Tirage unilatéral à l’haltère', groups: 'Grand dorsal:1, Deltoïde postérieur:0.5, Trapèze moyen:0.5, Grand rond:0.5, Biceps:0.5, Brachial:0.5, Fléchisseurs avant-bras:0.4, Rhomboïdes:0.4, Obliques:0.3, Brachio-radial:0.3', sets: 3, reps: '10' },
  { name: 'Tirage buste appuyé', groups: 'Grand dorsal:1, Deltoïde postérieur:0.6, Trapèze moyen:0.6, Rhomboïdes:0.5, Grand rond:0.5, Biceps:0.4, Brachial:0.4, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.3, Brachio-radial:0.3', sets: 3, reps: '10' },
  // Grand rond : le « petit grand dorsal » de l'aisselle. Bras tendus, les
  // biceps sortent du mouvement et il devient le moteur.
  { name: 'Pull-over à la poulie haute (bras tendus)', groups: 'Grand rond:1, Grand dorsal:0.9, Dentelé antérieur:0.4, Triceps longue portion:0.4, Grand droit:0.3, Trapèze inférieur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12' },
  { name: 'Pull-over haltère au banc', groups: 'Grand rond:1, Grand dorsal:0.8, Dentelé antérieur:0.5, Grand pectoral:0.5, Triceps longue portion:0.4, Grand droit:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : garder les coudes fléchis, ne pas chercher l’amplitude maximale.' },
  { name: 'Tirage assis à la machine', groups: 'Grand dorsal:1, Deltoïde postérieur:0.5, Trapèze moyen:0.5, Rhomboïdes:0.5, Biceps:0.4, Brachial:0.4, Grand rond:0.4, Fléchisseurs avant-bras:0.4, Brachio-radial:0.3', sets: 3, reps: '12' },
  { name: 'Tirage horizontal poulie prise neutre', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.6, Deltoïde postérieur:0.5, Brachio-radial:0.5, Brachial:0.5, Grand rond:0.5, Biceps:0.4, Fléchisseurs avant-bras:0.4, Fléchisseurs des doigts:0.4, Trapèze inférieur:0.4, Érecteurs du rachis:0.3, Coiffe des rotateurs:0.3', sets: 3, reps: '12' },
  { name: 'Soulevé de terre', groups: 'Biceps fémoral:1, Grand fessier:1, Ischios internes:0.9, Érecteurs du rachis:0.8, Grand dorsal:0.6, Multifides:0.6, Transverse:0.6, Trapèze supérieur:0.5, Fléchisseurs avant-bras:0.5, Fléchisseurs des doigts:0.5, Adducteurs:0.5, Vaste latéral:0.5, Vaste médial:0.5, Carré des lombes:0.5, Trapèze moyen:0.4, Rhomboïdes:0.4, Grand droit:0.4, Obliques:0.4, Droit fémoral:0.3, Cou:0.3, Grand rond:0.3, Soléaire:0.3', sets: 4, reps: '8' },
  { name: 'Soulevé de terre roumain (RDL)', groups: 'Biceps fémoral:1, Ischios internes:0.9, Grand fessier:0.8, Érecteurs du rachis:0.6, Adducteurs:0.5, Grand dorsal:0.4, Fléchisseurs avant-bras:0.4, Trapèze moyen:0.4, Trapèze supérieur:0.4, Gastrocnémiens:0.3', sets: 3, reps: '10' },
  { name: 'Haussements d’épaules aux haltères', groups: 'Trapèze supérieur:1, Élévateur de la scapula:0.7, Trapèze moyen:0.5, Cou:0.4, Fléchisseurs avant-bras:0.4, Rhomboïdes:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '15' },
  { name: 'Tirage visage à la poulie haute', groups: 'Deltoïde postérieur:1, Trapèze moyen:0.6, Coiffe des rotateurs:0.6, Rhomboïdes:0.5, Trapèze inférieur:0.4, Trapèze supérieur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '15', adaptable: true },
  { name: 'Extensions du buste (banc lombaire)', groups: 'Érecteurs du rachis:1, Grand fessier:0.8, Biceps fémoral:0.7, Ischios internes:0.6, Multifides:0.6, Adducteurs:0.5, Carré des lombes:0.5, Trapèze moyen:0.3', sets: 3, reps: '12' },
  { name: 'Suspension à la barre', groups: 'Fléchisseurs des doigts:1, Fléchisseurs avant-bras:0.9, Grand dorsal:0.5, Extenseurs avant-bras:0.5, Brachio-radial:0.5, Deltoïde postérieur:0.3, Grand rond:0.3, Trapèze inférieur:0.3', sets: 3, reps: '30 s', adaptable: true },

  // ── Épaules ───────────────────────────────────────────────────────────────
  { name: 'Développé militaire barre', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.7, Triceps latéral:0.6, Supra-épineux:0.5, Dentelé antérieur:0.5, Érecteurs du rachis:0.5, Triceps longue portion:0.5, Coraco-brachial:0.4, Coiffe des rotateurs:0.4, Trapèze inférieur:0.4, Trapèze supérieur:0.4, Grand droit:0.3, Grand fessier:0.3', sets: 4, reps: '8', notes: '⚠️ AC droite : la barre force la rotation interne — préférer les haltères.' },
  { name: 'Développé militaire haltères prise neutre', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps latéral:0.5, Coiffe des rotateurs:0.5, Dentelé antérieur:0.5, Supra-épineux:0.5, Triceps longue portion:0.4, Trapèze inférieur:0.4, Trapèze supérieur:0.4, Érecteurs du rachis:0.4, Grand droit:0.3', sets: 3, reps: '10' },
  { name: 'Développé épaules convergent (machine)', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps latéral:0.5, Supra-épineux:0.5, Dentelé antérieur:0.4, Triceps longue portion:0.4, Trapèze supérieur:0.3, Coiffe des rotateurs:0.3, Trapèze inférieur:0.3', sets: 3, reps: '10' },
  { name: 'Développé avec impulsion, haltères prise neutre', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps latéral:0.5, Triceps longue portion:0.4, Vaste latéral:0.4, Grand droit:0.4, Dentelé antérieur:0.4, Trapèze supérieur:0.4, Vaste médial:0.4, Grand fessier:0.3, Coiffe des rotateurs:0.3, Gastrocnémiens:0.3, Droit fémoral:0.3', sets: 3, reps: '8' },
  { name: 'Élévations latérales haltères', groups: 'Deltoïde latéral:1, Supra-épineux:0.6, Coiffe des rotateurs:0.4, Trapèze supérieur:0.3, Trapèze moyen:0.3, Trapèze inférieur:0.3, Dentelé antérieur:0.3, Deltoïde antérieur:0.3, Deltoïde postérieur:0.3', sets: 4, reps: '15' },
  { name: 'Élévations latérales poulie', groups: 'Deltoïde latéral:1, Supra-épineux:0.6, Coiffe des rotateurs:0.4, Trapèze supérieur:0.3, Trapèze inférieur:0.3, Dentelé antérieur:0.3', sets: 3, reps: '15' },
  { name: 'Élévations frontales', groups: 'Deltoïde antérieur:1, Coraco-brachial:0.5, Pectoral supérieur:0.3, Coiffe des rotateurs:0.3, Trapèze supérieur:0.3, Dentelé antérieur:0.3, Grand droit:0.3', sets: 3, reps: '12' },
  { name: 'Oiseau haltères (buste penché)', groups: 'Deltoïde postérieur:1, Trapèze moyen:0.5, Coiffe des rotateurs:0.5, Rhomboïdes:0.4, Trapèze inférieur:0.4, Érecteurs du rachis:0.4, Biceps fémoral:0.3, Ischios internes:0.3', sets: 3, reps: '15' },
  { name: 'Écarté inversé à la machine', groups: 'Deltoïde postérieur:1, Trapèze moyen:0.5, Coiffe des rotateurs:0.5, Rhomboïdes:0.4, Petit rond:0.4, Trapèze inférieur:0.3, Élévateur de la scapula:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '15' },
  // Rhomboïdes en moteur : les tirages les emmènent en passant, mais aucun ne
  // les isolait. La rétraction pure, sans flexion de coude, c'est eux seuls.
  { name: 'Rétraction scapulaire à la poulie', groups: 'Rhomboïdes:1, Trapèze moyen:1, Élévateur de la scapula:0.5, Trapèze inférieur:0.4, Deltoïde postérieur:0.4, Fléchisseurs des doigts:0.4, Trapèze supérieur:0.3, Érecteurs du rachis:0.3, Grand dorsal:0.3', sets: 3, reps: '15', notes: 'Bras tendus : on ne tire QUE les omoplates l’une vers l’autre, 2 s de tenue.', adaptable: true },
  { name: 'Rowing prise large coudes hauts', groups: 'Rhomboïdes:1, Trapèze moyen:0.9, Deltoïde postérieur:0.7, Grand dorsal:0.5, Biceps:0.4, Brachial:0.4, Trapèze inférieur:0.4, Coiffe des rotateurs:0.4, Grand rond:0.4, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12' },
  // Dentelé antérieur : il plaque l'omoplate contre les côtes. Faible, l'omoplate
  // décolle et l'épaule perd sa base — critique avec une AC abîmée.
  { name: 'Pompe scapulaire (protraction)', groups: 'Dentelé antérieur:1, Petit pectoral:0.6, Trapèze inférieur:0.4, Grand droit:0.4, Grand pectoral:0.3, Deltoïde antérieur:0.3, Triceps latéral:0.3, Triceps longue portion:0.3', sets: 3, reps: '15', notes: 'En planche, coudes verrouillés : on ne bouge que les omoplates.', adaptable: true },
  { name: 'Poussée dentelé à la poulie (serratus punch)', groups: 'Dentelé antérieur:1, Petit pectoral:0.5, Deltoïde antérieur:0.4, Grand pectoral:0.3, Trapèze inférieur:0.3, Obliques:0.3', sets: 3, reps: '15/bras' },
  { name: 'Rotation externe d’épaule (poulie ou élastique)', groups: 'Coiffe des rotateurs:1, Petit rond:0.9, Supra-épineux:0.5, Deltoïde postérieur:0.4, Trapèze moyen:0.3, Trapèze inférieur:0.3', sets: 2, reps: '15/bras', adaptable: true },
  // Bras à 90° d'abduction : la position d'armé, celle où l'épaule est la plus
  // exposée sous le heaume. C'est là que la coiffe doit tenir.
  // Petit rond à 1 et non 0,9 : bras à 90° d'abduction, c'est LUI le rotateur
  // externe dominant, devant l'infra-épineux qui mène à 0° (Reinold et coll.).
  // C'était le seul exercice du catalogue où il pouvait l'être, et il ne l'était
  // pas — donc aucun n'en faisait sa cible.
  { name: 'Rotation externe à 90° d’abduction (poulie)', groups: 'Coiffe des rotateurs:1, Petit rond:1, Supra-épineux:0.6, Deltoïde postérieur:0.5, Trapèze moyen:0.3, Trapèze inférieur:0.3, Deltoïde latéral:0.3', sets: 3, reps: '12/bras', notes: '⚠️ AC droite : charge légère, amplitude contrôlée, jamais à l’échec.', adaptable: true },
  // Trapèze inférieur : le grand oublié. C'est lui qui fait glisser l'omoplate
  // vers le bas quand le bras monte ; faible, l'épaule remonte et pince.
  // ⚠️ Épaule AC : c'est le muscle le plus rentable à renforcer.
  { name: 'Y couché au banc incliné', groups: 'Trapèze inférieur:1, Trapèze moyen:0.6, Deltoïde postérieur:0.5, Supra-épineux:0.5, Coiffe des rotateurs:0.4, Rhomboïdes:0.4, Dentelé antérieur:0.4, Érecteurs du rachis:0.3, Petit rond:0.3', sets: 3, reps: '15', notes: 'Buste sur un banc incliné, bras tendus en Y, pouces vers le plafond. Charge très légère : 2 à 5 kg suffisent.', adaptable: true },
  { name: 'Haussements d’épaules bras au-dessus de la tête', groups: 'Trapèze inférieur:1, Trapèze supérieur:0.5, Dentelé antérieur:0.5, Deltoïde antérieur:0.4, Trapèze moyen:0.4, Coiffe des rotateurs:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12', notes: 'Bras tendus au-dessus de la tête, on pousse vers le plafond sans plier les coudes. Cible la partie basse du trapèze.' },
  { name: 'Glissé au mur (wall slide)', groups: 'Trapèze inférieur:1, Dentelé antérieur:0.6, Trapèze moyen:0.6, Deltoïde postérieur:0.4, Coiffe des rotateurs:0.4, Trapèze supérieur:0.3', sets: 3, reps: '10', notes: 'Avant-bras au mur, on monte sans décoller. Excellent échauffement d’épaule avant toute poussée.', adaptable: true },

  // ── Bras ──────────────────────────────────────────────────────────────────
  { name: 'Curl haltères', groups: 'Biceps:1, Brachial:0.6, Brachio-radial:0.5, Rond pronateur:0.5, Fléchisseurs avant-bras:0.4, Deltoïde antérieur:0.3, Grand droit:0.3', sets: 3, reps: '12' },
  { name: 'Curl haltères marteau', groups: 'Brachial:1, Brachio-radial:1, Biceps:0.7, Fléchisseurs avant-bras:0.5, Rond pronateur:0.4, Extenseurs avant-bras:0.3, Deltoïde antérieur:0.3', sets: 3, reps: '12' },
  { name: 'Curl barre EZ', groups: 'Biceps:1, Brachial:0.6, Brachio-radial:0.5, Fléchisseurs avant-bras:0.4, Rond pronateur:0.4, Deltoïde antérieur:0.3, Grand droit:0.3', sets: 3, reps: '10' },
  { name: 'Curl au pupitre', groups: 'Biceps:1, Brachial:0.7, Coraco-brachial:0.5, Brachio-radial:0.4, Rond pronateur:0.4, Fléchisseurs avant-bras:0.3, Deltoïde antérieur:0.3', sets: 3, reps: '12' },
  { name: 'Curl poulie basse', groups: 'Biceps:1, Brachial:0.5, Brachio-radial:0.4, Rond pronateur:0.4, Fléchisseurs avant-bras:0.3, Grand droit:0.3', sets: 3, reps: '15' },
  // « Avant-bras » couvre les DEUX faces (fléchisseurs, extenseurs, brachio-radial).
  // Utilisé pour une prise, il déclarait donc fatigués des extenseurs qui n'avaient
  // fait que stabiliser — et sur un curl inversé, l'inverse : c'est justement la
  // face des extenseurs qui travaille. Ces entrées nomment maintenant la bonne.
  { name: 'Curl inversé (prise pronation)', groups: 'Brachio-radial:1, Extenseurs avant-bras:0.8, Brachial:0.7, Rond pronateur:0.6, Biceps:0.5, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (corde)', groups: 'Triceps latéral:1, Triceps longue portion:0.7, Extenseurs avant-bras:0.3, Fléchisseurs des doigts:0.3, Grand droit:0.3, Deltoïde postérieur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (barre droite)', groups: 'Triceps latéral:1, Triceps longue portion:0.6, Extenseurs avant-bras:0.3, Fléchisseurs des doigts:0.3, Grand droit:0.3, Deltoïde postérieur:0.3, Fléchisseurs avant-bras:0.3', sets: 4, reps: '12' },
  { name: 'Extensions triceps au-dessus de la tête (poulie)', groups: 'Triceps longue portion:1, Triceps latéral:0.5, Grand droit:0.4, Coiffe des rotateurs:0.3, Extenseurs avant-bras:0.3, Fléchisseurs des doigts:0.3, Dentelé antérieur:0.3, Obliques:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '12' },
  { name: 'Barre au front', groups: 'Triceps longue portion:1, Triceps latéral:0.8, Fléchisseurs des doigts:0.4, Fléchisseurs avant-bras:0.3, Deltoïde antérieur:0.3, Extenseurs avant-bras:0.3, Grand droit:0.3', sets: 3, reps: '12' },
  { name: 'Extension triceps buste penché', groups: 'Triceps latéral:1, Triceps longue portion:0.5, Fléchisseurs des doigts:0.3, Deltoïde postérieur:0.3, Érecteurs du rachis:0.3, Biceps fémoral:0.3, Grand fessier:0.3, Multifides:0.3', sets: 3, reps: '15' },
  { name: 'Flexions de poignets', groups: 'Fléchisseurs avant-bras:1, Fléchisseurs des doigts:0.7, Rond pronateur:0.4, Brachio-radial:0.3, Extenseurs avant-bras:0.3', sets: 3, reps: '20', adaptable: true },

  // ── Jambes ────────────────────────────────────────────────────────────────
  { name: 'Squat barre arrière', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Adducteurs:0.6, Droit fémoral:0.6, Érecteurs du rachis:0.5, Rotateurs de hanche:0.5, Biceps fémoral:0.4, Grand droit:0.4, Moyen fessier:0.4, Soléaire:0.4, Obliques:0.4, Multifides:0.4, Ischios internes:0.4, Gracile:0.3, Trapèze moyen:0.3', sets: 4, reps: '8' },
  { name: 'Squat à la barre guidée', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.7, Droit fémoral:0.6, Adducteurs:0.5, Biceps fémoral:0.3, Ischios internes:0.3, Érecteurs du rachis:0.3, Grand droit:0.3, Soléaire:0.3', sets: 4, reps: '8' },
  { name: 'Squat sur box (ou squat gobelet)', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Droit fémoral:0.6, Adducteurs:0.5, Biceps fémoral:0.4, Grand droit:0.4, Érecteurs du rachis:0.4, Ischios internes:0.4, Moyen fessier:0.3', sets: 3, reps: '10' },
  { name: 'Squat gobelet en tempo', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.6, Droit fémoral:0.6, Adducteurs:0.5, Grand droit:0.4, Érecteurs du rachis:0.4, Deltoïde antérieur:0.3, Soléaire:0.3', sets: 3, reps: '10' },
  { name: 'Squat barre devant', groups: 'Droit fémoral:1, Vaste latéral:0.8, Vaste médial:0.8, Érecteurs du rachis:0.6, Grand droit:0.5, Grand fessier:0.5, Adducteurs:0.5, Trapèze supérieur:0.4, Deltoïde antérieur:0.4, Soléaire:0.3', sets: 3, reps: '8' },
  { name: 'Presse à cuisses pieds hauts', groups: 'Grand fessier:1, Biceps fémoral:0.7, Ischios internes:0.6, Adducteurs:0.6, Vaste latéral:0.6, Vaste médial:0.5, Droit fémoral:0.3, Soléaire:0.3', sets: 3, reps: '12' },
  { name: 'Presse à cuisses (pieds standard)', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.7, Grand fessier:0.5, Adducteurs:0.5, Soléaire:0.3', sets: 4, reps: '12' },
  { name: 'Fentes marchées haltères', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Droit fémoral:0.6, Moyen fessier:0.5, Adducteurs:0.5, Fléchisseurs des doigts:0.4, Biceps fémoral:0.4, Fléchisseurs avant-bras:0.4, Soléaire:0.4, Obliques:0.4, Ischios internes:0.4, Gastrocnémiens:0.4, Érecteurs du rachis:0.4, Tenseur du fascia lata:0.4, Trapèze supérieur:0.3, Tibial antérieur:0.3, Rotateurs de hanche:0.3, Gracile:0.3', sets: 3, reps: '12/jambe' },
  { name: 'Fentes bulgares', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.9, Droit fémoral:0.6, Moyen fessier:0.5, Adducteurs:0.5, Rotateurs de hanche:0.5, Biceps fémoral:0.4, Obliques:0.4, Ischios internes:0.4, Gracile:0.3, Soléaire:0.3', sets: 3, reps: '10/jambe' },
  { name: 'Montée sur banc', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Droit fémoral:0.6, Moyen fessier:0.4, Adducteurs:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Soléaire:0.3, Obliques:0.3', sets: 3, reps: '12/jambe' },
  { name: 'Extension des jambes à la machine', groups: 'Droit fémoral:1, Vaste latéral:0.8, Vaste médial:0.8, Tenseur du fascia lata:0.4, Tibial antérieur:0.3, Grand droit:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '15' },
  { name: 'Flexion des ischios allongé (machine)', groups: 'Biceps fémoral:1, Ischios internes:0.9, Gracile:0.4, Gastrocnémiens:0.3, Soléaire:0.3', sets: 3, reps: '12' },
  { name: 'Flexion du buste barre au dos', groups: 'Biceps fémoral:1, Ischios internes:0.9, Érecteurs du rachis:0.8, Grand fessier:0.6, Adducteurs:0.5, Grand droit:0.4, Grand dorsal:0.3, Trapèze supérieur:0.3', sets: 3, reps: '10' },
  { name: 'Poussée de hanches (barre ou machine)', groups: 'Grand fessier:1, Adducteurs:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Vaste latéral:0.4, Vaste médial:0.4, Grand droit:0.4, Droit fémoral:0.3', sets: 4, reps: '12' },
  { name: 'Abducteurs (machine)', groups: 'Moyen fessier:1, Tenseur du fascia lata:0.6, Rotateurs de hanche:0.5, Grand fessier:0.3, Obliques:0.3, Carré des lombes:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '15' },
  { name: 'Adducteurs (machine)', groups: 'Adducteurs:1, Gracile:0.7, Ischios internes:0.4, Rotateurs de hanche:0.3, Grand droit:0.3, Psoas-iliaque:0.3, Obliques:0.3', sets: 3, reps: '15' },
  { name: 'Mollets debout (machine)', groups: 'Gastrocnémiens:1, Tibial postérieur:0.6, Soléaire:0.5, Fibulaires:0.4, Érecteurs du rachis:0.3, Grand droit:0.3', sets: 4, reps: '20' },
  { name: 'Mollets assis (machine)', groups: 'Soléaire:1, Tibial postérieur:0.5, Gastrocnémiens:0.4, Fibulaires:0.3', sets: 4, reps: '20' },
  { name: 'Mollets à la presse', groups: 'Gastrocnémiens:1, Soléaire:0.6, Tibial postérieur:0.6, Fibulaires:0.4, Droit fémoral:0.3, Vaste latéral:0.3', sets: 4, reps: '15' },
  { name: 'Extension terminale du genou (élastique)', groups: 'Vaste médial:1, Vaste latéral:0.4, Droit fémoral:0.4, Tenseur du fascia lata:0.3, Grand fessier:0.3, Soléaire:0.3', sets: 3, reps: '15', adaptable: true },

  // ── Core ──────────────────────────────────────────────────────────────────
  { name: 'Deadbug (gainage bras-jambes alternés)', groups: 'Grand droit:1, Transverse:0.8, Psoas-iliaque:0.5, Obliques:0.5, Multifides:0.4, Carré des lombes:0.4, Dentelé antérieur:0.3, Deltoïde antérieur:0.3', sets: 3, reps: '10', adaptable: true },
  { name: 'Planche frontale', groups: 'Grand droit:1, Transverse:0.7, Obliques:0.5, Dentelé antérieur:0.4, Grand fessier:0.4, Deltoïde antérieur:0.3, Trapèze inférieur:0.3, Vaste latéral:0.3, Vaste médial:0.3, Droit fémoral:0.3', sets: 3, reps: '45 s' },
  // « Abdos/Core » recouvrait les obliques déjà déclarées à 1, et « Épaules »
  // allumait le deltoïde POSTÉRIEUR, qui ne fait rien ici. Ce que la planche
  // latérale tient vraiment sous le bassin, c'est le moyen fessier du dessus.
  { name: 'Planche latérale', groups: 'Obliques:1, Carré des lombes:0.7, Moyen fessier:0.6, Transverse:0.6, Dentelé antérieur:0.5, Grand droit:0.5, Deltoïde latéral:0.4, Tenseur du fascia lata:0.4, Coiffe des rotateurs:0.3, Adducteurs:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '45 s/côté' },
  { name: 'Bird-dog (gainage croisé)', groups: 'Multifides:1, Grand droit:0.8, Érecteurs du rachis:0.8, Transverse:0.7, Obliques:0.5, Grand fessier:0.5, Carré des lombes:0.5, Moyen fessier:0.4, Deltoïde postérieur:0.3', sets: 3, reps: '8/côté', adaptable: true },
  { name: 'Crunch à la machine', groups: 'Grand droit:1, Obliques:0.4, Cou:0.3, Psoas-iliaque:0.3, Fléchisseurs des doigts:0.3, Fléchisseurs avant-bras:0.3, Droit fémoral:0.3', sets: 3, reps: '15' },
  { name: 'Relevés de genoux suspendu', groups: 'Grand droit:1, Psoas-iliaque:0.8, Obliques:0.5, Fléchisseurs avant-bras:0.5, Droit fémoral:0.4, Grand dorsal:0.4, Adducteurs:0.3, Brachio-radial:0.3', sets: 3, reps: '15' },
  { name: 'Roulette abdominale', groups: 'Grand droit:1, Transverse:0.7, Obliques:0.5, Dentelé antérieur:0.5, Grand dorsal:0.4, Grand fessier:0.3, Deltoïde antérieur:0.3, Triceps longue portion:0.3, Grand rond:0.3', sets: 3, reps: '10' },
  { name: 'Anti-rotation à la poulie (Pallof)', groups: 'Obliques:1, Transverse:0.8, Multifides:0.8, Grand droit:0.7, Moyen fessier:0.4, Deltoïde antérieur:0.4, Grand fessier:0.3, Rotateurs de hanche:0.3', sets: 3, reps: '12/côté' },
  { name: 'Rotation du buste à la machine', groups: 'Obliques:1, Multifides:0.6, Grand droit:0.5, Transverse:0.5, Érecteurs du rachis:0.4, Carré des lombes:0.4, Psoas-iliaque:0.3, Grand dorsal:0.3, Rotateurs de hanche:0.3', sets: 3, reps: '12/côté' },
  { name: 'Rotations russes', groups: 'Obliques:1, Grand droit:0.7, Multifides:0.5, Transverse:0.5, Psoas-iliaque:0.4, Carré des lombes:0.4, Fléchisseurs des doigts:0.4, Droit fémoral:0.4, Deltoïde antérieur:0.3, Érecteurs du rachis:0.3, Adducteurs:0.3', sets: 3, reps: '20/côté' },
  { name: 'Grimpeurs au sol', groups: 'Grand droit:1, Psoas-iliaque:0.7, Obliques:0.6, Cardio:0.6, Deltoïde antérieur:0.4, Dentelé antérieur:0.4, Vaste latéral:0.4, Triceps latéral:0.4, Droit fémoral:0.3, Triceps longue portion:0.3, Vaste médial:0.3, Grand pectoral:0.3', sets: 3, reps: '30 s' },

  // ── Fonctionnel / béhourd ────────────────────────────────────────────────
  { name: 'Extensions cervicales (élastique)', groups: 'Extenseurs du cou:1, Trapèze supérieur:0.5, Élévateur de la scapula:0.4, Multifides:0.4, Érecteurs du rachis:0.3, Rhomboïdes:0.3', sets: 3, reps: '15', notes: 'Amplitude contrôlée, sans à-coup. Renforce la nuque — prévention commotion sous heaume.', adaptable: true },
  { name: 'Pont cervical (front bridge)', groups: 'Extenseurs du cou:1, Cou:0.7, Scalènes:0.6, Multifides:0.5, Érecteurs du rachis:0.5, Trapèze supérieur:0.4, Élévateur de la scapula:0.4, Grand fessier:0.3, Grand droit:0.3, Biceps fémoral:0.3', sets: 3, reps: '30 s', notes: 'Isométrique doux, appui sur un tapis. Progresser très lentement en durée.' },
  { name: 'Flexions latérales de nuque', groups: 'Élévateur de la scapula:1, Scalènes:0.9, Cou:0.8, Extenseurs du cou:0.6, Trapèze supérieur:0.5, Carré des lombes:0.3', sets: 3, reps: '12/côté', notes: 'Résistance manuelle légère. Essentiel pour encaisser les frappes latérales.', adaptable: true },
  // Les portages sont les exercices les mieux documentés en EMG du catalogue, et
  // c'étaient les moins bien étiquetés : il leur manquait les DEUX muscles qui
  // font le mouvement. Les érecteurs (thoraciques et lombaires) tirent leur pic
  // d'activation pendant la phase oscillante — le côté opposé rigidifie le tronc
  // à chaque pas —, et le moyen fessier empêche le bassin de tomber, au point que
  // le portage est cité comme l'un des meilleurs exercices pour lui.
  // https://www.nsca.com/education/articles/nsca-coach/increase-hip-and-trunk-stability-with-loaded-carries/
  { name: 'Marche du fermier', groups: 'Fléchisseurs des doigts:1, Fléchisseurs avant-bras:0.9, Trapèze supérieur:0.8, Carré des lombes:0.7, Obliques:0.6, Érecteurs du rachis:0.6, Moyen fessier:0.6, Grand droit:0.5, Extenseurs avant-bras:0.5, Élévateur de la scapula:0.5, Transverse:0.5, Vaste latéral:0.4, Vaste médial:0.4, Cou:0.4, Brachio-radial:0.4, Trapèze moyen:0.4, Soléaire:0.4, Multifides:0.4, Grand fessier:0.4, Gastrocnémiens:0.3, Droit fémoral:0.3, Adducteurs:0.3', sets: 4, reps: '30 m' },
  // Charge d'un seul côté : c'est la version où le moyen fessier et les obliques
  // encaissent le plus, puisque rien ne contrebalance de l'autre main.
  { name: 'Port valise (haltère à une main)', groups: 'Obliques:1, Carré des lombes:0.9, Fléchisseurs des doigts:0.9, Grand droit:0.8, Fléchisseurs avant-bras:0.8, Moyen fessier:0.7, Scalènes:0.5, Trapèze supérieur:0.5, Érecteurs du rachis:0.5, Extenseurs avant-bras:0.4, Brachio-radial:0.4, Tenseur du fascia lata:0.4, Élévateur de la scapula:0.4, Cou:0.3, Adducteurs:0.3', sets: 3, reps: '30 m/côté' },
  { name: 'Balancier à la kettlebell', groups: 'Grand fessier:1, Biceps fémoral:0.8, Ischios internes:0.7, Fléchisseurs des doigts:0.5, Érecteurs du rachis:0.5, Grand droit:0.5, Adducteurs:0.5, Grand dorsal:0.5, Moyen fessier:0.4, Multifides:0.4, Transverse:0.4, Fléchisseurs avant-bras:0.4, Trapèze supérieur:0.4, Obliques:0.4, Vaste latéral:0.4, Vaste médial:0.4, Carré des lombes:0.3, Deltoïde postérieur:0.3, Soléaire:0.3', sets: 4, reps: '15' },
  { name: 'Relevé turc', groups: 'Grand droit:1, Obliques:0.8, Deltoïde antérieur:0.8, Coiffe des rotateurs:0.6, Deltoïde latéral:0.5, Trapèze inférieur:0.5, Dentelé antérieur:0.5, Grand fessier:0.5, Fléchisseurs avant-bras:0.5, Triceps latéral:0.5, Vaste latéral:0.4, Vaste médial:0.4, Triceps longue portion:0.3, Adducteurs:0.3, Droit fémoral:0.3', sets: 3, reps: '5/côté' },
  { name: 'Burpees', groups: 'Cardio:1, Vaste latéral:1, Droit fémoral:0.8, Vaste médial:0.8, Grand pectoral:0.5, Triceps latéral:0.5, Grand droit:0.5, Grand fessier:0.5, Psoas-iliaque:0.5, Gastrocnémiens:0.5, Deltoïde antérieur:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Triceps longue portion:0.3, Dentelé antérieur:0.3, Érecteurs du rachis:0.3', sets: 4, reps: '10' },
  { name: 'Sauts sur box', groups: 'Vaste latéral:1, Droit fémoral:0.8, Vaste médial:0.8, Gastrocnémiens:0.7, Grand fessier:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Soléaire:0.4, Tibial antérieur:0.4, Adducteurs:0.3, Grand droit:0.3', sets: 3, reps: '10' },
  { name: 'Lancer de ballon lesté', groups: 'Grand droit:1, Obliques:0.7, Grand dorsal:0.6, Deltoïde antérieur:0.6, Cardio:0.6, Triceps latéral:0.5, Dentelé antérieur:0.4, Grand fessier:0.4, Vaste latéral:0.4, Vaste médial:0.4, Triceps longue portion:0.3, Droit fémoral:0.3', sets: 4, reps: '12' },
  { name: 'Traîneau poussé', groups: 'Vaste latéral:1, Grand fessier:0.8, Vaste médial:0.8, Droit fémoral:0.7, Cardio:0.7, Biceps fémoral:0.6, Gastrocnémiens:0.6, Soléaire:0.5, Deltoïde antérieur:0.5, Ischios internes:0.5, Grand pectoral:0.4, Dentelé antérieur:0.4, Grand droit:0.4, Adducteurs:0.4, Érecteurs du rachis:0.4, Triceps latéral:0.4, Fléchisseurs des doigts:0.4, Tibial antérieur:0.3, Triceps longue portion:0.3', sets: 4, reps: '20 m' },
  { name: 'Cordes ondulatoires ou rameur en sprint', groups: 'Deltoïde antérieur:1, Cardio:0.8, Deltoïde latéral:0.6, Grand droit:0.5, Fléchisseurs avant-bras:0.5, Trapèze supérieur:0.5, Obliques:0.5, Vaste latéral:0.4, Grand dorsal:0.4, Droit fémoral:0.3, Vaste médial:0.3, Deltoïde postérieur:0.3', sets: 4, reps: '30 s' },

  // ── Natation ──────────────────────────────────────────────────────────────
  { name: 'Crawl (nage libre)', groups: 'Grand dorsal:1, Grand pectoral:0.8, Cardio:0.8, Obliques:0.7, Triceps latéral:0.6, Grand rond:0.5, Deltoïde postérieur:0.5, Deltoïde latéral:0.5, Coiffe des rotateurs:0.5, Dentelé antérieur:0.4, Droit fémoral:0.4, Trapèze moyen:0.4, Trapèze inférieur:0.4, Grand fessier:0.4, Triceps longue portion:0.4, Rhomboïdes:0.3, Fléchisseurs avant-bras:0.3', sets: 1, reps: '20 min', notes: 'Dos + épaules + gainage. Roulis des épaules, respiration 3 temps.', kind: 'activite' },
  { name: 'Brasse', groups: 'Adducteurs:1, Grand pectoral:0.9, Cardio:0.8, Droit fémoral:0.8, Vaste latéral:0.7, Grand fessier:0.7, Vaste médial:0.6, Gracile:0.6, Grand dorsal:0.6, Rotateurs de hanche:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Obliques:0.5, Deltoïde antérieur:0.5, Grand rond:0.4, Rhomboïdes:0.4, Trapèze moyen:0.4, Triceps latéral:0.4, Grand droit:0.4, Gastrocnémiens:0.4, Érecteurs du rachis:0.4, Triceps longue portion:0.3, Coiffe des rotateurs:0.3, Moyen fessier:0.3, Tibial antérieur:0.3', sets: 1, reps: '20 min', notes: 'Pectoraux + adducteurs. Mouvement symétrique : doux pour l’épaule droite.', kind: 'activite' },
  { name: 'Dos crawlé', groups: 'Grand dorsal:1, Deltoïde postérieur:0.7, Cardio:0.7, Grand rond:0.6, Triceps latéral:0.6, Obliques:0.5, Trapèze moyen:0.5, Coiffe des rotateurs:0.5, Dentelé antérieur:0.4, Droit fémoral:0.4, Grand fessier:0.4, Grand droit:0.4, Triceps longue portion:0.4', sets: 1, reps: '15 min', notes: 'Ouvre la cage thoracique — excellent contre l’épaule tombante.', kind: 'activite' },
  { name: 'Papillon', groups: 'Grand pectoral:1, Grand dorsal:1, Cardio:0.8, Deltoïde antérieur:0.7, Érecteurs du rachis:0.7, Grand droit:0.7, Triceps latéral:0.6, Dentelé antérieur:0.5, Coiffe des rotateurs:0.5, Trapèze moyen:0.5, Grand fessier:0.5, Droit fémoral:0.5, Vaste latéral:0.4, Biceps fémoral:0.4, Triceps longue portion:0.4, Ischios internes:0.4, Vaste médial:0.3', sets: 1, reps: '10 min', notes: '⚠️ AC droite : très exigeant pour l’épaule, à écarter à la moindre douleur.', kind: 'activite' },
  { name: 'Jambes avec planche (natation)', groups: 'Droit fémoral:1, Psoas-iliaque:0.7, Grand fessier:0.7, Biceps fémoral:0.5, Gastrocnémiens:0.5, Grand droit:0.5, Ischios internes:0.5, Vaste latéral:0.4, Érecteurs du rachis:0.4, Adducteurs:0.3, Deltoïde antérieur:0.3', sets: 4, reps: '50 m', notes: 'Quadriceps + fessiers sans aucun impact — idéal rotules.', kind: 'activite' },
  { name: 'Nage bras seuls (pull buoy)', groups: 'Grand dorsal:1, Grand pectoral:0.7, Triceps latéral:0.6, Grand rond:0.5, Deltoïde postérieur:0.5, Coiffe des rotateurs:0.5, Trapèze moyen:0.4, Dentelé antérieur:0.4, Obliques:0.4, Triceps longue portion:0.4, Fléchisseurs avant-bras:0.3', sets: 4, reps: '50 m', notes: 'Isole le haut du corps, jambes au repos.', kind: 'activite' },
  { name: 'Nage avec plaquettes', groups: 'Grand dorsal:1, Grand pectoral:0.8, Deltoïde latéral:0.8, Deltoïde postérieur:0.7, Coiffe des rotateurs:0.7, Triceps latéral:0.6, Grand rond:0.5, Trapèze moyen:0.4, Fléchisseurs avant-bras:0.4, Dentelé antérieur:0.4, Triceps longue portion:0.4', sets: 4, reps: '50 m', notes: '⚠️ AC droite : augmente nettement la charge sur l’épaule, à doser.', kind: 'activite' },
  { name: 'Nage en eau libre', groups: 'Grand dorsal:1, Cardio:0.9, Grand pectoral:0.7, Obliques:0.6, Deltoïde postérieur:0.6, Coiffe des rotateurs:0.5, Triceps latéral:0.5, Cou:0.4, Trapèze moyen:0.4, Triceps longue portion:0.3, Grand fessier:0.3', sets: 1, reps: '30 min', notes: 'Endurance + thermorégulation. Repères visuels réguliers.', kind: 'activite' },
  { name: 'Aquagym / marche aquatique', groups: 'Cardio:1, Droit fémoral:0.5, Vaste latéral:0.4, Grand fessier:0.4, Deltoïde latéral:0.4, Vaste médial:0.3, Grand droit:0.3, Adducteurs:0.3, Moyen fessier:0.3', sets: 1, reps: '30 min', notes: 'Récupération active sans impact.', kind: 'activite' },

  { name: 'Jambes de brasse (planche)', groups: 'Adducteurs:1, Droit fémoral:0.8, Grand fessier:0.7, Rotateurs de hanche:0.7, Vaste latéral:0.6, Gracile:0.6, Vaste médial:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Moyen fessier:0.4, Gastrocnémiens:0.4, Psoas-iliaque:0.4, Tibial antérieur:0.3', sets: 4, reps: '50 m', notes: 'Le fouet de jambes fournit l’essentiel de la propulsion en brasse. ⚠️ Rotules : amplitude modérée, sans forcer la rotation du genou.', kind: 'activite' },
  { name: 'Ondulations dauphin (dolphin kick)', groups: 'Grand droit:1, Érecteurs du rachis:0.8, Grand fessier:0.6, Droit fémoral:0.5, Obliques:0.5, Psoas-iliaque:0.5, Vaste latéral:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Vaste médial:0.3', sets: 4, reps: '25 m', notes: 'Ondulation initiée par le bassin, jamais par les genoux. Excellent gainage profond.', kind: 'activite' },
  { name: 'Crawl en sprint (25-50 m)', groups: 'Grand dorsal:1, Cardio:1, Grand pectoral:0.8, Triceps latéral:0.7, Obliques:0.6, Deltoïde latéral:0.5, Grand rond:0.5, Coiffe des rotateurs:0.5, Deltoïde postérieur:0.5, Triceps longue portion:0.5, Grand fessier:0.4, Vaste latéral:0.4, Droit fémoral:0.3, Vaste médial:0.3', sets: 8, reps: '25 m', notes: 'Effort maximal court, récupération complète entre les longueurs. ⚠️ AC droite : réduire la fréquence si l’épaule chauffe.', kind: 'activite' },
  { name: 'Nage indienne (récupération)', groups: 'Grand dorsal:0.6, Adducteurs:0.5, Cardio:0.5, Obliques:0.4, Deltoïde postérieur:0.4, Coiffe des rotateurs:0.3', sets: 1, reps: '10 min', notes: 'Nage sur le côté, très souple — récupération active entre les séries.', kind: 'activite' },
  // ── Course ────────────────────────────────────────────────────────────────
  { name: 'Course à pied — endurance (zone 2)', groups: 'Cardio:1, Gastrocnémiens:1, Soléaire:0.8, Vaste latéral:0.7, Biceps fémoral:0.7, Ischios internes:0.6, Droit fémoral:0.6, Vaste médial:0.6, Grand fessier:0.5, Moyen fessier:0.4, Psoas-iliaque:0.4, Tibial antérieur:0.4, Adducteurs:0.4, Fibulaires:0.3, Érecteurs du rachis:0.3', sets: 1, reps: '30 min', notes: 'Allure conversation. Charge = ton poids de corps à chaque foulée.', kind: 'activite' },
  { name: 'Fractionné 30/30', groups: 'Cardio:1, Gastrocnémiens:0.8, Vaste latéral:0.7, Grand fessier:0.6, Biceps fémoral:0.6, Droit fémoral:0.6, Vaste médial:0.6, Ischios internes:0.5, Soléaire:0.5, Psoas-iliaque:0.5, Tibial antérieur:0.4, Adducteurs:0.3, Moyen fessier:0.3', sets: 10, reps: '30 s', notes: 'Cardio anaérobie — proche de l’effort d’un round de béhourd.', kind: 'activite' },
  { name: 'Sprints en côte', groups: 'Vaste latéral:1, Grand fessier:0.9, Droit fémoral:0.8, Vaste médial:0.8, Gastrocnémiens:0.8, Cardio:0.8, Psoas-iliaque:0.7, Biceps fémoral:0.6, Soléaire:0.6, Ischios internes:0.5, Érecteurs du rachis:0.4, Adducteurs:0.4, Tibial antérieur:0.4, Moyen fessier:0.4', sets: 8, reps: '20 s', notes: 'Puissance jambes avec moins d’impact rotulien qu’à plat.', kind: 'activite' },
  { name: 'Course en sentier', groups: 'Vaste latéral:1, Droit fémoral:0.8, Vaste médial:0.8, Gastrocnémiens:0.8, Cardio:0.8, Tibial postérieur:0.7, Fibulaires:0.6, Biceps fémoral:0.6, Grand fessier:0.6, Soléaire:0.6, Ischios internes:0.5, Tibial antérieur:0.5, Moyen fessier:0.5, Psoas-iliaque:0.4, Adducteurs:0.3, Érecteurs du rachis:0.3', sets: 1, reps: '45 min', notes: '⚠️ Rotules : la descente est très excentrique — raccourcir la foulée.', kind: 'activite' },
  { name: 'Marche rapide / randonnée', groups: 'Cardio:0.6, Soléaire:0.6, Gastrocnémiens:0.5, Vaste latéral:0.5, Droit fémoral:0.4, Vaste médial:0.4, Grand fessier:0.4, Tibial antérieur:0.4, Biceps fémoral:0.3, Moyen fessier:0.3, Ischios internes:0.3', sets: 1, reps: '60 min', notes: 'Zone 2 sans impact. Parfait en récupération.', kind: 'activite' },
  { name: 'Randonnée avec sac lesté', groups: 'Cardio:0.7, Vaste latéral:0.7, Grand fessier:0.7, Tibial postérieur:0.7, Trapèze supérieur:0.6, Soléaire:0.6, Gastrocnémiens:0.6, Droit fémoral:0.6, Vaste médial:0.6, Érecteurs du rachis:0.5, Grand droit:0.5, Biceps fémoral:0.5, Moyen fessier:0.5, Carré des lombes:0.5, Ischios internes:0.5, Multifides:0.4, Élévateur de la scapula:0.4, Tibial antérieur:0.4, Adducteurs:0.3', sets: 1, reps: '45 min', notes: 'Simule le port du harnois. Sac 10-15 kg, dos droit, ceinture serrée.', kind: 'activite' },
  { name: 'Corde à sauter', groups: 'Gastrocnémiens:1, Cardio:0.8, Soléaire:0.6, Vaste latéral:0.5, Droit fémoral:0.4, Vaste médial:0.4, Tibial antérieur:0.4, Fibulaires:0.4, Fléchisseurs avant-bras:0.3, Moyen fessier:0.3', sets: 5, reps: '2 min', notes: '⚠️ Rotules : réception amortie sur l’avant du pied.', kind: 'activite' },
  { name: 'Sprint / pliométrie sur herbe', groups: 'Biceps fémoral:1, Vaste latéral:1, Ischios internes:0.9, Droit fémoral:0.8, Vaste médial:0.8, Gastrocnémiens:0.8, Grand fessier:0.7, Soléaire:0.6, Psoas-iliaque:0.6, Adducteurs:0.5, Érecteurs du rachis:0.4, Moyen fessier:0.4, Tibial antérieur:0.3', sets: 6, reps: '30 m', notes: 'Sol souple = impact rotulien réduit. Au poids du corps.', kind: 'activite' },

  // ── Bois & extérieur ─────────────────────────────────────────────────────
  { name: 'Fendre du bois (hache)', groups: 'Obliques:0.9, Grand dorsal:0.8, Grand droit:0.8, Deltoïde antérieur:0.7, Fléchisseurs avant-bras:0.7, Grand fessier:0.6, Érecteurs du rachis:0.5, Triceps latéral:0.5, Trapèze supérieur:0.5, Vaste latéral:0.5, Vaste médial:0.5, Grand rond:0.4, Brachio-radial:0.4, Triceps longue portion:0.3, Droit fémoral:0.3', sets: 4, reps: '20 coups', notes: 'Chaîne postérieure + core + grip — le geste le plus proche du béhourd. Jambes fléchies, rotation contrôlée, alterner les côtés.', kind: 'activite' },
  { name: 'Sciage manuel (bûche)', groups: 'Grand dorsal:1, Fléchisseurs avant-bras:0.8, Biceps:0.6, Deltoïde postérieur:0.5, Triceps latéral:0.5, Obliques:0.5, Brachial:0.5, Trapèze moyen:0.4, Grand pectoral:0.4, Rhomboïdes:0.4, Brachio-radial:0.4, Triceps longue portion:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '5 min', notes: 'Tirage horizontal + endurance de préhension. Alterner les bras.', kind: 'activite' },
  { name: 'Portage de bûches', groups: 'Fléchisseurs des doigts:1, Fléchisseurs avant-bras:0.9, Trapèze supérieur:0.8, Grand droit:0.7, Carré des lombes:0.6, Obliques:0.6, Érecteurs du rachis:0.6, Vaste latéral:0.5, Moyen fessier:0.5, Biceps:0.5, Vaste médial:0.5, Élévateur de la scapula:0.4, Brachial:0.4, Soléaire:0.4, Brachio-radial:0.4, Droit fémoral:0.3, Cou:0.3, Adducteurs:0.3', sets: 4, reps: '50 m', notes: 'Farmer’s walk naturel : charge près du corps, dos droit, gainage.', kind: 'activite' },
  { name: 'Empilage / rangement de bois', groups: 'Érecteurs du rachis:0.6, Vaste latéral:0.6, Grand fessier:0.6, Vaste médial:0.5, Grand droit:0.5, Fléchisseurs avant-bras:0.5, Obliques:0.5, Deltoïde antérieur:0.4, Trapèze supérieur:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Droit fémoral:0.4, Grand dorsal:0.3', sets: 1, reps: '20 min', notes: 'Squats et hinges répétés. Plier les jambes, jamais le dos (antéversion).', kind: 'activite' },
  { name: 'Débitage / tronçonnage', groups: 'Fléchisseurs avant-bras:0.8, Deltoïde antérieur:0.6, Grand droit:0.6, Érecteurs du rachis:0.5, Obliques:0.5, Trapèze supérieur:0.4, Trapèze moyen:0.4, Biceps:0.4, Vaste latéral:0.4, Brachio-radial:0.4, Vaste médial:0.4, Droit fémoral:0.3', sets: 1, reps: '30 min', notes: 'Port de charge + gainage prolongé. Pauses régulières.', kind: 'activite' },
  { name: 'Débroussaillage / élagage', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.7, Fléchisseurs avant-bras:0.7, Obliques:0.6, Grand droit:0.5, Érecteurs du rachis:0.5, Trapèze supérieur:0.4, Brachio-radial:0.4, Trapèze moyen:0.3, Grand dorsal:0.3', sets: 1, reps: '30 min', notes: '⚠️ AC droite : bras en l’air prolongé — alterner les côtés souvent.', kind: 'activite' },
  { name: 'Vélo / VTT', groups: 'Vaste latéral:1, Cardio:0.9, Droit fémoral:0.8, Vaste médial:0.8, Grand fessier:0.6, Gastrocnémiens:0.5, Biceps fémoral:0.5, Ischios internes:0.5, Soléaire:0.4, Érecteurs du rachis:0.4, Tibial antérieur:0.3, Trapèze supérieur:0.3', sets: 1, reps: '45 min', notes: 'Sans impact — le meilleur cardio pour des rotules sensibles.', kind: 'activite' },
  { name: 'Kayak / aviron sur l’eau', groups: 'Grand dorsal:1, Grand droit:0.7, Deltoïde postérieur:0.7, Cardio:0.7, Obliques:0.6, Biceps:0.6, Trapèze moyen:0.5, Brachial:0.5, Fléchisseurs avant-bras:0.5, Érecteurs du rachis:0.5, Rhomboïdes:0.4, Grand rond:0.4', sets: 1, reps: '40 min', notes: 'Tirage + rotation du tronc, gainage constant.', kind: 'activite' },
  { name: 'Escalade / bloc', groups: 'Fléchisseurs des doigts:1, Grand dorsal:1, Fléchisseurs avant-bras:0.9, Biceps:0.7, Grand droit:0.6, Brachio-radial:0.6, Brachial:0.5, Grand rond:0.5, Obliques:0.5, Vaste latéral:0.5, Extenseurs avant-bras:0.5, Vaste médial:0.5, Deltoïde postérieur:0.4, Trapèze inférieur:0.4, Adducteurs:0.4, Droit fémoral:0.3', sets: 1, reps: '60 min', notes: 'Grip + dos + biceps, au poids du corps. ⚠️ AC droite : éviter les grands jetés.', kind: 'activite' },
  { name: 'Jardinage (bêchage)', groups: 'Érecteurs du rachis:0.7, Grand dorsal:0.6, Grand fessier:0.6, Obliques:0.5, Fléchisseurs avant-bras:0.5, Deltoïde antérieur:0.5, Vaste latéral:0.5, Vaste médial:0.5, Grand droit:0.4, Biceps:0.4, Trapèze supérieur:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Droit fémoral:0.3', sets: 1, reps: '45 min', notes: 'Hinge répété sous charge légère. Dos droit, fessiers serrés.', kind: 'activite' },
  // ── 🪢 Slackline ───────────────────────────────────────────────────────────
  //
  // Cinq entrées plutôt qu'une : sur une sangle, l'appui statique sur une jambe
  // et le rebond à deux pieds ne chargent pas les mêmes muscles, et les fondre
  // en une ligne moyenne fait mentir le mannequin dans les deux cas.
  //
  // Ce que la littérature soutient, et sur quoi reposent les coefficients :
  //
  //  · les stabilisateurs LATÉRAUX de la cheville mènent. Le fibulaire (long
  //    péronier) est ce qui freine l'inversion de l'arrière-pied, et les
  //    premiers essais sur sangle se soldent par une oscillation latérale
  //    incontrôlée de la jambe d'appui — c'est exactement ce qu'il retient.
  //    Le tibial postérieur tient l'arche interne en regard ;
  //  · le SOLÉAIRE est au cœur de la boucle. Keller et coll. (Scand J Med Sci
  //    Sports, 2012) montrent qu'après dix séances le réflexe H du soléaire
  //    DIMINUE : le contrôle quitte la boucle réflexe spinale pour passer au
  //    niveau supraspinal. Le muscle travaille, mais l'adaptation n'est pas de
  //    la force, c'est du pilotage ;
  //  · le QUADRICEPS est plus impliqué qu'il n'y paraît. Pfusterschmied et
  //    coll. (J Sci Med Sport, 2013) trouvent, après quatre semaines, une
  //    activation accrue du droit fémoral en phase PRÉPARATOIRE et une
  //    tendance à la co-activation droit fémoral / biceps fémoral, avec une
  //    correction articulaire réduite au genou. Leur conclusion porte sur la
  //    stabilité fonctionnelle du genou. Gabel et coll. (J Sci Med Sport, 2015)
  //    classent d'ailleurs la montée sur sangle parmi les exercices de
  //    rééducation du genou, en chaîne « composite » ;
  //  · la chaîne LATÉRALE du tronc encaisse le reste. Les pratiquants réguliers
  //    tiennent 45 % plus longtemps en planche et 36 % de plus en gainage
  //    latéral que des sédentaires (Retos, 2021), avec une corrélation entre
  //    les années de pratique et l'endurance des fléchisseurs et des latéraux
  //    du tronc. D'où obliques et carré des lombes hauts, et le grand droit
  //    plus bas : sur une sangle on résiste à l'inclinaison, on ne fléchit pas.
  //
  // Ce que la littérature ne soutient PAS, et qu'il ne faut donc pas croire :
  // le transfert. La méta-analyse de Donath et coll. (Sports Med, 2017) et les
  // trois mois de Ringhof et Stein (PLOS One, 2018) disent la même chose — les
  // progrès sont énormes SUR LA SANGLE et ne se retrouvent presque pas sur une
  // tâche d'équilibre non entraînée. C'est une compétence à part entière, pas
  // un multiplicateur d'équilibre général.
  //
  // Les coefficients servent aussi à estimer la FATIGUE, et là il faut rester
  // mesuré : stabiliser à vide n'est pas un soulevé de terre. Tagués à 1, les
  // érecteurs coûtaient plus de récupération après une slackline qu'après
  // 150 kg au sol, et deux séances par semaine suffisaient à ne plus jamais
  // les voir verts. Ils plafonnent donc à 0,7, quoi que fasse la sangle.
  { name: 'Slackline (travail d’équilibre)', groups: 'Fibulaires:1, Tibial postérieur:0.9, Moyen fessier:0.8, Soléaire:0.8, Tibial antérieur:0.7, Obliques:0.7, Vaste médial:0.6, Droit fémoral:0.6, Vaste latéral:0.6, Multifides:0.6, Carré des lombes:0.6, Rotateurs de hanche:0.5, Érecteurs du rachis:0.5, Transverse:0.5, Tenseur du fascia lata:0.5, Psoas-iliaque:0.5, Grand fessier:0.4, Grand droit:0.4, Gastrocnémiens:0.4, Adducteurs:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Deltoïde latéral:0.4, Deltoïde antérieur:0.3, Gracile:0.3', sets: 4, reps: '5 min', notes: 'Séance libre, mélangée : c’est la moyenne des variantes. Si tu sais ce que tu as fait, prends l’entrée précise — statique, marche, surf ou longline ne chargent pas les mêmes muscles. ⚠️ AC droite : les bras restent en l’air tout le temps de l’exercice, et une chute se rattrape sur la main tendue. Sangle basse, zone de réception dégagée.', kind: 'activite' },
  { name: 'Slackline — appui statique sur une jambe', groups: 'Fibulaires:1, Tibial postérieur:0.9, Moyen fessier:0.9, Soléaire:0.8, Tibial antérieur:0.7, Obliques:0.7, Carré des lombes:0.7, Rotateurs de hanche:0.6, Vaste médial:0.6, Multifides:0.6, Vaste latéral:0.5, Droit fémoral:0.5, Tenseur du fascia lata:0.5, Érecteurs du rachis:0.5, Transverse:0.5, Grand droit:0.4, Grand fessier:0.4, Adducteurs:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Gastrocnémiens:0.4, Deltoïde latéral:0.4, Psoas-iliaque:0.3, Gracile:0.3, Deltoïde antérieur:0.3', sets: 5, reps: '30 s/jambe', notes: 'La variante la plus exigeante pour le plan frontal : pas de propulsion, que de la stabilisation, donc le temps sous tension maximal pour les fibulaires et le moyen fessier. C’est aussi celle qui parle le plus à tes rotules — appui fermé, genou légèrement fléchi, vaste médial en co-contraction continue. Chronomètre chaque jambe : l’écart entre les deux est l’information, pas le total.', kind: 'activite' },
  { name: 'Slackline — marche aller-retour', groups: 'Fibulaires:1, Tibial postérieur:0.9, Moyen fessier:0.8, Soléaire:0.8, Tibial antérieur:0.7, Droit fémoral:0.7, Vaste médial:0.7, Vaste latéral:0.7, Obliques:0.6, Multifides:0.6, Carré des lombes:0.6, Psoas-iliaque:0.6, Rotateurs de hanche:0.5, Érecteurs du rachis:0.5, Grand fessier:0.5, Transverse:0.5, Tenseur du fascia lata:0.5, Gastrocnémiens:0.5, Grand droit:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Adducteurs:0.4, Deltoïde latéral:0.4, Deltoïde antérieur:0.3, Gracile:0.3', sets: 6, reps: '1 traversée', notes: 'Appui unipodal alterné avec propulsion : le droit fémoral et le psoas montent par rapport au statique, la stabilisation par jambe baisse d’autant. Regard au bout de la sangle, jamais sur les pieds. Compte en traversées réussies, pas en minutes.', kind: 'activite' },
  { name: 'Slackline — surf (rebond sur les deux pieds)', groups: 'Vaste latéral:1, Vaste médial:1, Fibulaires:0.9, Droit fémoral:0.8, Soléaire:0.8, Gastrocnémiens:0.8, Tibial postérieur:0.8, Grand fessier:0.7, Moyen fessier:0.6, Tibial antérieur:0.6, Obliques:0.6, Biceps fémoral:0.6, Ischios internes:0.6, Grand droit:0.5, Érecteurs du rachis:0.5, Multifides:0.5, Transverse:0.5, Carré des lombes:0.4, Adducteurs:0.4, Rotateurs de hanche:0.4, Tenseur du fascia lata:0.4, Psoas-iliaque:0.3, Deltoïde latéral:0.3', sets: 4, reps: '45 s', notes: 'La seule variante où le quadriceps mène : le rebond est un cycle flexion-extension de genou sous charge élastique, avec réception excentrique à chaque oscillation. ⚠️ Dysplasie rotulienne : c’est aussi la seule qui charge vraiment le fémoro-patellaire. Amplitude courte, jamais dans la douleur, et on arrête dès que le genou part en dedans.', kind: 'activite' },
  { name: 'Slackline — longline (20 m et plus)', groups: 'Fibulaires:1, Tibial postérieur:0.9, Obliques:0.8, Moyen fessier:0.8, Soléaire:0.8, Carré des lombes:0.8, Multifides:0.7, Érecteurs du rachis:0.7, Tibial antérieur:0.7, Transverse:0.6, Droit fémoral:0.6, Vaste médial:0.6, Vaste latéral:0.6, Grand droit:0.6, Rotateurs de hanche:0.6, Psoas-iliaque:0.5, Tenseur du fascia lata:0.5, Grand fessier:0.5, Gastrocnémiens:0.5, Deltoïde latéral:0.5, Adducteurs:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Deltoïde antérieur:0.4, Trapèze supérieur:0.3, Gracile:0.3', sets: 3, reps: '10 min', notes: 'Sangle longue : oscillation plus ample et plus lente, efforts bien plus longs. Le tronc encaisse davantage que sur une courte — c’est l’endurance des obliques et du carré des lombes qui limite avant les chevilles. À 102 kg la sangle descend bas au milieu : vérifie la tension et la hauteur avant de monter.', kind: 'activite' },
  { name: 'Étirement fléchisseurs de hanche (fente basse)', groups: 'Psoas-iliaque:1, Droit fémoral:0.6, Adducteurs:0.4, Grand fessier:0.4, Grand droit:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Bassin en rétroversion, on pousse la hanche vers l’avant. Indispensable avec l’antéversion du bassin.' },
  // ── ⚔️ Béhourd ────────────────────────────────────────────────────────────
  // Discipline de combat en armure : le cou encaisse les frappes sous heaume,
  // les trapèzes et les érecteurs portent les 33 kg d'acier, la préhension
  // tient l'arme et le bouclier, et la rotation du buste porte les frappes.
  { name: 'Béhourd — entraînement technique (sans armure)', groups: 'Deltoïde antérieur:0.8, Obliques:0.8, Fléchisseurs avant-bras:0.7, Cardio:0.7, Grand dorsal:0.6, Triceps latéral:0.6, Grand droit:0.6, Vaste latéral:0.5, Trapèze supérieur:0.5, Droit fémoral:0.4, Vaste médial:0.4, Coiffe des rotateurs:0.4, Deltoïde latéral:0.4, Grand fessier:0.4, Cou:0.4, Brachio-radial:0.4, Triceps longue portion:0.4', sets: 1, reps: '60 min', notes: 'Frappes à vide, footwork, drills à deux. ⚠️ AC droite : alterner les côtés, éviter les enchaînements prolongés bras haut.', kind: 'activite' },
  { name: 'Béhourd — port du harnois (endurance armure)', groups: 'Trapèze supérieur:1, Érecteurs du rachis:0.9, Extenseurs du cou:0.9, Vaste latéral:0.8, Cou:0.8, Multifides:0.7, Élévateur de la scapula:0.7, Grand fessier:0.7, Soléaire:0.7, Cardio:0.7, Tibial postérieur:0.7, Droit fémoral:0.7, Vaste médial:0.6, Grand droit:0.6, Scalènes:0.6, Carré des lombes:0.5, Trapèze moyen:0.5, Obliques:0.5, Gastrocnémiens:0.5, Moyen fessier:0.4, Rhomboïdes:0.4, Deltoïde antérieur:0.4, Biceps fémoral:0.4, Ischios internes:0.4', sets: 1, reps: '30 min', notes: 'Simple déplacement en armure complète pour habituer le corps aux 33 kg. Le point de départ avant tout sparring.', kind: 'activite' },
  { name: 'Béhourd — garde au bouclier (isométrie)', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.8, Trapèze supérieur:0.7, Fléchisseurs avant-bras:0.7, Fléchisseurs des doigts:0.7, Coiffe des rotateurs:0.6, Sous-scapulaire:0.6, Supra-épineux:0.5, Biceps:0.5, Brachial:0.5, Grand droit:0.4, Trapèze moyen:0.4, Brachio-radial:0.4, Cou:0.4, Élévateur de la scapula:0.4, Obliques:0.4, Dentelé antérieur:0.3', sets: 4, reps: '60 s', notes: 'Maintien de la garde haute — c’est ce qui lâche en premier en fin de round. ⚠️ AC droite : alterner, ne pas dépasser 60 s côté droit.', kind: 'activite' },
  { name: 'Béhourd — frappes sur pneu ou sac', groups: 'Obliques:1, Deltoïde antérieur:0.8, Fléchisseurs avant-bras:0.8, Grand dorsal:0.7, Triceps latéral:0.6, Grand droit:0.6, Grand fessier:0.5, Trapèze supérieur:0.5, Coiffe des rotateurs:0.5, Vaste latéral:0.5, Droit fémoral:0.4, Vaste médial:0.4, Brachio-radial:0.4, Érecteurs du rachis:0.4, Dentelé antérieur:0.4, Cou:0.4, Triceps longue portion:0.4', sets: 5, reps: '2 min', notes: 'Rotation initiée par les hanches, jamais par les bras seuls. ⚠️ AC droite : limiter les frappes au-dessus de la ligne d’épaule.', kind: 'activite' },
  { name: 'Béhourd — duel 1 contre 1', groups: 'Obliques:0.9, Cardio:0.9, Deltoïde antérieur:0.8, Fléchisseurs avant-bras:0.8, Extenseurs du cou:0.8, Cou:0.7, Vaste latéral:0.7, Trapèze supérieur:0.7, Grand dorsal:0.6, Triceps latéral:0.6, Grand droit:0.6, Érecteurs du rachis:0.6, Droit fémoral:0.6, Vaste médial:0.6, Élévateur de la scapula:0.5, Grand fessier:0.5, Coiffe des rotateurs:0.5, Carré des lombes:0.4, Soléaire:0.4, Brachio-radial:0.4, Triceps longue portion:0.4', sets: 6, reps: '2 min', notes: 'Plus technique que la mêlée : footwork, timing, garde. Forte sollicitation en rotation du buste.', kind: 'activite' },
  { name: 'Béhourd — mêlée (combat de masse)', groups: 'Cardio:1, Extenseurs du cou:1, Cou:1, Trapèze supérieur:0.9, Deltoïde antérieur:0.8, Fléchisseurs avant-bras:0.8, Érecteurs du rachis:0.8, Vaste latéral:0.8, Fléchisseurs des doigts:0.8, Obliques:0.7, Grand fessier:0.7, Élévateur de la scapula:0.7, Scalènes:0.7, Droit fémoral:0.7, Vaste médial:0.6, Multifides:0.6, Grand dorsal:0.6, Grand droit:0.6, Carré des lombes:0.6, Rotateurs de hanche:0.5, Trapèze moyen:0.5, Coiffe des rotateurs:0.5, Soléaire:0.5, Adducteurs:0.4, Brachio-radial:0.4, Biceps fémoral:0.4, Ischios internes:0.4', sets: 5, reps: '3 min', notes: 'Rounds à intensité maximale : poussées, corps à corps, frappes. Le facteur limitant est le cardio anaérobie, pas la force.', kind: 'activite' },
  { name: 'Béhourd — corps à corps (lutte en armure)', groups: 'Fléchisseurs des doigts:1, Fléchisseurs avant-bras:0.9, Grand dorsal:0.9, Érecteurs du rachis:0.8, Extenseurs du cou:0.8, Cou:0.8, Vaste latéral:0.8, Trapèze supérieur:0.7, Grand fessier:0.7, Obliques:0.7, Droit fémoral:0.7, Vaste médial:0.6, Sous-scapulaire:0.6, Grand droit:0.6, Biceps:0.6, Carré des lombes:0.5, Adducteurs:0.5, Trapèze moyen:0.5, Brachial:0.5, Brachio-radial:0.5, Biceps fémoral:0.5, Élévateur de la scapula:0.5, Ischios internes:0.5, Deltoïde postérieur:0.4', sets: 5, reps: '90 s', notes: 'Poussées, projections, contrôle au sol. Très demandeur en préhension et en chaîne postérieure.', kind: 'activite' },
  { name: 'Béhourd — sparring en armure', groups: 'Cardio:1, Extenseurs du cou:0.9, Cou:0.9, Trapèze supérieur:0.9, Fléchisseurs avant-bras:0.9, Deltoïde antérieur:0.8, Érecteurs du rachis:0.8, Obliques:0.8, Vaste latéral:0.8, Grand fessier:0.7, Droit fémoral:0.7, Vaste médial:0.6, Élévateur de la scapula:0.6, Gastrocnémiens:0.6, Grand dorsal:0.6, Grand droit:0.6, Carré des lombes:0.5, Coiffe des rotateurs:0.5, Trapèze moyen:0.5, Soléaire:0.5, Brachio-radial:0.4, Adducteurs:0.4, Biceps fémoral:0.4, Ischios internes:0.4', sets: 1, reps: '90 min', notes: '33 kg d’acier + gambeson. Hydratation 1 L/h. Séance la plus exigeante de la semaine : compter 48 h de récupération avant du lourd en jambes.', kind: 'activite' },

  // ── Boxe pieds-poings ─────────────────────────────────────────────────────
  //
  // Deux entrées et non une : la technique du lundi et le conditionnement du
  // vendredi n'ont ni la même intensité ni les mêmes muscles moteurs. Les
  // confondre aurait fait passer une séance de récupération active pour un
  // travail lactique, et le mannequin serait resté rouge deux jours pour rien.
  { name: 'Kickboxing — technique et déplacements', groups: 'Cardio:0.6, Deltoïde antérieur:0.6, Obliques:0.6, Gastrocnémiens:0.5, Soléaire:0.5, Psoas-iliaque:0.5, Extenseurs du cou:0.5, Grand droit:0.4, Vaste latéral:0.4, Triceps latéral:0.4, Fibulaires:0.4, Cou:0.4, Grand fessier:0.4, Biceps fémoral:0.4, Grand pectoral:0.4, Trapèze supérieur:0.4, Ischios internes:0.4, Droit fémoral:0.3, Vaste médial:0.3, Carré des lombes:0.3, Adducteurs:0.3, Tibial antérieur:0.3, Triceps longue portion:0.3', sets: 1, reps: '60 min', notes: 'Shadow, pattes d’ours, déplacements. Impact articulaire faible : c’est une récupération active après le béhourd, pas une séance dure. ⚠️ AC droite : garde haute prolongée à surveiller.', kind: 'activite' },
  { name: 'Cardioboxing — intervalles', groups: 'Cardio:1, Deltoïde antérieur:0.8, Obliques:0.8, Grand droit:0.6, Gastrocnémiens:0.6, Vaste latéral:0.5, Triceps latéral:0.5, Psoas-iliaque:0.5, Grand pectoral:0.5, Droit fémoral:0.4, Vaste médial:0.4, Grand dorsal:0.4, Trapèze supérieur:0.4, Grand fessier:0.4, Soléaire:0.4, Triceps longue portion:0.3, Coiffe des rotateurs:0.3', sets: 8, reps: '2 min', notes: 'Rounds à haute intensité, récupération courte. C’est ici que se travaille le souffle sous visière — masque respiratoire possible, jamais sur du lourd. Ôter le masque dès que la technique se dégrade.', kind: 'activite' },

  // Sangle cervicale : la charge est libre et progressive, contrairement à
  // l'élastique qui plafonne vite. C'est l'outil du protocole tank — et le plus
  // risqué du lot, d'où la consigne d'amplitude en toutes lettres.
  { name: 'Sangle cervicale (neck harness) — flexion/extension', groups: 'Extenseurs du cou:1, Cou:1, Scalènes:0.6, Trapèze supérieur:0.5, Élévateur de la scapula:0.5, Érecteurs du rachis:0.4, Trapèze moyen:0.3', sets: 3, reps: '12', notes: '⚠️ Le muscle qui ne pardonne pas l’ego : montée en charge par très petites marches, amplitude contrôlée, JAMAIS à l’échec ni en à-coup. Commencer sans charge pendant deux semaines. En cas d’antécédent cervical, faire valider les mouvements avant de charger.' },

  // ── Compléments : machines Basic Fit et variantes courantes ───────────────
  { name: 'Développé couché prise serrée', groups: 'Triceps latéral:1, Triceps longue portion:0.8, Grand pectoral:0.6, Pectoral supérieur:0.4, Deltoïde antérieur:0.4, Dentelé antérieur:0.3, Coiffe des rotateurs:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '10', notes: 'Mains à largeur d’épaules, coudes le long du corps.' },
  { name: 'Écarté incliné haltères', groups: 'Pectoral supérieur:1, Grand pectoral:0.6, Deltoïde antérieur:0.4, Coiffe des rotateurs:0.4, Petit pectoral:0.4, Biceps:0.3, Dentelé antérieur:0.3, Fléchisseurs des doigts:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : amplitude limitée, coudes jamais sous la ligne du buste.' },
  { name: 'Tirage T-bar', groups: 'Grand dorsal:1, Trapèze moyen:0.7, Deltoïde postérieur:0.6, Rhomboïdes:0.6, Grand rond:0.5, Biceps:0.5, Brachial:0.5, Érecteurs du rachis:0.4, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Brachio-radial:0.3', sets: 4, reps: '10' },
  { name: 'Tirage menton (rowing vertical)', groups: 'Deltoïde latéral:1, Trapèze supérieur:0.8, Supra-épineux:0.5, Coiffe des rotateurs:0.4, Biceps:0.4, Brachial:0.4, Deltoïde antérieur:0.4, Élévateur de la scapula:0.4, Trapèze moyen:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : à éviter — forte rotation interne. Ne monter que sous la ligne des épaules.' },
  { name: 'Rameur (cardio)', groups: 'Grand dorsal:1, Cardio:0.9, Vaste latéral:0.7, Trapèze moyen:0.6, Droit fémoral:0.6, Vaste médial:0.6, Biceps:0.5, Érecteurs du rachis:0.5, Deltoïde postérieur:0.5, Grand fessier:0.5, Rhomboïdes:0.4, Brachial:0.4, Fléchisseurs avant-bras:0.4, Biceps fémoral:0.4, Grand droit:0.4, Ischios internes:0.4, Soléaire:0.3', sets: 1, reps: '15 min', notes: 'Séquence jambes → buste → bras. Dos neutre.', kind: 'activite' },
  { name: 'Vélo / Assault bike', groups: 'Cardio:1, Vaste latéral:0.8, Droit fémoral:0.7, Vaste médial:0.6, Grand fessier:0.5, Deltoïde antérieur:0.4, Grand dorsal:0.4, Triceps latéral:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Grand droit:0.3, Gastrocnémiens:0.3, Triceps longue portion:0.3', sets: 1, reps: '15 min', notes: 'Sans impact — parfait échauffement genoux.', kind: 'activite' },
  { name: 'Marche inclinée (tapis)', groups: 'Cardio:0.7, Grand fessier:0.6, Soléaire:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Vaste latéral:0.4, Gastrocnémiens:0.4, Droit fémoral:0.3, Vaste médial:0.3, Tibial antérieur:0.3, Moyen fessier:0.3', sets: 1, reps: '20 min', notes: 'Pente 8-12 %, sans se tenir aux poignées.', kind: 'activite' },
  { name: 'Escalier (Stairmaster)', groups: 'Vaste latéral:1, Grand fessier:0.8, Cardio:0.8, Vaste médial:0.8, Droit fémoral:0.7, Psoas-iliaque:0.6, Gastrocnémiens:0.6, Soléaire:0.5, Moyen fessier:0.5, Biceps fémoral:0.4, Ischios internes:0.4, Adducteurs:0.3, Tibial antérieur:0.3, Érecteurs du rachis:0.3, Tenseur du fascia lata:0.3', sets: 1, reps: '15 min', notes: '⚠️ Rotules : rythme modéré, poser tout le pied.', kind: 'activite' },
  { name: 'Squat à la machine (hack squat)', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.7, Grand fessier:0.5, Adducteurs:0.5, Biceps fémoral:0.3, Ischios internes:0.3, Grand droit:0.3, Soléaire:0.3', sets: 3, reps: '12', notes: 'Dos plaqué, genoux jamais verrouillés.' },
  { name: 'Soulevé de terre sumo', groups: 'Grand fessier:1, Adducteurs:0.9, Vaste latéral:0.8, Vaste médial:0.8, Érecteurs du rachis:0.7, Rotateurs de hanche:0.6, Ischios internes:0.6, Biceps fémoral:0.5, Gracile:0.5, Trapèze supérieur:0.5, Moyen fessier:0.5, Grand dorsal:0.5, Multifides:0.5, Droit fémoral:0.5, Fléchisseurs des doigts:0.5, Fléchisseurs avant-bras:0.4, Trapèze moyen:0.4, Tenseur du fascia lata:0.4, Carré des lombes:0.4, Transverse:0.4, Grand droit:0.4, Obliques:0.3', sets: 4, reps: '6', notes: 'Prise étroite, pieds larges : moins de flexion lombaire que le conventionnel.' },
  { name: 'Soulevé de terre trap bar', groups: 'Vaste latéral:1, Vaste médial:1, Grand fessier:1, Biceps fémoral:0.7, Ischios internes:0.6, Droit fémoral:0.6, Trapèze supérieur:0.6, Érecteurs du rachis:0.6, Fléchisseurs des doigts:0.6, Fléchisseurs avant-bras:0.5, Adducteurs:0.5, Grand dorsal:0.5, Multifides:0.5, Trapèze moyen:0.4, Carré des lombes:0.4, Transverse:0.4, Moyen fessier:0.4, Grand droit:0.4, Soléaire:0.3, Obliques:0.3, Rhomboïdes:0.3', sets: 4, reps: '8', notes: 'Barre hexagonale : dos plus vertical, excellent compromis pour les lombaires.' },
  { name: 'Fentes inversées', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Droit fémoral:0.6, Moyen fessier:0.5, Adducteurs:0.5, Biceps fémoral:0.4, Ischios internes:0.4, Soléaire:0.3, Obliques:0.3', sets: 3, reps: '10/jambe', notes: '⚠️ Rotules : moins de cisaillement que la fente avant.' },
  { name: 'Mollets unilatéraux', groups: 'Gastrocnémiens:1, Tibial postérieur:0.7, Fibulaires:0.6, Soléaire:0.5, Moyen fessier:0.3, Tibial antérieur:0.3', sets: 3, reps: '15/jambe' },
  // Tibial antérieur : antagoniste du mollet. Négligé, il lâche en premier sur
  // les longs déplacements et donne les périostites.
  { name: 'Flexion dorsale de cheville (élastique)', groups: 'Tibial antérieur:1, Fibulaires:0.5, Tibial postérieur:0.3', sets: 3, reps: '20', notes: 'Assis jambe tendue, élastique sur l’avant du pied, on ramène les orteils vers soi.', adaptable: true },
  // Fibulaires : ils tiennent la cheville contre l'entorse en varus. En armure,
  // sur terrain défoncé, ce sont eux qui empêchent le pied de partir.
  { name: 'Éversion de cheville à l’élastique', groups: 'Fibulaires:1, Tibial postérieur:0.4, Soléaire:0.3, Tibial antérieur:0.3', sets: 3, reps: '20/côté', adaptable: true },
  { name: 'Équilibre unipodal sur coussin', groups: 'Fibulaires:1, Tibial postérieur:0.9, Soléaire:0.6, Tibial antérieur:0.5, Moyen fessier:0.4, Rotateurs de hanche:0.4, Gastrocnémiens:0.3, Tenseur du fascia lata:0.3', sets: 3, reps: '45 s/côté', adaptable: true },
  { name: 'Marche sur les talons', groups: 'Tibial antérieur:1, Psoas-iliaque:0.5, Droit fémoral:0.4, Grand droit:0.4, Fibulaires:0.3, Soléaire:0.3, Érecteurs du rachis:0.3, Moyen fessier:0.3, Vaste latéral:0.3, Vaste médial:0.3, Grand fessier:0.3', sets: 3, reps: '30 m', notes: 'Orteils décollés du sol. Prévention des périostites, utile avant les longues sessions en armure.', adaptable: true },
  // Extenseurs de l'avant-bras : ils n'avaient qu'un exercice, alors qu'ils
  // encaissent tout le contrecoup de la préhension. L'anneau 40 kg, les tirages,
  // le portage et la prise d'arme travaillent les FLÉCHISSEURS ; les extenseurs
  // ne font que freiner, en excentrique, sans jamais être renforcés. C'est
  // exactement le déséquilibre qui donne l'épicondylite — celle qui met un bras
  // à l'arrêt pendant des mois, et qui se prévient en dix minutes par semaine.
  { name: 'Extensions de poignets', groups: 'Extenseurs avant-bras:1, Fléchisseurs des doigts:0.4, Brachio-radial:0.4, Rond pronateur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '20', notes: 'Compense le travail de préhension — prévention épicondylite.', adaptable: true },
  { name: 'Extension de poignet à la poulie basse', groups: 'Extenseurs avant-bras:1, Brachio-radial:0.4, Fléchisseurs des doigts:0.4, Rond pronateur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '15/bras', notes: 'Prise pronation, avant-bras posé sur la cuisse. La poulie garde la tension en haut, contrairement à l’haltère.' },
  { name: 'Extension de poignet excentrique (haltère)', groups: 'Extenseurs avant-bras:1, Fléchisseurs des doigts:0.4, Brachio-radial:0.4, Rond pronateur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12/bras', notes: 'On monte avec l’aide de l’autre main, on redescend seul en 3 s. C’est l’excentrique lent qui remet un tendon en état — le protocole de référence sur l’épicondylite.' },
  { name: 'Extension des doigts à l’élastique', groups: 'Extenseurs avant-bras:1, Fléchisseurs des doigts:0.4, Brachio-radial:0.3, Rond pronateur:0.3', sets: 3, reps: '25', notes: 'Petit élastique autour des doigts, on ouvre la main contre la résistance. À faire juste après l’anneau de préhension.', adaptable: true },
  { name: 'Torsion excentrique (barre souple ou serviette roulée)', groups: 'Extenseurs avant-bras:1, Rond pronateur:0.7, Brachio-radial:0.5, Fléchisseurs des doigts:0.5, Fléchisseurs avant-bras:0.4', sets: 3, reps: '15/bras', notes: 'Type « Tyler twist » : on tord avec les deux mains, on relâche lentement avec le bras douloureux seul. À défaut de barre souple, une serviette bien roulée fait l’affaire.', adaptable: true },
  { name: 'Rouleau à poignet (wrist roller)', groups: 'Extenseurs avant-bras:1, Fléchisseurs avant-bras:1, Fléchisseurs des doigts:0.8, Brachio-radial:0.6, Rond pronateur:0.5, Deltoïde antérieur:0.3, Trapèze supérieur:0.3', sets: 2, reps: '2 montées/descentes', notes: 'Bras tendus devant soi. Monte la charge en enroulant, redescend en déroulant : les deux faces de l’avant-bras au même endroit.' },
  { name: 'Pronation-supination à l’haltère déséquilibré', groups: 'Rond pronateur:1, Brachio-radial:0.8, Extenseurs avant-bras:0.7, Fléchisseurs avant-bras:0.5, Biceps:0.4', sets: 3, reps: '15/bras', notes: 'Haltère chargé d’un seul côté, coude à 90°, on tourne paume en haut puis en bas. Le geste du maniement d’arme.', adaptable: true },
  { name: 'Curl concentration', groups: 'Biceps:1, Rond pronateur:0.5, Brachial:0.5, Coraco-brachial:0.5, Brachio-radial:0.4, Fléchisseurs avant-bras:0.3', sets: 3, reps: '12/bras' },
  { name: 'Crunch inversé', groups: 'Grand droit:1, Psoas-iliaque:0.5, Obliques:0.4, Droit fémoral:0.4, Adducteurs:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '15', notes: 'Bas des abdos : enrouler le bassin, ne pas tirer sur la nuque.' },
  { name: 'Relevés de jambes au sol', groups: 'Grand droit:1, Psoas-iliaque:0.7, Obliques:0.4, Droit fémoral:0.4, Adducteurs:0.3, Fléchisseurs avant-bras:0.3, Vaste latéral:0.3, Vaste médial:0.3', sets: 3, reps: '12', notes: 'Lombaires plaquées au sol : si le dos décolle, plier les genoux.' },
  { name: 'Superman au sol', groups: 'Érecteurs du rachis:1, Multifides:0.8, Grand fessier:0.6, Extenseurs du cou:0.5, Trapèze inférieur:0.4, Biceps fémoral:0.4, Trapèze moyen:0.4, Ischios internes:0.4, Carré des lombes:0.3, Deltoïde postérieur:0.3', sets: 3, reps: '12', notes: 'Extension douce, sans hyperextension lombaire.', adaptable: true },
  { name: 'Planche dynamique (planche-pompe)', groups: 'Grand droit:1, Deltoïde antérieur:0.6, Triceps latéral:0.5, Obliques:0.5, Dentelé antérieur:0.4, Grand pectoral:0.4, Triceps longue portion:0.3, Grand fessier:0.3', sets: 3, reps: '10' },
  { name: 'Portage frontal (zercher carry)', groups: 'Grand droit:1, Érecteurs du rachis:0.8, Obliques:0.7, Biceps:0.6, Brachial:0.6, Trapèze supérieur:0.6, Moyen fessier:0.5, Fléchisseurs avant-bras:0.5, Vaste latéral:0.5, Vaste médial:0.5, Adducteurs:0.4, Deltoïde antérieur:0.4, Droit fémoral:0.3', sets: 3, reps: '30 m', notes: 'Charge dans le pli des coudes — très proche du port de la brigantine.' },
  { name: 'Traîneau tiré', groups: 'Biceps fémoral:1, Ischios internes:0.9, Grand fessier:0.8, Cardio:0.7, Grand dorsal:0.6, Trapèze moyen:0.5, Biceps:0.5, Vaste latéral:0.5, Droit fémoral:0.4, Vaste médial:0.4, Brachial:0.4, Deltoïde postérieur:0.4, Fléchisseurs avant-bras:0.4, Gastrocnémiens:0.4, Grand droit:0.4', sets: 4, reps: '20 m' },
  { name: 'Rotation externe couché (élastique)', groups: 'Coiffe des rotateurs:1, Petit rond:0.9, Deltoïde postérieur:0.4, Supra-épineux:0.3, Trapèze moyen:0.3, Trapèze inférieur:0.3, Rhomboïdes:0.3', sets: 3, reps: '15/bras', notes: 'Coiffe des rotateurs : très léger, coude collé au corps.', adaptable: true },
  { name: 'Tirage élastique horizontal', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Deltoïde postérieur:0.5, Rhomboïdes:0.5, Biceps:0.4, Brachial:0.4, Grand rond:0.4, Trapèze inférieur:0.3, Fléchisseurs avant-bras:0.3', sets: 3, reps: '15', notes: 'Alternative maison ou échauffement du dos.', adaptable: true },
  { name: 'Gainage latéral dynamique (hanche)', groups: 'Obliques:1, Carré des lombes:0.7, Moyen fessier:0.6, Tenseur du fascia lata:0.5, Grand droit:0.4, Adducteurs:0.3', sets: 3, reps: '12/côté' },
  { name: 'Étirement pectoraux au mur', groups: 'Grand pectoral:1, Petit pectoral:0.9, Pectoral supérieur:0.8, Deltoïde antérieur:0.6, Sous-scapulaire:0.5, Coiffe des rotateurs:0.4, Dentelé antérieur:0.4, Biceps:0.4', sets: 2, reps: '30 s/côté', kind: 'recuperation', notes: 'Ouvre la cage — compense l’épaule tombante. Sans forcer sur l’AC droite.' },

  // ── 🏢 Basic Fit — parc machines, poulies et barre guidée ─────────────────
  // Balayage du matériel présent en club : cardio, barre guidée (Smith),
  // machines guidées, poulies, zone haltères et cross-training. Les noms
  // reprennent l'appellation française usuelle en salle.

  // Cardio
  { name: 'Vélo elliptique', groups: 'Cardio:1, Vaste latéral:0.6, Droit fémoral:0.5, Grand fessier:0.5, Vaste médial:0.5, Grand dorsal:0.4, Biceps fémoral:0.4, Gastrocnémiens:0.4, Ischios internes:0.4, Triceps latéral:0.3, Deltoïde antérieur:0.3, Soléaire:0.3, Triceps longue portion:0.3', sets: 1, reps: '20 min', notes: 'Sans impact : le cardio le plus tolérant pour les rotules.', kind: 'activite' },
  { name: 'Course sur tapis', groups: 'Cardio:1, Gastrocnémiens:0.9, Vaste latéral:0.7, Biceps fémoral:0.6, Soléaire:0.6, Droit fémoral:0.6, Vaste médial:0.6, Ischios internes:0.5, Grand fessier:0.5, Tibial antérieur:0.4, Psoas-iliaque:0.4, Moyen fessier:0.3, Adducteurs:0.3', sets: 1, reps: '25 min', kind: 'activite' },
  { name: 'Vélo semi-allongé', groups: 'Cardio:0.9, Vaste latéral:0.8, Droit fémoral:0.7, Vaste médial:0.6, Biceps fémoral:0.4, Grand fessier:0.4, Ischios internes:0.4, Gastrocnémiens:0.3, Soléaire:0.3', sets: 1, reps: '25 min', notes: 'Dossier : ménage les lombaires, parfait en récupération active le lendemain du béhourd.', kind: 'activite' },
  { name: 'Vélo de biking (RPM)', groups: 'Cardio:1, Vaste latéral:0.9, Droit fémoral:0.8, Vaste médial:0.7, Grand fessier:0.6, Gastrocnémiens:0.4, Biceps fémoral:0.4, Soléaire:0.4, Ischios internes:0.4, Érecteurs du rachis:0.3, Adducteurs:0.3', sets: 1, reps: '30 min', kind: 'activite' },

  // Barre guidée (Smith machine)
  { name: 'Développé couché à la barre guidée', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Triceps latéral:0.5, Deltoïde antérieur:0.5, Triceps longue portion:0.3, Dentelé antérieur:0.3', sets: 4, reps: '10', notes: '⚠️ AC droite : trajectoire imposée — garder les coudes à 45°, ne pas écarter.' },
  { name: 'Développé incliné à la barre guidée', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Grand pectoral:0.6, Triceps latéral:0.4, Dentelé antérieur:0.3, Triceps longue portion:0.3, Coiffe des rotateurs:0.3, Petit pectoral:0.3, Trapèze inférieur:0.3, Grand droit:0.3', sets: 4, reps: '10' },
  { name: 'Développé militaire à la barre guidée', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps latéral:0.6, Triceps longue portion:0.5, Dentelé antérieur:0.4, Grand droit:0.3, Trapèze inférieur:0.3, Trapèze supérieur:0.3', sets: 3, reps: '10' },
  { name: 'Tirage buste penché à la barre guidée', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Deltoïde postérieur:0.6, Rhomboïdes:0.6, Biceps:0.5, Brachial:0.5, Grand rond:0.4, Fléchisseurs avant-bras:0.4, Érecteurs du rachis:0.3', sets: 4, reps: '10' },
  { name: 'Fentes à la barre guidée', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Droit fémoral:0.6, Adducteurs:0.5, Moyen fessier:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Soléaire:0.3', sets: 3, reps: '10/jambe' },
  { name: 'Poussée de hanches à la barre guidée', groups: 'Grand fessier:1, Adducteurs:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Vaste latéral:0.4, Vaste médial:0.4, Grand droit:0.3, Droit fémoral:0.3', sets: 4, reps: '12' },
  { name: 'Haussements d’épaules à la barre guidée', groups: 'Trapèze supérieur:1, Élévateur de la scapula:0.7, Trapèze moyen:0.4, Fléchisseurs avant-bras:0.4, Cou:0.4, Rhomboïdes:0.3', sets: 4, reps: '15', notes: 'Charge lourde possible sans lâcher la barre : idéal pour les trapèzes du harnois.' },
  { name: 'Mollets debout à la barre guidée', groups: 'Gastrocnémiens:1, Tibial postérieur:0.6, Soléaire:0.5, Fibulaires:0.4, Érecteurs du rachis:0.3, Grand droit:0.3', sets: 4, reps: '20' },

  // Machines guidées
  { name: 'Développé pectoraux convergent (machine)', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Triceps latéral:0.5, Deltoïde antérieur:0.4, Triceps longue portion:0.3, Dentelé antérieur:0.3', sets: 4, reps: '10' },
  { name: 'Rowing à la machine convergente', groups: 'Grand dorsal:1, Deltoïde postérieur:0.6, Trapèze moyen:0.6, Rhomboïdes:0.5, Biceps:0.5, Brachial:0.5, Grand rond:0.4, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.3', sets: 4, reps: '10' },
  { name: 'Élévations latérales à la machine', groups: 'Deltoïde latéral:1, Supra-épineux:0.6, Coiffe des rotateurs:0.4, Trapèze supérieur:0.3, Dentelé antérieur:0.3, Trapèze moyen:0.3, Trapèze inférieur:0.3', sets: 3, reps: '15', notes: 'Bras bloqués : moins de triche que les haltères en fin de série.' },
  { name: 'Curl biceps à la machine', groups: 'Biceps:1, Brachial:0.6, Brachio-radial:0.4, Rond pronateur:0.4, Fléchisseurs avant-bras:0.3, Coraco-brachial:0.3', sets: 3, reps: '12' },
  { name: 'Extension triceps à la machine', groups: 'Triceps latéral:1, Triceps longue portion:0.6, Extenseurs avant-bras:0.3, Fléchisseurs des doigts:0.3, Deltoïde postérieur:0.3, Grand droit:0.3', sets: 3, reps: '12' },
  { name: 'Extension lombaire à la machine', groups: 'Érecteurs du rachis:1, Multifides:0.7, Biceps fémoral:0.6, Ischios internes:0.5, Carré des lombes:0.5, Grand fessier:0.4, Adducteurs:0.4', sets: 3, reps: '15', notes: 'Assis dossier réglé : charge progressive sur les érecteurs, sans à-coup.' },
  { name: 'Presse à cuisses horizontale', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.6, Grand fessier:0.6, Adducteurs:0.5, Soléaire:0.3', sets: 4, reps: '12' },
  { name: 'Presse à cuisses unilatérale', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.6, Droit fémoral:0.6, Adducteurs:0.5, Moyen fessier:0.4, Obliques:0.4', sets: 3, reps: '10/jambe', notes: 'Corrige le déséquilibre gauche/droite — utile avec la dysplasie rotulienne.' },
  { name: 'Flexion des ischios assis (machine)', groups: 'Biceps fémoral:1, Ischios internes:0.9, Gracile:0.4, Gastrocnémiens:0.4, Soléaire:0.3', sets: 3, reps: '12', notes: 'Hanche fléchie : ischios plus étirés qu’allongé, meilleur recrutement.' },
  { name: 'Machine à fessiers (glute drive)', groups: 'Grand fessier:1, Adducteurs:0.6, Biceps fémoral:0.5, Ischios internes:0.5, Vaste latéral:0.3, Vaste médial:0.3, Droit fémoral:0.3', sets: 4, reps: '15' },
  { name: 'Chaise romaine — relevés de jambes', groups: 'Grand droit:1, Psoas-iliaque:0.8, Obliques:0.5, Droit fémoral:0.5, Deltoïde antérieur:0.3, Trapèze inférieur:0.3, Adducteurs:0.3', sets: 3, reps: '15', notes: 'Appui sur les avant-bras : pas de fatigue de préhension, contrairement à la barre.' },
  { name: 'Crunch sur banc incliné', groups: 'Grand droit:1, Cou:0.5, Psoas-iliaque:0.5, Obliques:0.4, Droit fémoral:0.3, Fléchisseurs avant-bras:0.3, Adducteurs:0.3', sets: 3, reps: '15' },

  // Poulies
  { name: 'Tirage vertical prise large', groups: 'Grand dorsal:1, Grand rond:0.7, Brachial:0.5, Trapèze moyen:0.4, Biceps:0.4, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.4, Rhomboïdes:0.4, Deltoïde postérieur:0.3', sets: 4, reps: '10' },
  { name: 'Tirage vertical prise supination', groups: 'Grand dorsal:1, Biceps:0.8, Brachial:0.6, Grand rond:0.5, Fléchisseurs avant-bras:0.4, Trapèze inférieur:0.4, Rhomboïdes:0.3, Brachio-radial:0.3', sets: 3, reps: '12' },
  { name: 'Tirage horizontal poulie prise large', groups: 'Trapèze moyen:1, Rhomboïdes:0.8, Deltoïde postérieur:0.6, Grand dorsal:0.6, Biceps:0.4, Brachial:0.4, Grand rond:0.4, Coiffe des rotateurs:0.4, Trapèze inférieur:0.4, Fléchisseurs avant-bras:0.4', sets: 3, reps: '12', notes: 'Coudes hauts : cible le haut du dos — antidote de l’épaule tombante.' },
  { name: 'Extension de hanche à la poulie', groups: 'Grand fessier:1, Biceps fémoral:0.5, Adducteurs:0.5, Ischios internes:0.5, Moyen fessier:0.4, Érecteurs du rachis:0.3, Grand droit:0.3', sets: 3, reps: '12/jambe' },
  { name: 'Abduction de hanche à la poulie', groups: 'Moyen fessier:1, Tenseur du fascia lata:0.7, Rotateurs de hanche:0.5, Grand fessier:0.4, Obliques:0.3, Grand droit:0.3', sets: 3, reps: '15/jambe', notes: 'Stabilité latérale du genou : directement utile en déplacement sous armure.' },
  { name: 'Crunch à la poulie haute (à genoux)', groups: 'Grand droit:1, Obliques:0.5, Cou:0.4, Psoas-iliaque:0.4, Fléchisseurs des doigts:0.4, Grand dorsal:0.3, Fléchisseurs avant-bras:0.3, Triceps longue portion:0.3, Grand fessier:0.3', sets: 3, reps: '15' },
  { name: 'Curl marteau à la corde (poulie)', groups: 'Brachio-radial:1, Brachial:1, Biceps:0.7, Fléchisseurs avant-bras:0.5, Rond pronateur:0.4, Extenseurs avant-bras:0.3', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie prise inversée', groups: 'Triceps latéral:1, Triceps longue portion:0.4, Extenseurs avant-bras:0.4, Fléchisseurs des doigts:0.3, Deltoïde postérieur:0.3, Grand droit:0.3', sets: 3, reps: '15' },

  // Haltères et barre libre
  { name: 'Développé Arnold', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.8, Coiffe des rotateurs:0.5, Supra-épineux:0.5, Triceps latéral:0.5, Triceps longue portion:0.4, Dentelé antérieur:0.4, Trapèze supérieur:0.4, Grand droit:0.3, Trapèze inférieur:0.3', sets: 3, reps: '10', notes: '⚠️ AC droite : la rotation peut tirer — réduire l’amplitude ou rester en prise neutre.' },
  { name: 'Développé haltères au sol (floor press)', groups: 'Grand pectoral:1, Triceps latéral:0.7, Triceps longue portion:0.6, Pectoral supérieur:0.4, Deltoïde antérieur:0.4, Dentelé antérieur:0.3, Coiffe des rotateurs:0.3, Grand droit:0.3', sets: 4, reps: '10', notes: '⚠️ AC droite : le sol bloque la descente — la variante de développé la plus sûre pour l’épaule.' },
  { name: 'Tirage buste penché aux haltères', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.5, Biceps:0.5, Brachial:0.5, Grand rond:0.5, Érecteurs du rachis:0.5, Fléchisseurs des doigts:0.5, Deltoïde postérieur:0.4, Fléchisseurs avant-bras:0.4, Biceps fémoral:0.4, Ischios internes:0.4, Multifides:0.4, Carré des lombes:0.4, Grand fessier:0.4, Trapèze inférieur:0.3, Brachio-radial:0.3, Élévateur de la scapula:0.3, Transverse:0.3', sets: 4, reps: '10' },
  { name: 'Soulevé de terre jambes tendues aux haltères', groups: 'Biceps fémoral:1, Ischios internes:0.9, Grand fessier:0.8, Érecteurs du rachis:0.6, Adducteurs:0.5, Fléchisseurs des doigts:0.5, Multifides:0.5, Fléchisseurs avant-bras:0.4, Carré des lombes:0.4, Trapèze supérieur:0.4, Transverse:0.4, Trapèze moyen:0.3, Grand dorsal:0.3, Gastrocnémiens:0.3, Grand droit:0.3, Rhomboïdes:0.3', sets: 3, reps: '12' },
  { name: 'Squat sumo à l’haltère', groups: 'Adducteurs:1, Vaste latéral:0.8, Grand fessier:0.8, Vaste médial:0.7, Gracile:0.6, Rotateurs de hanche:0.5, Droit fémoral:0.4, Ischios internes:0.4, Érecteurs du rachis:0.4, Grand droit:0.4, Biceps fémoral:0.3, Fléchisseurs avant-bras:0.3, Moyen fessier:0.3, Tenseur du fascia lata:0.3', sets: 3, reps: '12' },
  { name: 'Curl incliné aux haltères', groups: 'Biceps:1, Brachial:0.5, Rond pronateur:0.5, Brachio-radial:0.4, Coraco-brachial:0.3, Fléchisseurs avant-bras:0.3, Deltoïde antérieur:0.3', sets: 3, reps: '12', notes: 'Bras en arrière du buste : étirement maximal de la longue portion.' },
  { name: 'Extension triceps haltère à deux mains', groups: 'Triceps longue portion:1, Triceps latéral:0.5, Grand droit:0.4, Coiffe des rotateurs:0.3, Fléchisseurs avant-bras:0.3, Fléchisseurs des doigts:0.3, Dentelé antérieur:0.3, Obliques:0.3, Érecteurs du rachis:0.3', sets: 3, reps: '12' },
  { name: 'Haussements d’épaules à la barre', groups: 'Trapèze supérieur:1, Élévateur de la scapula:0.7, Trapèze moyen:0.4, Fléchisseurs avant-bras:0.4, Cou:0.3, Rhomboïdes:0.3, Extenseurs avant-bras:0.3', sets: 4, reps: '12' },

  // Zone cross-training
  { name: 'Sangles de suspension — tirage', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Biceps:0.5, Brachial:0.5, Grand droit:0.5, Rhomboïdes:0.5, Deltoïde postérieur:0.4, Fléchisseurs avant-bras:0.4, Grand rond:0.4, Trapèze inférieur:0.3, Obliques:0.3', sets: 3, reps: '12' },
  { name: 'Sangles de suspension — pompes', groups: 'Grand pectoral:1, Triceps latéral:0.6, Petit pectoral:0.6, Deltoïde antérieur:0.5, Grand droit:0.5, Coiffe des rotateurs:0.5, Pectoral supérieur:0.4, Dentelé antérieur:0.4, Obliques:0.4, Triceps longue portion:0.4, Grand fessier:0.3', sets: 3, reps: '12' },
  { name: 'Marche latérale élastique (mini-band)', groups: 'Moyen fessier:1, Tenseur du fascia lata:0.7, Rotateurs de hanche:0.5, Grand fessier:0.4, Obliques:0.3, Fibulaires:0.3', sets: 3, reps: '15/côté', notes: 'Échauffement de hanche : réveille le moyen fessier avant le travail lourd de jambes.', adaptable: true },
  // Tenseur du fascia lata : abduction hanche TENDUE. En gainage latéral il
  // passe devant le moyen fessier, qui préfère la hanche fléchie.
  { name: 'Abduction en gainage latéral', groups: 'Tenseur du fascia lata:1, Moyen fessier:0.9, Obliques:0.6, Carré des lombes:0.5, Grand fessier:0.4, Grand droit:0.4, Transverse:0.4, Deltoïde latéral:0.3', sets: 3, reps: '15/côté' },
  // Psoas-iliaque : moteur de la bascule antérieure du bassin. Le renforcer en
  // amplitude complète vaut mieux que de le laisser court et tirer sur les lombaires.
  { name: 'Flexion de hanche à l’élastique (debout)', groups: 'Psoas-iliaque:1, Droit fémoral:0.5, Grand droit:0.4, Obliques:0.3, Tibial antérieur:0.3, Adducteurs:0.3, Moyen fessier:0.3, Vaste latéral:0.3, Soléaire:0.3', sets: 3, reps: '15/côté' },
  { name: 'Montée de genou à la poulie basse', groups: 'Psoas-iliaque:1, Grand droit:0.6, Droit fémoral:0.5, Obliques:0.4, Tenseur du fascia lata:0.3, Moyen fessier:0.3, Adducteurs:0.3, Soléaire:0.3', sets: 3, reps: '12/côté', notes: 'Cheville sanglée, monter au-dessus de l’horizontale : c’est là que le psoas prend seul.' },

  // ── ✊ Préhension (matériel perso) ────────────────────────────────────────
  // L'anneau de poigne se travaille n'importe où : c'est le muscle le plus
  // rentable du béhourd, celui qui lâche avant la force ou le cardio.
  { name: 'Anneau de préhension 40 kg', groups: 'Fléchisseurs des doigts:1, Fléchisseurs avant-bras:0.8, Brachio-radial:0.5, Extenseurs avant-bras:0.4, Brachial:0.3', sets: 1, reps: '15 min', notes: 'Anneau Domyos rouge, résistance difficile (40 kg). Séance libre de 15 min, en alternant les mains. ⚠️ Compenser avec « Extensions de poignets » une fois par semaine — prévention épicondylite.' },
  { name: 'Anneau de préhension — tenue isométrique', groups: 'Fléchisseurs des doigts:1, Fléchisseurs avant-bras:0.8, Brachio-radial:0.4, Extenseurs avant-bras:0.3', sets: 5, reps: '45 s/main', notes: 'Serrage maintenu, pas de répétitions : c’est le mode qui correspond vraiment à tenir l’arme et le bouclier tout un round.' },

  // ── 🌀 Ceinture abdominale ────────────────────────────────────────────────
  // La ceinture ne se résume pas aux crunchs : elle travaille surtout à
  // RÉSISTER — à l'extension, à la rotation, à l'inclinaison. C'est ce transfert
  // qui manque quand la force des jambes ne remonte pas jusqu'aux bras.
  // ⚠️ Antéversion du bassin : privilégier l'anti-extension au travail en flexion.
  { name: 'Gainage ventral lesté', groups: 'Grand droit:1, Transverse:0.8, Obliques:0.6, Dentelé antérieur:0.4, Grand fessier:0.4, Deltoïde antérieur:0.3, Trapèze inférieur:0.3, Vaste latéral:0.3, Vaste médial:0.3, Droit fémoral:0.3', sets: 4, reps: '45 s', notes: 'Disque sur le haut du dos. Bassin en rétroversion : les lombaires ne doivent jamais creuser.' },
  { name: 'Hollow body (bateau)', groups: 'Grand droit:1, Transverse:0.7, Psoas-iliaque:0.6, Obliques:0.5, Droit fémoral:0.4, Adducteurs:0.3', sets: 4, reps: '30 s', notes: 'Le meilleur test d’anti-extension : si les lombaires décollent du sol, replier les genoux.' },
  { name: 'Roulette abdominale debout', groups: 'Grand droit:1, Transverse:0.8, Obliques:0.6, Grand dorsal:0.5, Dentelé antérieur:0.5, Grand fessier:0.4, Deltoïde antérieur:0.3, Triceps longue portion:0.3, Grand rond:0.3', sets: 3, reps: '8', notes: 'Version dure de la roulette. À ne tenter qu’une fois 3×10 à genoux maîtrisées.' },
  { name: 'Rowing en position de planche (renegade row)', groups: 'Obliques:1, Grand droit:0.9, Grand dorsal:0.7, Trapèze moyen:0.5, Biceps:0.5, Brachial:0.5, Deltoïde postérieur:0.4, Fléchisseurs avant-bras:0.4, Grand rond:0.4, Grand fessier:0.4, Triceps latéral:0.3, Triceps longue portion:0.3', sets: 3, reps: '8/bras', notes: 'Anti-rotation sous charge : le bassin ne doit pas bouger d’un millimètre. Le transfert le plus direct vers le combat en armure.' },
  { name: 'Planche latérale avec rotation', groups: 'Obliques:1, Carré des lombes:0.6, Grand droit:0.6, Dentelé antérieur:0.5, Moyen fessier:0.5, Tenseur du fascia lata:0.4, Deltoïde antérieur:0.3', sets: 3, reps: '10/côté' },
  { name: 'Planche latérale danoise (copenhagen)', groups: 'Obliques:1, Adducteurs:0.9, Gracile:0.7, Transverse:0.6, Grand droit:0.5, Moyen fessier:0.4, Ischios internes:0.4', sets: 3, reps: '20 s/côté', notes: 'Obliques et adducteurs ensemble. Commencer genou plié sur le banc.' },
  { name: 'Bûcheron à la poulie (haut vers bas)', groups: 'Obliques:1, Grand droit:0.7, Grand dorsal:0.5, Multifides:0.5, Deltoïde antérieur:0.4, Grand fessier:0.4, Transverse:0.4, Carré des lombes:0.4, Érecteurs du rachis:0.4, Fléchisseurs des doigts:0.4, Dentelé antérieur:0.4, Trapèze moyen:0.3, Triceps latéral:0.3, Moyen fessier:0.3, Triceps longue portion:0.3, Vaste latéral:0.3, Vaste médial:0.3', sets: 3, reps: '12/côté', notes: 'La rotation part des hanches, pas des bras. C’est le geste de frappe en armure.' },
  { name: 'Relevé diagonal à la poulie (bas vers haut)', groups: 'Obliques:1, Grand droit:0.7, Deltoïde antérieur:0.6, Multifides:0.5, Grand fessier:0.4, Trapèze supérieur:0.4, Transverse:0.4, Carré des lombes:0.4, Érecteurs du rachis:0.4, Fléchisseurs des doigts:0.4, Dentelé antérieur:0.3, Moyen fessier:0.3, Vaste latéral:0.3, Vaste médial:0.3, Trapèze inférieur:0.3', sets: 3, reps: '12/côté' },
  { name: 'Relevés de jambes tendues suspendu', groups: 'Grand droit:1, Psoas-iliaque:0.9, Obliques:0.6, Fléchisseurs avant-bras:0.6, Droit fémoral:0.5, Grand dorsal:0.4, Adducteurs:0.4, Brachio-radial:0.3', sets: 3, reps: '10', notes: 'Version dure des relevés de genoux. Monter sans balancer.' },
  { name: 'Flexion latérale à la poulie', groups: 'Obliques:1, Carré des lombes:0.9, Grand droit:0.5, Érecteurs du rachis:0.5, Multifides:0.4, Transverse:0.4, Fléchisseurs des doigts:0.4, Moyen fessier:0.3, Trapèze supérieur:0.3', sets: 3, reps: '12/côté', notes: 'Charge modérée : le but est le contrôle latéral, pas l’épaisseur de taille.' },
  { name: 'Gainage sur ballon (anti-extension)', groups: 'Grand droit:1, Transverse:0.8, Obliques:0.5, Dentelé antérieur:0.5, Deltoïde antérieur:0.4, Grand fessier:0.4, Trapèze inférieur:0.3', sets: 3, reps: '30 s', notes: 'L’instabilité force le transverse à travailler en continu.' },
  { name: 'Vacuum abdominal', groups: 'Transverse:1, Obliques:0.4, Multifides:0.4, Grand droit:0.3', sets: 3, reps: '20 s', notes: 'Transverse profond : expirer à fond puis rentrer le ventre sous les côtes. À jeun, sans charge — c’est ce qui resserre la sangle.', adaptable: true },
  { name: 'Deadbug lesté', groups: 'Grand droit:1, Transverse:0.8, Obliques:0.5, Psoas-iliaque:0.5, Multifides:0.4, Droit fémoral:0.4, Deltoïde antérieur:0.3, Grand dorsal:0.3, Adducteurs:0.3', sets: 3, reps: '10/côté', notes: 'Un haltère léger tenu bras tendus : l’anti-extension devient beaucoup plus exigeante.' },
  { name: 'Portage frontal unilatéral (rack sur une épaule)', groups: 'Obliques:1, Carré des lombes:0.8, Grand droit:0.8, Érecteurs du rachis:0.6, Moyen fessier:0.6, Trapèze supérieur:0.5, Vaste latéral:0.4, Tenseur du fascia lata:0.4, Vaste médial:0.4, Fléchisseurs des doigts:0.4, Multifides:0.4, Transverse:0.4, Fléchisseurs avant-bras:0.3, Cou:0.3, Adducteurs:0.3, Droit fémoral:0.3, Biceps:0.3, Brachial:0.3, Soléaire:0.3', sets: 3, reps: '30 m/côté', notes: 'Charge asymétrique en hauteur : la ceinture encaisse tout. Très proche du port du bouclier.' },

  // ── 🔬 Muscles profonds : de quoi les travailler POUR EUX-MÊMES ───────────
  //
  // L'audit anatomique compte, pour chaque muscle, les exercices où il est
  // MOTEUR PLEIN. Onze en avaient zéro : supra-épineux, petit rond,
  // sous-scapulaire, petit pectoral, scalènes, carré des lombes,
  // coraco-brachial, rotateurs profonds de hanche, gracile, ischios internes,
  // tibial postérieur. Ils étaient nommés partout — en stabilisateurs à 0,3 ou
  // 0,5 — et cibles nulle part.
  //
  // Ce n'est pas un détail de comptage. Le générateur propose l'exercice qui
  // vise le muscle le plus reposé ; un muscle qu'aucun exercice ne vise
  // pleinement ne pouvait donc JAMAIS être proposé. Il restait éternellement
  // frais au mannequin — et éternellement non travaillé dans la vraie vie.
  // C'est exactement le genre de trou qui se solde par une blessure : la coiffe
  // et le tibial postérieur sont deux des pannes les plus banales, et ce sont
  // deux de ces onze.
  //
  // Chaque entrée ci-dessous est un exercice réel dont ce muscle-là est le
  // moteur, pas un exercice existant renommé. Les conditions qui font qu'il
  // l'est — l'angle, la rotation, la longueur du levier — sont dans la note,
  // parce que sans elles c'est un autre muscle qui prend le travail.
  //
  // ⚠️ Disjonction AC droite : tout ce qui touche l'épaule reste sous 60° et à
  // charge légère. ⚠️ Dysplasie rotulienne : rien ici ne charge le genou.

  // Coiffe des rotateurs. Le supra-épineux initie l'abduction — c'est lui qui
  // décolle le bras des 30 premiers degrés — et le « full can », pouce vers le
  // haut, le recrute autant que l'« empty can » sans le conflit sous-acromial
  // qui rend ce dernier douloureux (Reinold et coll., JOSPT 2007).
  { name: 'Élévation latérale « pleine canette » (full can)', groups: 'Supra-épineux:1, Deltoïde latéral:0.7, Coiffe des rotateurs:0.5, Trapèze inférieur:0.4, Trapèze supérieur:0.3, Dentelé antérieur:0.3', sets: 3, reps: '15/bras', notes: 'Pouce vers le HAUT, bras à 30° en avant du plan du corps, on monte à 60° pas plus. C’est le pouce qui fait tout : paume vers le bas, c’est le conflit sous-acromial. 2 à 5 kg suffisent. ⚠️ AC droite : jamais au-dessus de l’horizontale.', adaptable: true },
  // Le sous-scapulaire est le seul rotateur INTERNE de la coiffe, et le seul
  // qu'aucun tirage ni aucune poussée ne travaille pour lui-même. Le « lift-off »
  // (main décollée du bas du dos) est le geste qui l'isole le mieux, parce que
  // le grand pectoral et le grand dorsal ne peuvent pas y participer.
  { name: 'Rotation interne d’épaule à l’élastique (coude au corps)', groups: 'Sous-scapulaire:1, Grand pectoral:0.5, Grand rond:0.4, Grand dorsal:0.4, Deltoïde antérieur:0.3', sets: 3, reps: '15/bras', notes: 'Coude collé au flanc à 90°, une serviette roulée dessous. On ramène l’avant-bras vers le ventre, lentement. Contrepartie indispensable des rotations externes : une coiffe ne s’équilibre pas d’un seul côté.', adaptable: true },
  { name: 'Décollement main dans le dos (lift-off)', groups: 'Sous-scapulaire:1, Rhomboïdes:0.5, Deltoïde postérieur:0.4, Trapèze moyen:0.4, Triceps longue portion:0.3', sets: 3, reps: '10/bras', notes: 'Main au creux des reins, paume vers l’arrière, on décolle la main de quelques centimètres. Sans charge au début : la plupart des épaules n’y arrivent pas du premier coup, et c’est précisément le signe qu’il fallait le faire.', adaptable: true },
  // Le petit pectoral bascule l'omoplate vers l'avant et vers le bas. Rien ne
  // le travaille en concentrique dans une salle : on l'ÉTIRE en permanence
  // (épaules enroulées) sans jamais lui demander de force. L'abaissement
  // scapulaire assis est le geste où il est moteur avec le grand dorsal.
  { name: 'Abaissement scapulaire assis (press-up)', groups: 'Petit pectoral:1, Grand dorsal:0.7, Trapèze inférieur:0.6, Triceps latéral:0.5, Triceps longue portion:0.4, Dentelé antérieur:0.4, Grand pectoral:0.3', sets: 3, reps: '12', notes: 'Assis, mains à plat sur le banc de part et d’autre des hanches, bras tendus : on pousse pour décoller le bassin de quelques centimètres SANS plier les coudes. Tout le mouvement vient des omoplates. ⚠️ AC droite : amplitude courte.' },
  // Les scalènes inclinent le cou et lèvent les deux premières côtes à
  // l'inspiration forcée. En béhourd, ce sont eux qui encaissent la frappe
  // latérale sur le heaume — et ils ne figuraient en moteur nulle part.
  { name: 'Inclinaison cervicale résistée (scalènes)', groups: 'Scalènes:1, Cou:0.8, Élévateur de la scapula:0.6, Trapèze supérieur:0.5, Extenseurs du cou:0.4', sets: 3, reps: '12/côté', notes: 'Main à plat sur la tempe, on pousse l’oreille vers l’épaule contre sa propre main, menton légèrement rentré. Résistance manuelle progressive, jamais brutale — le cou ne se travaille pas à l’échec.', adaptable: true },
  // Le carré des lombes tient le bassin de côté. Les extensions du buste le
  // sollicitent à 0,5, la flexion latérale à la poulie à 0,9 : aucune ne le
  // vise. Sur le banc à 45° tourné sur le flanc, il n'y a plus que lui.
  { name: 'Inclinaison latérale sur banc à 45°', groups: 'Carré des lombes:1, Obliques:0.9, Érecteurs du rachis:0.6, Multifides:0.5, Grand droit:0.4, Moyen fessier:0.3', sets: 3, reps: '12/côté', notes: 'Allongé SUR LE FLANC sur le banc lombaire, hanches calées, on descend puis on remonte le buste dans le plan latéral. Sans charge d’abord : le bras de levier est déjà long.' },
  // Le coraco-brachial fléchit l'épaule et ramène le bras contre le corps. Il
  // est masqué par le deltoïde antérieur dans tout ce qui pousse ; coude fléchi,
  // le deltoïde perd son avantage mécanique et c'est lui qui monte le bras.
  { name: 'Élévation frontale coude fléchi (coraco-brachial)', groups: 'Coraco-brachial:1, Deltoïde antérieur:0.7, Pectoral supérieur:0.5, Biceps:0.4, Brachial:0.3', sets: 3, reps: '12/bras', notes: 'Coude fléchi à 90° et gardé fléchi, on monte le coude devant soi jusqu’à l’horizontale, bras près de l’axe du corps. Léger. ⚠️ AC droite : s’arrêter à hauteur d’épaule.', adaptable: true },
  // Les rotateurs profonds de hanche (piriforme et les cinq autres) tiennent le
  // fémur dans sa cavité. Ils sortaient à 0,3-0,5 partout et n'étaient visés que
  // par une mobilité. Assis, hanche à 90°, la rotation externe ne peut plus être
  // volée par le grand fessier.
  { name: 'Rotation externe de hanche assis (élastique)', groups: 'Rotateurs de hanche:1, Moyen fessier:0.6, Grand fessier:0.5, Tenseur du fascia lata:0.3', sets: 3, reps: '15/jambe', notes: 'Assis au bord d’un banc, élastique autour des chevilles, genoux à 90° : on écarte le pied vers l’extérieur en gardant le genou immobile. Le genou qui bouge, c’est le fessier qui triche.', adaptable: true },
  // Le gracile est le seul adducteur qui croise AUSSI le genou : il ne travaille
  // pour lui-même que jambe tendue. La machine à adducteurs et la planche
  // danoise genou plié le laissent à 0,7 ; en levier long, il passe devant.
  { name: 'Adduction de hanche jambe tendue (poulie basse)', groups: 'Gracile:1, Adducteurs:1, Ischios internes:0.4, Grand droit:0.3, Moyen fessier:0.3, Obliques:0.3', sets: 3, reps: '15/jambe', notes: 'Sangle à la cheville, GENOU TENDU : c’est ce qui met le gracile en jeu, puisqu’il descend jusqu’au tibia. Genou plié, ce sont les adducteurs courts qui prennent tout.' },
  // Les ischios internes (demi-tendineux, demi-membraneux) freinent la jambe en
  // fin de course. Les machines les mettent à 0,9 derrière le biceps fémoral ;
  // en excentrique lent, ce sont eux qui prennent le plus — et c'est le seul
  // exercice dont la littérature montre qu'il réduit les claquages.
  { name: 'Curl nordique (nordic hamstring)', groups: 'Ischios internes:1, Biceps fémoral:0.9, Grand fessier:0.6, Érecteurs du rachis:0.5, Gastrocnémiens:0.4, Multifides:0.4, Grand droit:0.4', sets: 3, reps: '6', notes: 'À genoux, chevilles bloquées, on descend le buste vers l’avant le plus lentement possible, corps aligné du genou à la tête, puis on se rattrape aux mains. Excentrique pur : 6 répétitions suffisent, et les courbatures durent trois jours la première fois. ⚠️ Dysplasie rotulienne : sur un tapis épais, le genou ne supporte aucune charge ici mais appuie fort.' },
  // Le tibial postérieur soutient la voûte plantaire ; sa défaillance est la
  // cause n°1 du pied plat de l'adulte. Il n'apparaissait qu'en stabilisateur —
  // et « Éversion de cheville » travaille son antagoniste, pas lui.
  { name: 'Inversion de cheville à l’élastique', groups: 'Tibial postérieur:1, Soléaire:0.5, Tibial antérieur:0.4, Gastrocnémiens:0.3', sets: 3, reps: '20/côté', notes: 'Élastique accroché à l’extérieur, pied en légère extension : on tourne la plante vers l’INTÉRIEUR, sans bouger le genou. Le pendant exact de l’éversion, qu’on faisait déjà toute seule.', adaptable: true },

  // Les six muscles suivants n'avaient qu'UN exercice moteur. Un seul, c'est un
  // catalogue qui tombe en panne dès que ce muscle-là a besoin d'autre chose —
  // le générateur reproposait indéfiniment le même geste, ou rien.
  { name: 'Extension lombaire segmentaire (amplitude courte)', groups: 'Multifides:1, Érecteurs du rachis:0.8, Carré des lombes:0.6, Grand fessier:0.5, Biceps fémoral:0.4, Transverse:0.4, Ischios internes:0.3', sets: 3, reps: '15', notes: 'Sur le banc à 45°, on ne remonte QUE jusqu’à l’alignement, en déroulant vertèbre par vertèbre. Les multifides travaillent sur les derniers degrés ; aller plus haut, c’est passer la main aux érecteurs et creuser les lombaires.' },
  { name: 'Gainage avec rentrée du nombril (hollowing)', groups: 'Transverse:1, Multifides:0.6, Obliques:0.5, Grand droit:0.5, Grand fessier:0.3', sets: 3, reps: '30 s', notes: 'Planche sur les avant-bras, et pendant toute la tenue on rentre le nombril vers la colonne en respirant normalement. C’est le geste du vacuum ajouté à un gainage : serrer la taille, pas fléchir le tronc.', adaptable: true },
  { name: 'Haussement d’épaule nuque inclinée du côté opposé', groups: 'Élévateur de la scapula:1, Trapèze supérieur:0.7, Rhomboïdes:0.5, Scalènes:0.4, Cou:0.3', sets: 3, reps: '12/côté', notes: 'Tête inclinée et légèrement tournée du côté OPPOSÉ à l’épaule qui monte : le trapèze supérieur se raccourcit et laisse l’angulaire faire le travail. Charge modérée, une seule main.' },
  { name: 'Curl Zottman', groups: 'Rond pronateur:1, Brachio-radial:0.9, Brachial:0.8, Biceps:0.7, Extenseurs avant-bras:0.6, Fléchisseurs avant-bras:0.5, Deltoïde antérieur:0.3', sets: 3, reps: '10/bras', notes: 'On monte en supination (paume en haut), on tourne en haut, on redescend en pronation (paume en bas). La rotation sous charge dans les deux sens : personne d’autre au catalogue ne la travaille en amplitude complète.' },
  { name: 'Abduction de hanche en flexion (poulie)', groups: 'Tenseur du fascia lata:1, Moyen fessier:0.8, Rotateurs de hanche:0.4, Grand droit:0.3, Obliques:0.3', sets: 3, reps: '15/jambe', notes: 'Jambe portée en AVANT d’environ 30° avant d’écarter, pointe de pied vers l’intérieur : c’est cette position-là qui met le tenseur du fascia lata devant le moyen fessier. Hanche neutre, c’est l’inverse.' },
  { name: 'Mollets assis à la barre sur les genoux', groups: 'Soléaire:1, Tibial postérieur:0.5, Gastrocnémiens:0.4, Fibulaires:0.3', sets: 4, reps: '20', notes: 'Barre posée sur le bas des cuisses, avant-pieds sur une cale. Genou fléchi : le gastrocnémien est mis hors-jeu — il croise le genou — et il ne reste que le soléaire. La version libre de la machine, quand elle est prise.' },

  // ── 🧘 Récupération active ────────────────────────────────────────────────
  // Ces séances ne fatiguent pas : elles relancent la circulation et raccourcissent
  // le délai de retour. Enregistrées, elles retirent un jour de récupération aux
  // zones travaillées — c'est tout l'intérêt de les noter.
  { name: 'Récupération — mobilité générale', groups: 'Corps entier:1', sets: 1, reps: '20 min', kind: 'recuperation', notes: 'Amplitudes complètes sans charge, articulation par articulation. Le lendemain d’une grosse séance.' },
  { name: 'Récupération — mobilité haut du corps', groups: 'Deltoïde latéral:1, Grand dorsal:1, Grand pectoral:1, Trapèze supérieur:1, Deltoïde antérieur:0.9, Deltoïde postérieur:0.8, Trapèze moyen:0.8, Rhomboïdes:0.8, Pectoral supérieur:0.8, Cou:0.8, Coiffe des rotateurs:0.8, Grand rond:0.7, Trapèze inférieur:0.7, Élévateur de la scapula:0.6, Dentelé antérieur:0.6, Petit pectoral:0.5, Fléchisseurs avant-bras:0.5, Extenseurs avant-bras:0.4, Brachio-radial:0.4, Fléchisseurs des doigts:0.4, Biceps:0.4, Triceps latéral:0.4, Rond pronateur:0.3, Triceps longue portion:0.3', sets: 1, reps: '15 min', kind: 'recuperation', notes: 'Ouverture de la cage, rotations d’épaules, décompression cervicale. ⚠️ AC droite : rester dans l’indolore.' },
  { name: 'Récupération — mobilité hanches et jambes', groups: 'Jambes:1, Grand fessier:1, Adducteurs:1, Biceps fémoral:1, Ischios internes:1, Moyen fessier:0.8, Psoas-iliaque:0.8, Gastrocnémiens:0.7, Soléaire:0.6, Tenseur du fascia lata:0.6, Érecteurs du rachis:0.5, Tibial antérieur:0.5, Tibial postérieur:0.5, Multifides:0.4, Fibulaires:0.4, Carré des lombes:0.3', sets: 1, reps: '15 min', kind: 'recuperation', notes: 'Fentes basses, ouverture de hanche, chaîne postérieure. Essentiel avec l’antéversion du bassin.' },
  { name: 'Récupération — rouleau de massage', groups: 'Jambes:1, Grand dorsal:1, Grand fessier:1, Trapèze moyen:0.8, Rhomboïdes:0.8, Moyen fessier:0.8, Grand rond:0.7, Érecteurs du rachis:0.7, Trapèze inférieur:0.6, Adducteurs:0.6, Tenseur du fascia lata:0.6, Gastrocnémiens:0.6, Multifides:0.6, Soléaire:0.5, Trapèze supérieur:0.5, Carré des lombes:0.5, Élévateur de la scapula:0.3', sets: 1, reps: '15 min', kind: 'recuperation', notes: 'Lent, en s’arrêtant sur les points sensibles. Respiration ample.' },
  { name: 'Récupération — nage souple', groups: 'Haut du corps:1, Grand dorsal:1, Deltoïde latéral:1, Deltoïde antérieur:0.9, Trapèze moyen:0.8, Rhomboïdes:0.8, Deltoïde postérieur:0.8, Grand rond:0.7, Coiffe des rotateurs:0.7, Trapèze inférieur:0.6, Obliques:0.5, Fléchisseurs avant-bras:0.4, Extenseurs avant-bras:0.3, Brachio-radial:0.3, Fléchisseurs des doigts:0.3, Rond pronateur:0.3', sets: 1, reps: '20 min', kind: 'recuperation', notes: 'Sans forcer, en portage. L’eau décharge les articulations : idéal au lendemain du béhourd.' },
  // Godille : le geste qui déplace l'EAU au lieu de déplacer le corps. Debout
  // ou en suspension, on balaie l'eau autour de soi façon brasse. La résistance
  // est proportionnelle à la vitesse — impossible de forcer par accident, et
  // aucune charge sur l'articulation : la ceinture scapulaire se remet en route
  // sans rien encaisser. Le meilleur rapport mobilité/risque pour une AC fragile.
  { name: 'Récupération — brasse sur place (godille)', groups: 'Coiffe des rotateurs:1, Deltoïde postérieur:0.8, Petit rond:0.8, Sous-scapulaire:0.8, Deltoïde latéral:0.7, Grand dorsal:0.7, Grand rond:0.6, Dentelé antérieur:0.6, Trapèze moyen:0.6, Deltoïde antérieur:0.6, Grand pectoral:0.5, Rhomboïdes:0.5, Trapèze inférieur:0.5, Supra-épineux:0.5, Fléchisseurs avant-bras:0.4, Extenseurs avant-bras:0.4, Grand droit:0.3, Obliques:0.3', sets: 1, reps: '10 min', notes: 'Eau à hauteur d’épaules. Balayages lents et larges, paumes qui « prennent » l’eau. Chercher l’amplitude, jamais la vitesse.', kind: 'recuperation' },
  { name: 'Récupération — marche', groups: 'Grand fessier:1, Gastrocnémiens:0.9, Soléaire:0.9, Moyen fessier:0.8, Biceps fémoral:0.6, Ischios internes:0.6, Vaste latéral:0.6, Vaste médial:0.6, Psoas-iliaque:0.5, Droit fémoral:0.5, Tibial antérieur:0.5, Tibial postérieur:0.4, Fibulaires:0.4, Érecteurs du rachis:0.4, Multifides:0.3, Carré des lombes:0.3, Adducteurs:0.3', sets: 1, reps: '30 min', kind: 'recuperation', notes: 'Le moyen le plus simple de relancer la circulation sans coûter d’énergie.' },
  { name: 'Récupération — étirements complets', groups: 'Corps entier:1', sets: 1, reps: '15 min', kind: 'recuperation', notes: 'À froid jamais : toujours après un échauffement ou en fin de journée active.' },
  // Étirements, un par chaîne. Chacun ne « décharge » que les zones qu'il vise :
  // enregistrer trois étirements ciblés vaut mieux qu'un « étirements complets »
  // qui déclarerait tout le corps reposé.
  { name: 'Étirement des ischios (jambe tendue)', groups: 'Biceps fémoral:1, Ischios internes:1, Gastrocnémiens:0.5, Érecteurs du rachis:0.4, Adducteurs:0.4, Multifides:0.3, Grand fessier:0.3, Carré des lombes:0.3, Moyen fessier:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Dos droit, on plie depuis la hanche et non depuis le dos.' },
  { name: 'Étirement des quadriceps debout', groups: 'Droit fémoral:1, Vaste latéral:0.9, Vaste médial:0.9, Psoas-iliaque:0.6, Tibial antérieur:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Genou vers le sol, bassin en rétroversion. ⚠️ Rotules : ne pas tirer le talon dans la fesse à froid.' },
  { name: 'Étirement des fessiers (figure 4)', groups: 'Grand fessier:1, Rotateurs de hanche:0.9, Moyen fessier:0.8, Tenseur du fascia lata:0.5, Érecteurs du rachis:0.4, Multifides:0.3, Adducteurs:0.3, Carré des lombes:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Allongé ou assis, cheville sur le genou opposé.' },
  { name: 'Étirement des adducteurs (papillon)', groups: 'Adducteurs:1, Gracile:0.8, Rotateurs de hanche:0.5, Ischios internes:0.4, Grand fessier:0.3, Moyen fessier:0.3', sets: 2, reps: '60 s', kind: 'recuperation', notes: 'Plantes de pieds jointes, coudes qui poussent doucement les genoux.' },
  { name: 'Étirement des mollets au mur', groups: 'Gastrocnémiens:1, Soléaire:0.8, Fibulaires:0.3, Tibial antérieur:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Jambe tendue pour le jumeau, genou plié pour le soléaire : faire les deux.' },
  { name: 'Étirement du grand dorsal', groups: 'Grand dorsal:1, Grand rond:0.6, Dentelé antérieur:0.4, Trapèze supérieur:0.4, Trapèze moyen:0.3, Triceps longue portion:0.3, Trapèze inférieur:0.3, Élévateur de la scapula:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Bras tendu en hauteur, on s’incline du côté opposé. Ou suspendu à la barre, relâché.' },
  { name: 'Étirement des trapèzes et de la nuque', groups: 'Trapèze supérieur:1, Extenseurs du cou:0.9, Scalènes:0.8, Cou:0.8, Élévateur de la scapula:0.8, Rhomboïdes:0.4, Trapèze moyen:0.3', sets: 2, reps: '30 s/côté', kind: 'recuperation', notes: 'Oreille vers l’épaule, sans forcer avec la main. Essentiel après le port du heaume.' },
  { name: 'Étirement des triceps au-dessus de la tête', groups: 'Triceps longue portion:1, Triceps latéral:0.7, Grand dorsal:0.4, Grand rond:0.3, Coiffe des rotateurs:0.3', sets: 2, reps: '30 s/côté', kind: 'recuperation' },
  { name: 'Rotation thoracique couché', groups: 'Grand dorsal:1, Trapèze moyen:0.8, Rhomboïdes:0.8, Grand rond:0.7, Trapèze inférieur:0.6, Obliques:0.6, Dentelé antérieur:0.6, Grand pectoral:0.5, Pectoral supérieur:0.4, Érecteurs du rachis:0.4, Multifides:0.3, Coiffe des rotateurs:0.3, Carré des lombes:0.3, Petit pectoral:0.3', sets: 2, reps: '45 s/côté', kind: 'recuperation', notes: 'Couché sur le côté, genou fléchi au sol, on ouvre le bras du dessus. Rend de l’amplitude aux épaules.' },
  { name: 'Étirement des avant-bras', groups: 'Fléchisseurs avant-bras:1, Extenseurs avant-bras:1, Fléchisseurs des doigts:0.8, Rond pronateur:0.5, Brachio-radial:0.4, Biceps:0.3', sets: 2, reps: '30 s/côté', kind: 'recuperation', notes: 'Bras tendu, paume vers le haut puis vers le bas, on tire les doigts. Indispensable après l’anneau de préhension ou une séance en armure.' },
  { name: 'Chat-vache (mobilité du rachis)', groups: 'Érecteurs du rachis:1, Multifides:0.8, Carré des lombes:0.7, Grand droit:0.5, Transverse:0.4, Obliques:0.4, Trapèze supérieur:0.4, Trapèze moyen:0.3, Dentelé antérieur:0.3, Cou:0.3, Trapèze inférieur:0.3, Élévateur de la scapula:0.3', sets: 2, reps: '10', kind: 'recuperation', notes: 'À quatre pattes, on enroule puis on creuse lentement, au rythme de la respiration.' },
  { name: '90/90 hanches (rotation assise)', groups: 'Rotateurs de hanche:1, Moyen fessier:0.9, Tenseur du fascia lata:0.8, Adducteurs:0.7, Grand fessier:0.7, Gracile:0.5, Psoas-iliaque:0.4, Dentelé antérieur:0.4, Obliques:0.3, Multifides:0.3, Érecteurs du rachis:0.3, Carré des lombes:0.3', sets: 2, reps: '10/côté', kind: 'recuperation', notes: 'Assis, une jambe devant à 90° en rotation EXTERNE, l’autre sur le côté à 90° en rotation INTERNE, et on bascule d’un côté à l’autre. Les deux sens comptent : c’est la jambe arrière, en rotation interne, qui ouvre le tenseur du fascia lata et le moyen fessier. Buste droit, fesses au sol ; se pencher en avant sur la jambe avant ajoute l’étirement des fessiers profonds.' },

  // Poids du corps en récupération : amplitude et circulation, jamais l'échec.
  { name: 'Squat profond en tenue', groups: 'Adducteurs:1, Grand fessier:0.8, Rotateurs de hanche:0.7, Moyen fessier:0.6, Droit fémoral:0.6, Vaste latéral:0.5, Vaste médial:0.5, Gastrocnémiens:0.5, Soléaire:0.5, Gracile:0.5, Érecteurs du rachis:0.4, Multifides:0.3, Tibial antérieur:0.3, Carré des lombes:0.3', sets: 3, reps: '60 s', kind: 'recuperation', notes: 'Talons au sol, on s’assoit au fond et on respire. Rend de la mobilité de cheville et de hanche.' },
  { name: 'Pont fessier au sol', groups: 'Grand fessier:1, Moyen fessier:0.8, Biceps fémoral:0.5, Ischios internes:0.5, Adducteurs:0.4, Érecteurs du rachis:0.4, Multifides:0.3, Vaste latéral:0.3, Vaste médial:0.3, Carré des lombes:0.3, Droit fémoral:0.3', sets: 3, reps: '15', kind: 'recuperation', notes: 'Lent, en serrant les fessiers en haut. Réveille la chaîne postérieure sans la fatiguer.' },
  { name: 'Marche en fente lente', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.8, Moyen fessier:0.6, Droit fémoral:0.6, Psoas-iliaque:0.5, Adducteurs:0.4, Soléaire:0.3', sets: 2, reps: '20 m', kind: 'recuperation', notes: 'Sans charge, en contrôlant la descente. Relance la circulation dans les jambes.' },
  { name: 'Rotations d’épaules à vide', groups: 'Deltoïde latéral:1, Deltoïde antérieur:0.9, Deltoïde postérieur:0.8, Coiffe des rotateurs:0.8, Trapèze supérieur:0.5, Trapèze moyen:0.4, Grand pectoral:0.4, Dentelé antérieur:0.4, Trapèze inférieur:0.3, Pectoral supérieur:0.3, Élévateur de la scapula:0.3, Petit pectoral:0.3', sets: 2, reps: '15', kind: 'recuperation', notes: 'Grands cercles lents, avant puis arrière. ⚠️ AC droite : amplitude confortable uniquement.' },
  { name: 'Salutation au soleil (enchaînement)', groups: 'Corps entier:1', sets: 3, reps: '5', kind: 'recuperation', notes: 'Enchaînement complet au rythme de la respiration. La séance de récupération la plus courte qui couvre tout.' },
  { name: 'Récupération — sauna ou bain chaud', groups: 'Corps entier:1', sets: 1, reps: '20 min', kind: 'recuperation', notes: 'Vasodilatation. À éviter juste après une séance de force : laisser 2 h.' },
]

/** Exercices qui retirent de la fatigue au lieu d'en ajouter. */
/** Activités à part entière : elles ont leur intensité dans leur MET. */
export const ACTIVITE_NAMES = new Set(
  EXERCISE_LIBRARY.filter((e) => e.kind === 'activite').map((e) => e.name.trim().toLowerCase()),
)

export const RECUPERATION_NAMES = new Set(
  EXERCISE_LIBRARY.filter((e) => e.kind === 'recuperation').map((e) => e.name.trim().toLowerCase()),
)

/**
 * Anciens noms (parfois anglais) → nom français actuel. Sert à renommer les
 * exercices déjà présents au catalogue plutôt qu'à en créer des doublons.
 */
/**
 * Anciens noms → nom de référence. La clé est normalisée par `cleExercice` :
 * minuscules, espaces coupés, et apostrophe DROITE — « Farmer's walk » tapé au
 * clavier ne portait pas la même apostrophe que « farmer’s walk » écrit ici,
 * et l'exercice restait orphelin de la bibliothèque, avec « Full body » pour
 * tout étiquetage.
 */
export function cleExercice(nom: string): string {
  return nom.trim().toLowerCase().replace(/[\u2018\u2019\u201a\u201b]/g, "'")
}

export const EXERCISE_RENAMES: Record<string, string> = {
  'chest press (machine assise)': 'Développé pectoraux à la machine',
  'press incliné (machine)': 'Développé incliné à la machine',
  'converging incline press': 'Développé incliné convergent (machine)',
  'pec deck (butterfly)': 'Écarté à la machine (pec deck)',
  'écarté à la poulie (cable crossover)': 'Écarté à la poulie',
  'pull-over haltère': 'Tirage bras tendus (pull-over)',
  'dips barres parallèles': 'Dips aux barres parallèles',
  'dips machine assistée': 'Dips à la machine assistée',
  'tirage vertical devant (lat pulldown)': 'Tirage vertical devant',
  'rowing barre': 'Tirage buste penché à la barre',
  'rowing haltère unilatéral': 'Tirage unilatéral à l’haltère',
  'rowing poitrine appuyée (chest supported)': 'Tirage buste appuyé',
  'rowing assis machine (leverage)': 'Tirage assis à la machine',
  'face pulls poulie haute': 'Tirage visage à la poulie haute',
  'shrugs haltères': 'Haussements d’épaules aux haltères',
  'hyperextensions (banc lombaire)': 'Extensions du buste (banc lombaire)',
  'suspension à la barre (dead hang)': 'Suspension à la barre',
  'good morning': 'Flexion du buste barre au dos',
  'converging shoulder press': 'Développé épaules convergent (machine)',
  'push press haltères prise neutre': 'Développé avec impulsion, haltères prise neutre',
  'reverse fly (pec deck inversé)': 'Écarté inversé à la machine',
  'l-fly poulie basse ou élastique': 'Rotation externe d’épaule (poulie ou élastique)',
  'curl pupitre (machine ou banc larry scott)': 'Curl au pupitre',
  'barre au front (skull crusher)': 'Barre au front',
  'kickback triceps': 'Extension triceps buste penché',
  'flexions de poignets (wrist curl)': 'Flexions de poignets',
  'front squat': 'Squat barre devant',
  'box squat (ou goblet squat)': 'Squat sur box (ou squat gobelet)',
  'goblet squat tempo': 'Squat gobelet en tempo',
  'step-up sur banc': 'Montée sur banc',
  'leg extension (machine)': 'Extension des jambes à la machine',
  'leg curl allongé ou assis': 'Flexion des ischios allongé (machine)',
  'flexion des ischios à la machine': 'Flexion des ischios allongé (machine)',
  'squat guidé': 'Squat à la barre guidée',
  'hip thrust (barre ou machine)': 'Poussée de hanches (barre ou machine)',
  'terminal knee extensions (élastique)': 'Extension terminale du genou (élastique)',
  'deadbug': 'Deadbug (gainage bras-jambes alternés)',
  'bird-dog': 'Bird-dog (gainage croisé)',
  'pallof press': 'Anti-rotation à la poulie (Pallof)',
  'torso rotation (machine)': 'Rotation du buste à la machine',
  'russian twist': 'Rotations russes',
  'mountain climbers': 'Grimpeurs au sol',
  'roulette abdominale (ab wheel)': 'Roulette abdominale',
  'crunch machine (abdos)': 'Crunch à la machine',
  "farmer's walk": 'Marche du fermier',
  'suitcase carry (haltère 1 main)': 'Port valise (haltère à une main)',
  'kettlebell swing': 'Balancier à la kettlebell',
  'turkish get-up': 'Relevé turc',
  'box jumps': 'Sauts sur box',
  'slam ball': 'Lancer de ballon lesté',
  'traîneau poussé (prowler)': 'Traîneau poussé',
  'battle ropes ou rameur sprint': 'Cordes ondulatoires ou rameur en sprint',
  'pull buoy (bras seuls)': 'Nage bras seuls (pull buoy)',
  'rucking (rando avec sac lesté)': 'Randonnée avec sac lesté',
  'trail / sentier': 'Course en sentier',
  "slackline / travail d'équilibre": 'Slackline (travail d’équilibre)',
  // Noms relevés dans les séances déjà faites : chacun désignait un exercice
  // que la bibliothèque connaît sous un autre nom, et restait donc étiqueté
  // « Dos » ou « Full body » pendant que la référence était juste à côté.
  'curl haltères assis incliné': 'Curl incliné aux haltères',
  'développé incliné haltères': 'Développé couché incliné haltères',
  'extensions triceps poulie haute': 'Extensions triceps poulie haute (barre droite)',
  'rowing assis': 'Tirage horizontal poulie prise neutre',
  'tirage horizontal poulie': 'Tirage horizontal poulie prise neutre',
}
