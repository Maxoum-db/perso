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
   */
  kind?: 'activite'
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // ── Pectoraux ─────────────────────────────────────────────────────────────
  { name: 'Développé couché', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.5', sets: 4, reps: '8' },
  { name: 'Développé couché haltères', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.5', sets: 4, reps: '8-10', notes: 'Trajectoire libre : plus doux pour l’épaule droite que la barre.' },
  { name: 'Développé incliné barre', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps:0.4', sets: 4, reps: '8-10' },
  { name: 'Développé couché incliné haltères', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Développé décliné', groups: 'Grand pectoral:1, Triceps:0.6, Deltoïde antérieur:0.3', sets: 3, reps: '10' },
  { name: 'Écarté haltères', groups: 'Grand pectoral:1, Deltoïde antérieur:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : ne pas descendre les coudes sous la ligne du buste.' },
  { name: 'Écarté à la poulie', groups: 'Grand pectoral:1, Pectoral supérieur:0.5, Deltoïde antérieur:0.3', sets: 3, reps: '12-15' },
  { name: 'Écarté à la machine (pec deck)', groups: 'Grand pectoral:1, Deltoïde antérieur:0.3', sets: 3, reps: '12-15' },
  { name: 'Développé pectoraux à la machine', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.4', sets: 3, reps: '10-12' },
  { name: 'Développé incliné à la machine', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.5, Triceps:0.4', sets: 4, reps: '12' },
  { name: 'Développé incliné convergent (machine)', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.5, Triceps:0.4', sets: 4, reps: '10' },
  { name: 'Développé incliné convergent (charges libres)', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.5, Triceps:0.4', sets: 3, reps: '10' },
  { name: 'Pompes', groups: 'Grand pectoral:1, Triceps:0.6, Deltoïde antérieur:0.5, Grand droit:0.3, Dentelé antérieur:0.3', sets: 4, reps: '15' },
  { name: 'Pompes déclinées', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps:0.5, Grand droit:0.4', sets: 3, reps: '12' },
  { name: 'Dips aux barres parallèles', groups: 'Triceps:1, Grand pectoral:0.7, Deltoïde antérieur:0.4', sets: 3, reps: '8-10', notes: '⚠️ AC droite : amplitude courte, buste droit.' },
  { name: 'Dips à la machine assistée', groups: 'Triceps:1, Grand pectoral:0.6, Deltoïde antérieur:0.4', sets: 3, reps: '10' },
  { name: 'Tirage bras tendus (pull-over)', groups: 'Grand dorsal:0.8, Grand pectoral:0.7, Grand rond:0.5, Triceps:0.3', sets: 3, reps: '12' },

  // ── Dos ───────────────────────────────────────────────────────────────────
  { name: 'Tractions pronation', groups: 'Grand dorsal:1, Grand rond:0.7, Biceps:0.6, Brachio-radial:0.4', sets: 4, reps: '6-10' },
  { name: 'Tractions supination', groups: 'Grand dorsal:1, Biceps:0.8, Grand rond:0.5', sets: 4, reps: '6-10' },
  { name: 'Traction assistée (machine)', groups: 'Grand dorsal:1, Grand rond:0.6, Biceps:0.6', sets: 4, reps: '8-10' },
  { name: 'Tirage vertical prise neutre', groups: 'Grand dorsal:1, Grand rond:0.6, Biceps:0.5', sets: 4, reps: '8-10' },
  { name: 'Tirage vertical devant', groups: 'Grand dorsal:1, Grand rond:0.6, Biceps:0.5', sets: 4, reps: '10' },
  { name: 'Tirage buste penché à la barre', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.6, Biceps:0.5, Érecteurs du rachis:0.4', sets: 4, reps: '8' },
  { name: 'Tirage unilatéral à l’haltère', groups: 'Grand dorsal:1, Trapèze moyen:0.5, Biceps:0.5, Obliques:0.3', sets: 3, reps: '10' },
  { name: 'Tirage buste appuyé', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.5, Biceps:0.4', sets: 3, reps: '10' },
  { name: 'Tirage assis à la machine', groups: 'Grand dorsal:1, Trapèze moyen:0.5, Biceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Tirage horizontal poulie prise neutre', groups: 'Grand dorsal:1, Trapèze moyen:0.5, Biceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Soulevé de terre', groups: 'Ischios:1, Grand fessier:1, Érecteurs du rachis:0.8, Grand dorsal:0.6, Trapèze supérieur:0.5, Avant-bras:0.4', sets: 4, reps: '6-8' },
  { name: 'Soulevé de terre roumain (RDL)', groups: 'Ischios:1, Grand fessier:0.8, Érecteurs du rachis:0.6, Grand dorsal:0.4', sets: 3, reps: '8-10' },
  { name: 'Haussements d’épaules aux haltères', groups: 'Trapèze supérieur:1, Cou:0.4, Avant-bras:0.3', sets: 3, reps: '12-15' },
  { name: 'Tirage visage à la poulie haute', groups: 'Deltoïde postérieur:1, Trapèze moyen:0.6, Rhomboïdes:0.5', sets: 3, reps: '15' },
  { name: 'Extensions du buste (banc lombaire)', groups: 'Grand fessier:0.8, Ischios:0.7, Érecteurs du rachis:0.6', sets: 3, reps: '12' },
  { name: 'Suspension à la barre', groups: 'Fléchisseurs avant-bras:1, Grand dorsal:0.5, Deltoïde postérieur:0.3', sets: 3, reps: '30 s' },

  // ── Épaules ───────────────────────────────────────────────────────────────
  { name: 'Développé militaire barre', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.7, Triceps:0.6, Grand droit:0.3', sets: 4, reps: '6-8', notes: '⚠️ AC droite : la barre force la rotation interne — préférer les haltères.' },
  { name: 'Développé militaire haltères prise neutre', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps:0.5, Grand droit:0.3', sets: 3, reps: '10' },
  { name: 'Développé épaules convergent (machine)', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps:0.5', sets: 3, reps: '10' },
  { name: 'Développé avec impulsion, haltères prise neutre', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps:0.5, Quadriceps:0.4, Grand fessier:0.3', sets: 3, reps: '6-8' },
  { name: 'Élévations latérales haltères', groups: 'Deltoïde latéral:1, Trapèze supérieur:0.3', sets: 4, reps: '12-15' },
  { name: 'Élévations latérales poulie', groups: 'Deltoïde latéral:1, Trapèze supérieur:0.3', sets: 3, reps: '12-15' },
  { name: 'Élévations frontales', groups: 'Deltoïde antérieur:1, Pectoral supérieur:0.3', sets: 3, reps: '12' },
  { name: 'Oiseau haltères (buste penché)', groups: 'Deltoïde postérieur:1, Trapèze moyen:0.5, Rhomboïdes:0.4', sets: 3, reps: '15' },
  { name: 'Écarté inversé à la machine', groups: 'Deltoïde postérieur:1, Trapèze moyen:0.5, Rhomboïdes:0.4', sets: 3, reps: '15' },
  { name: 'Rotation externe d’épaule (poulie ou élastique)', groups: 'Deltoïde postérieur:0.6', sets: 2, reps: '15/bras' },

  // ── Bras ──────────────────────────────────────────────────────────────────
  { name: 'Curl haltères', groups: 'Biceps:1, Brachial:0.6, Avant-bras:0.4', sets: 3, reps: '10-12' },
  { name: 'Curl haltères marteau', groups: 'Brachio-radial:1, Biceps:0.8, Brachial:0.7', sets: 3, reps: '10-12' },
  { name: 'Curl barre EZ', groups: 'Biceps:1, Brachial:0.6, Avant-bras:0.4', sets: 3, reps: '10' },
  { name: 'Curl au pupitre', groups: 'Biceps:1, Brachial:0.7', sets: 3, reps: '10-12' },
  { name: 'Curl poulie basse', groups: 'Biceps:1, Brachial:0.5', sets: 3, reps: '12-15' },
  { name: 'Curl inversé (prise pronation)', groups: 'Brachio-radial:1, Avant-bras:0.8, Biceps:0.5', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (corde)', groups: 'Triceps latéral:1, Triceps longue portion:0.6', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (barre droite)', groups: 'Triceps latéral:1, Triceps longue portion:0.6', sets: 4, reps: '12' },
  { name: 'Extensions triceps au-dessus de la tête (poulie)', groups: 'Triceps longue portion:1, Triceps latéral:0.5', sets: 3, reps: '12' },
  { name: 'Barre au front', groups: 'Triceps longue portion:1, Triceps latéral:0.8', sets: 3, reps: '10-12' },
  { name: 'Extension triceps buste penché', groups: 'Triceps latéral:1, Triceps longue portion:0.5', sets: 3, reps: '12-15' },
  { name: 'Flexions de poignets', groups: 'Fléchisseurs avant-bras:1', sets: 3, reps: '15-20' },

  // ── Jambes ────────────────────────────────────────────────────────────────
  { name: 'Squat barre arrière', groups: 'Quadriceps:1, Grand fessier:0.8, Érecteurs du rachis:0.5, Ischios:0.4, Grand droit:0.4', sets: 4, reps: '6-8' },
  { name: 'Squat à la barre guidée', groups: 'Quadriceps:1, Grand fessier:0.7', sets: 4, reps: '8' },
  { name: 'Squat sur box (ou squat gobelet)', groups: 'Quadriceps:1, Grand fessier:0.8, Ischios:0.4', sets: 3, reps: '10' },
  { name: 'Squat gobelet en tempo', groups: 'Quadriceps:1, Grand fessier:0.6, Grand droit:0.4', sets: 3, reps: '10' },
  { name: 'Squat barre devant', groups: 'Droit fémoral:1, Vaste latéral:0.8, Vaste médial:0.8, Grand droit:0.5, Grand fessier:0.5', sets: 3, reps: '8' },
  { name: 'Presse à cuisses pieds hauts', groups: 'Grand fessier:1, Ischios:0.7, Quadriceps:0.6', sets: 3, reps: '10-12' },
  { name: 'Presse à cuisses (pieds standard)', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.7, Grand fessier:0.5', sets: 4, reps: '10-12' },
  { name: 'Fentes marchées haltères', groups: 'Quadriceps:1, Grand fessier:0.8, Moyen fessier:0.5, Ischios:0.4', sets: 3, reps: '12/jambe' },
  { name: 'Fentes bulgares', groups: 'Quadriceps:1, Grand fessier:0.9, Moyen fessier:0.5', sets: 3, reps: '10/jambe' },
  { name: 'Montée sur banc', groups: 'Quadriceps:1, Grand fessier:0.8, Moyen fessier:0.4', sets: 3, reps: '12/jambe' },
  { name: 'Extension des jambes à la machine', groups: 'Droit fémoral:1, Vaste latéral:0.8, Vaste médial:0.8', sets: 3, reps: '15' },
  { name: 'Flexion des ischios allongé (machine)', groups: 'Biceps fémoral:1, Ischios internes:0.9, Gastrocnémiens:0.3', sets: 3, reps: '12' },
  { name: 'Flexion du buste barre au dos', groups: 'Ischios:1, Érecteurs du rachis:0.8, Grand fessier:0.6', sets: 3, reps: '10' },
  { name: 'Poussée de hanches (barre ou machine)', groups: 'Grand fessier:1, Ischios:0.5', sets: 4, reps: '10-12' },
  { name: 'Abducteurs (machine)', groups: 'Moyen fessier:1', sets: 3, reps: '15' },
  { name: 'Adducteurs (machine)', groups: 'Adducteurs:1', sets: 3, reps: '15' },
  { name: 'Mollets debout (machine)', groups: 'Gastrocnémiens:1, Soléaire:0.5', sets: 4, reps: '15-20' },
  { name: 'Mollets assis (machine)', groups: 'Soléaire:1, Gastrocnémiens:0.4', sets: 4, reps: '15-20' },
  { name: 'Mollets à la presse', groups: 'Gastrocnémiens:1, Soléaire:0.6', sets: 4, reps: '12-15' },
  { name: 'Extension terminale du genou (élastique)', groups: 'Vaste médial:1', sets: 3, reps: '15' },

  // ── Core ──────────────────────────────────────────────────────────────────
  { name: 'Deadbug (gainage bras-jambes alternés)', groups: 'Grand droit:1, Obliques:0.4', sets: 3, reps: '10' },
  { name: 'Planche frontale', groups: 'Grand droit:1, Obliques:0.5, Deltoïde antérieur:0.3', sets: 3, reps: '45 s' },
  { name: 'Planche latérale', groups: 'Obliques:1, Abdos/Core:0.6, Épaules:0.3', sets: 3, reps: '45 s/côté' },
  { name: 'Bird-dog (gainage croisé)', groups: 'Grand droit:0.8, Érecteurs du rachis:0.6, Grand fessier:0.4', sets: 3, reps: '8/côté' },
  { name: 'Crunch à la machine', groups: 'Grand droit:1, Obliques:0.3', sets: 3, reps: '15' },
  { name: 'Relevés de genoux suspendu', groups: 'Grand droit:1, Obliques:0.5, Fléchisseurs avant-bras:0.5', sets: 3, reps: '12-15' },
  { name: 'Roulette abdominale', groups: 'Grand droit:1, Obliques:0.5, Grand dorsal:0.4, Deltoïde antérieur:0.3', sets: 3, reps: '10' },
  { name: 'Anti-rotation à la poulie (Pallof)', groups: 'Obliques:1, Grand droit:0.7', sets: 3, reps: '12/côté' },
  { name: 'Rotation du buste à la machine', groups: 'Obliques:1, Grand droit:0.5', sets: 3, reps: '12/côté' },
  { name: 'Rotations russes', groups: 'Obliques:1, Grand droit:0.7', sets: 3, reps: '20/côté' },
  { name: 'Grimpeurs au sol', groups: 'Grand droit:1, Obliques:0.6, Deltoïde antérieur:0.4, Cardio:0.6', sets: 3, reps: '30 s' },

  // ── Fonctionnel / béhourd ────────────────────────────────────────────────
  { name: 'Extensions cervicales (élastique)', groups: 'Cou:1', sets: 3, reps: '15', notes: 'Amplitude contrôlée, sans à-coup. Renforce la nuque — prévention commotion sous heaume.' },
  { name: 'Pont cervical (front bridge)', groups: 'Cou:1, Trapèze supérieur:0.4', sets: 3, reps: '30 s', notes: 'Isométrique doux, appui sur un tapis. Progresser très lentement en durée.' },
  { name: 'Flexions latérales de nuque', groups: 'Cou:1', sets: 3, reps: '12/côté', notes: 'Résistance manuelle légère. Essentiel pour encaisser les frappes latérales.' },
  { name: 'Marche du fermier', groups: 'Fléchisseurs avant-bras:1, Trapèze supérieur:0.8, Obliques:0.6, Grand droit:0.5, Quadriceps:0.4', sets: 4, reps: '30 m' },
  { name: 'Port valise (haltère à une main)', groups: 'Obliques:1, Grand droit:0.8, Fléchisseurs avant-bras:0.8, Trapèze supérieur:0.5', sets: 3, reps: '30 m/côté' },
  { name: 'Balancier à la kettlebell', groups: 'Grand fessier:1, Ischios:0.8, Érecteurs du rachis:0.5, Grand droit:0.5, Fléchisseurs avant-bras:0.4', sets: 4, reps: '15' },
  { name: 'Relevé turc', groups: 'Grand droit:1, Obliques:0.8, Deltoïde antérieur:0.8, Deltoïde latéral:0.5, Quadriceps:0.4', sets: 3, reps: '5/côté' },
  { name: 'Burpees', groups: 'Cardio:1, Quadriceps:0.6, Grand pectoral:0.5, Triceps:0.5, Grand droit:0.5', sets: 4, reps: '10' },
  { name: 'Sauts sur box', groups: 'Quadriceps:1, Gastrocnémiens:0.7, Grand fessier:0.6, Soléaire:0.4', sets: 3, reps: '10' },
  { name: 'Lancer de ballon lesté', groups: 'Grand droit:1, Obliques:0.7, Grand dorsal:0.6, Deltoïde antérieur:0.6, Cardio:0.6', sets: 4, reps: '12' },
  { name: 'Traîneau poussé', groups: 'Quadriceps:1, Grand fessier:0.8, Gastrocnémiens:0.6, Soléaire:0.5, Cardio:0.7', sets: 4, reps: '20 m' },
  { name: 'Cordes ondulatoires ou rameur en sprint', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Cardio:0.8, Grand droit:0.5, Fléchisseurs avant-bras:0.5', sets: 4, reps: '30 s' },

  // ── Natation ──────────────────────────────────────────────────────────────
  { name: 'Crawl (nage libre)', groups: 'Grand dorsal:1, Grand pectoral:0.8, Obliques:0.7, Triceps:0.6, Grand rond:0.5, Deltoïde postérieur:0.5, Deltoïde latéral:0.5, Dentelé antérieur:0.4, Droit fémoral:0.4, Cardio:0.8', sets: 1, reps: '20 min', kind: 'activite' },
  { name: 'Brasse', groups: 'Adducteurs:1, Grand pectoral:0.9, Quadriceps:0.8, Grand fessier:0.7, Grand dorsal:0.6, Ischios:0.5, Gastrocnémiens:0.4, Cardio:0.8', sets: 1, reps: '20 min', kind: 'activite' },
  { name: 'Dos crawlé', groups: 'Grand dorsal:1, Deltoïde postérieur:0.7, Grand rond:0.6, Triceps:0.6, Obliques:0.5, Trapèze moyen:0.5, Droit fémoral:0.4, Cardio:0.7', sets: 1, reps: '15 min', kind: 'activite' },
  { name: 'Papillon', groups: 'Grand pectoral:1, Grand dorsal:1, Deltoïde antérieur:0.7, Érecteurs du rachis:0.7, Grand droit:0.7, Triceps:0.6, Grand fessier:0.5, Quadriceps:0.5, Cardio:0.8', sets: 1, reps: '10 min', kind: 'activite' },
  { name: 'Jambes avec planche (natation)', groups: 'Droit fémoral:1, Grand fessier:0.7, Ischios:0.5, Gastrocnémiens:0.5, Grand droit:0.5, Vaste latéral:0.4', sets: 4, reps: '50 m', kind: 'activite' },
  { name: 'Nage bras seuls (pull buoy)', groups: 'Grand dorsal:1, Grand pectoral:0.7, Triceps:0.6, Grand rond:0.5, Deltoïde postérieur:0.5, Fléchisseurs avant-bras:0.3', sets: 4, reps: '50 m', kind: 'activite' },
  { name: 'Nage avec plaquettes', groups: 'Grand dorsal:1, Grand pectoral:0.8, Deltoïde latéral:0.8, Deltoïde postérieur:0.7, Triceps:0.6, Grand rond:0.5', sets: 4, reps: '50 m', kind: 'activite' },
  { name: 'Nage en eau libre', groups: 'Grand dorsal:1, Cardio:0.9, Grand pectoral:0.7, Obliques:0.6, Deltoïde postérieur:0.6, Cou:0.4', sets: 1, reps: '30 min', kind: 'activite' },
  { name: 'Aquagym / marche aquatique', groups: 'Cardio:1, Quadriceps:0.5, Grand fessier:0.4, Deltoïde latéral:0.4, Grand droit:0.3', sets: 1, reps: '30 min', kind: 'activite' },

  { name: 'Jambes de brasse (planche)', groups: 'Adducteurs:1, Quadriceps:0.8, Grand fessier:0.7, Ischios:0.5, Gastrocnémiens:0.4', sets: 4, reps: '50 m', notes: 'Le fouet de jambes fournit l’essentiel de la propulsion en brasse. ⚠️ Rotules : amplitude modérée, sans forcer la rotation du genou.', kind: 'activite' },
  { name: 'Ondulations dauphin (dolphin kick)', groups: 'Grand droit:1, Érecteurs du rachis:0.8, Grand fessier:0.6, Quadriceps:0.5, Droit fémoral:0.4', sets: 4, reps: '25 m', notes: 'Ondulation initiée par le bassin, jamais par les genoux. Excellent gainage profond.', kind: 'activite' },
  { name: 'Crawl en sprint (25-50 m)', groups: 'Grand dorsal:1, Cardio:1, Grand pectoral:0.8, Triceps:0.7, Obliques:0.6, Deltoïde latéral:0.5', sets: 8, reps: '25 m', notes: 'Effort maximal court, récupération complète entre les longueurs. ⚠️ AC droite : réduire la fréquence si l’épaule chauffe.', kind: 'activite' },
  { name: 'Nage indienne (récupération)', groups: 'Grand dorsal:0.6, Adducteurs:0.5, Obliques:0.4, Cardio:0.5', sets: 1, reps: '10 min', notes: 'Nage sur le côté, très souple — récupération active entre les séries.', kind: 'activite' },
  // ── Course ────────────────────────────────────────────────────────────────
  { name: 'Course à pied — endurance (zone 2)', groups: 'Cardio:1, Gastrocnémiens:1, Soléaire:0.8, Quadriceps:0.7, Ischios:0.7, Grand fessier:0.5', sets: 1, reps: '30 min', kind: 'activite' },
  { name: 'Fractionné 30/30', groups: 'Cardio:1, Gastrocnémiens:0.8, Quadriceps:0.7, Ischios:0.6, Soléaire:0.5', sets: 10, reps: '30 s', kind: 'activite' },
  { name: 'Sprints en côte', groups: 'Quadriceps:1, Grand fessier:0.9, Gastrocnémiens:0.8, Cardio:0.8, Ischios:0.6', sets: 8, reps: '20 s', kind: 'activite' },
  { name: 'Course en sentier', groups: 'Quadriceps:1, Gastrocnémiens:0.8, Cardio:0.8, Ischios:0.6, Grand fessier:0.6, Tibial antérieur:0.5', sets: 1, reps: '45 min', kind: 'activite' },
  { name: 'Marche rapide / randonnée', groups: 'Cardio:0.6, Soléaire:0.6, Gastrocnémiens:0.5, Quadriceps:0.5, Grand fessier:0.4', sets: 1, reps: '60 min', kind: 'activite' },
  { name: 'Randonnée avec sac lesté', groups: 'Cardio:0.7, Quadriceps:0.7, Grand fessier:0.7, Trapèze supérieur:0.6, Soléaire:0.6, Érecteurs du rachis:0.5, Grand droit:0.5', sets: 1, reps: '45 min', kind: 'activite' },
  { name: 'Corde à sauter', groups: 'Gastrocnémiens:1, Soléaire:0.6, Cardio:0.8, Tibial antérieur:0.4', sets: 5, reps: '2 min', kind: 'activite' },
  { name: 'Sprint / pliométrie sur herbe', groups: 'Ischios:1, Quadriceps:1, Gastrocnémiens:0.8, Grand fessier:0.7', sets: 6, reps: '30 m', kind: 'activite' },

  // ── Bois & extérieur ─────────────────────────────────────────────────────
  { name: 'Fendre du bois (hache)', groups: 'Obliques:0.9, Grand dorsal:0.8, Grand droit:0.8, Deltoïde antérieur:0.7, Fléchisseurs avant-bras:0.7, Grand fessier:0.6, Érecteurs du rachis:0.5', sets: 4, reps: '20 coups', kind: 'activite' },
  { name: 'Sciage manuel (bûche)', groups: 'Grand dorsal:1, Fléchisseurs avant-bras:0.8, Biceps:0.6, Trapèze moyen:0.4, Grand pectoral:0.4', sets: 3, reps: '5 min', kind: 'activite' },
  { name: 'Portage de bûches', groups: 'Fléchisseurs avant-bras:1, Trapèze supérieur:0.8, Grand droit:0.7, Obliques:0.6, Quadriceps:0.5', sets: 4, reps: '50 m', kind: 'activite' },
  { name: 'Empilage / rangement de bois', groups: 'Érecteurs du rachis:0.6, Quadriceps:0.6, Grand fessier:0.6, Grand droit:0.5', sets: 1, reps: '20 min', kind: 'activite' },
  { name: 'Débitage / tronçonnage', groups: 'Fléchisseurs avant-bras:0.8, Deltoïde antérieur:0.6, Grand droit:0.6, Érecteurs du rachis:0.5, Trapèze supérieur:0.4', sets: 1, reps: '30 min', kind: 'activite' },
  { name: 'Débroussaillage / élagage', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.7, Fléchisseurs avant-bras:0.7, Grand droit:0.5, Trapèze supérieur:0.4', sets: 1, reps: '30 min', kind: 'activite' },
  { name: 'Vélo / VTT', groups: 'Quadriceps:1, Cardio:0.9, Grand fessier:0.6, Gastrocnémiens:0.5, Soléaire:0.4', sets: 1, reps: '45 min', kind: 'activite' },
  { name: 'Kayak / aviron sur l’eau', groups: 'Grand dorsal:1, Grand droit:0.7, Deltoïde postérieur:0.7, Cardio:0.7, Obliques:0.6, Biceps:0.6, Fléchisseurs avant-bras:0.5', sets: 1, reps: '40 min', kind: 'activite' },
  { name: 'Escalade / bloc', groups: 'Grand dorsal:1, Fléchisseurs avant-bras:1, Biceps:0.7, Grand droit:0.6, Brachial:0.5, Deltoïde postérieur:0.4', sets: 1, reps: '60 min', kind: 'activite' },
  { name: 'Jardinage (bêchage)', groups: 'Érecteurs du rachis:0.7, Grand dorsal:0.6, Grand fessier:0.6, Fléchisseurs avant-bras:0.5, Grand droit:0.4', sets: 1, reps: '45 min', kind: 'activite' },
  { name: 'Slackline (travail d’équilibre)', groups: 'Grand droit:1, Obliques:0.7, Soléaire:0.6, Tibial antérieur:0.5, Quadriceps:0.5', sets: 3, reps: '5 min', kind: 'activite' },
  { name: 'Étirement fléchisseurs de hanche (fente basse)', groups: 'Grand fessier:0.4, Droit fémoral:0.3', sets: 2, reps: '45 s/côté', kind: 'activite' },
  // ── ⚔️ Béhourd ────────────────────────────────────────────────────────────
  // Discipline de combat en armure : le cou encaisse les frappes sous heaume,
  // les trapèzes et les érecteurs portent les 33 kg d'acier, la préhension
  // tient l'arme et le bouclier, et la rotation du buste porte les frappes.
  { name: 'Béhourd — entraînement technique (sans armure)', groups: 'Deltoïde antérieur:0.8, Obliques:0.8, Fléchisseurs avant-bras:0.7, Grand dorsal:0.6, Triceps:0.6, Grand droit:0.6, Quadriceps:0.5, Cardio:0.7', sets: 1, reps: '60 min', notes: 'Frappes à vide, footwork, drills à deux. ⚠️ AC droite : alterner les côtés, éviter les enchaînements prolongés bras haut.', kind: 'activite' },
  { name: 'Béhourd — port du harnois (endurance armure)', groups: 'Trapèze supérieur:1, Érecteurs du rachis:0.9, Quadriceps:0.8, Cou:0.8, Grand fessier:0.7, Soléaire:0.7, Grand droit:0.6, Cardio:0.7', sets: 1, reps: '30 min', notes: 'Simple déplacement en armure complète pour habituer le corps aux 33 kg. Le point de départ avant tout sparring.', kind: 'activite' },
  { name: 'Béhourd — garde au bouclier (isométrie)', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.8, Trapèze supérieur:0.7, Fléchisseurs avant-bras:0.7, Grand droit:0.4', sets: 4, reps: '60 s', notes: 'Maintien de la garde haute — c’est ce qui lâche en premier en fin de round. ⚠️ AC droite : alterner, ne pas dépasser 60 s côté droit.', kind: 'activite' },
  { name: 'Béhourd — frappes sur pneu ou sac', groups: 'Obliques:1, Deltoïde antérieur:0.8, Fléchisseurs avant-bras:0.8, Grand dorsal:0.7, Triceps:0.6, Grand droit:0.6, Grand fessier:0.5', sets: 5, reps: '2 min', notes: 'Rotation initiée par les hanches, jamais par les bras seuls. ⚠️ AC droite : limiter les frappes au-dessus de la ligne d’épaule.', kind: 'activite' },
  { name: 'Béhourd — duel 1 contre 1', groups: 'Obliques:0.9, Cardio:0.9, Deltoïde antérieur:0.8, Fléchisseurs avant-bras:0.8, Cou:0.7, Quadriceps:0.7, Grand dorsal:0.6, Triceps:0.6', sets: 6, reps: '2 min', notes: 'Plus technique que la mêlée : footwork, timing, garde. Forte sollicitation en rotation du buste.', kind: 'activite' },
  { name: 'Béhourd — mêlée (combat de masse)', groups: 'Cardio:1, Cou:1, Trapèze supérieur:0.9, Deltoïde antérieur:0.8, Fléchisseurs avant-bras:0.8, Érecteurs du rachis:0.8, Quadriceps:0.8, Obliques:0.7, Grand fessier:0.7, Grand dorsal:0.6', sets: 5, reps: '3 min', notes: 'Rounds à intensité maximale : poussées, corps à corps, frappes. Le facteur limitant est le cardio anaérobie, pas la force.', kind: 'activite' },
  { name: 'Béhourd — corps à corps (lutte en armure)', groups: 'Fléchisseurs avant-bras:1, Grand dorsal:0.9, Érecteurs du rachis:0.8, Cou:0.8, Quadriceps:0.8, Trapèze supérieur:0.7, Grand fessier:0.7, Obliques:0.7', sets: 5, reps: '90 s', notes: 'Poussées, projections, contrôle au sol. Très demandeur en préhension et en chaîne postérieure.', kind: 'activite' },
  { name: 'Béhourd — sparring en armure', groups: 'Cardio:1, Cou:0.9, Trapèze supérieur:0.9, Fléchisseurs avant-bras:0.9, Deltoïde antérieur:0.8, Érecteurs du rachis:0.8, Obliques:0.8, Quadriceps:0.8, Grand fessier:0.7, Gastrocnémiens:0.6, Grand dorsal:0.6, Grand droit:0.6', sets: 1, reps: '90 min', notes: '33 kg d’acier + gambeson. Hydratation 1 L/h. Séance la plus exigeante de la semaine : compter 48 h de récupération avant du lourd en jambes.', kind: 'activite' },

  // ── Compléments : machines Basic Fit et variantes courantes ───────────────
  { name: 'Développé couché prise serrée', groups: 'Triceps:1, Grand pectoral:0.6, Deltoïde antérieur:0.4', sets: 3, reps: '8-10', notes: 'Mains à largeur d’épaules, coudes le long du corps.' },
  { name: 'Écarté incliné haltères', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.4', sets: 3, reps: '12', notes: '⚠️ AC droite : amplitude limitée, coudes jamais sous la ligne du buste.' },
  { name: 'Tirage T-bar', groups: 'Grand dorsal:1, Trapèze moyen:0.7, Rhomboïdes:0.6, Biceps:0.5, Érecteurs du rachis:0.4', sets: 4, reps: '8-10' },
  { name: 'Tirage menton (rowing vertical)', groups: 'Deltoïde latéral:1, Trapèze supérieur:0.8, Biceps:0.4', sets: 3, reps: '12', notes: '⚠️ AC droite : à éviter — forte rotation interne. Ne monter que sous la ligne des épaules.' },
  { name: 'Rameur (cardio)', groups: 'Grand dorsal:1, Cardio:0.9, Quadriceps:0.7, Trapèze moyen:0.6, Biceps:0.5, Érecteurs du rachis:0.5', sets: 1, reps: '15 min', notes: 'Séquence jambes → buste → bras. Dos neutre.', kind: 'activite' },
  { name: 'Vélo / Assault bike', groups: 'Cardio:1, Quadriceps:0.8, Grand fessier:0.5, Deltoïde antérieur:0.4', sets: 1, reps: '15 min', notes: 'Sans impact — parfait échauffement genoux.', kind: 'activite' },
  { name: 'Marche inclinée (tapis)', groups: 'Cardio:0.7, Grand fessier:0.6, Soléaire:0.6, Ischios:0.5, Quadriceps:0.4', sets: 1, reps: '20 min', notes: 'Pente 8-12 %, sans se tenir aux poignées.', kind: 'activite' },
  { name: 'Escalier (Stairmaster)', groups: 'Quadriceps:1, Grand fessier:0.8, Gastrocnémiens:0.6, Cardio:0.8', sets: 1, reps: '15 min', notes: '⚠️ Rotules : rythme modéré, poser tout le pied.', kind: 'activite' },
  { name: 'Squat à la machine (hack squat)', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.7, Grand fessier:0.5', sets: 3, reps: '10-12', notes: 'Dos plaqué, genoux jamais verrouillés.' },
  { name: 'Soulevé de terre sumo', groups: 'Grand fessier:1, Adducteurs:0.9, Quadriceps:0.8, Érecteurs du rachis:0.7, Trapèze supérieur:0.5, Fléchisseurs avant-bras:0.4', sets: 4, reps: '5-6', notes: 'Prise étroite, pieds larges : moins de flexion lombaire que le conventionnel.' },
  { name: 'Soulevé de terre trap bar', groups: 'Quadriceps:1, Grand fessier:1, Ischios:0.7, Trapèze supérieur:0.6, Érecteurs du rachis:0.6, Fléchisseurs avant-bras:0.5', sets: 4, reps: '6-8', notes: 'Barre hexagonale : dos plus vertical, excellent compromis pour les lombaires.' },
  { name: 'Fentes inversées', groups: 'Quadriceps:1, Grand fessier:0.8, Moyen fessier:0.5', sets: 3, reps: '10/jambe', notes: '⚠️ Rotules : moins de cisaillement que la fente avant.' },
  { name: 'Mollets unilatéraux', groups: 'Gastrocnémiens:1, Soléaire:0.5', sets: 3, reps: '15/jambe' },
  { name: 'Extensions de poignets', groups: 'Extenseurs avant-bras:1', sets: 3, reps: '15-20', notes: 'Compense le travail de préhension — prévention épicondylite.' },
  { name: 'Curl concentration', groups: 'Biceps:1, Brachial:0.5', sets: 3, reps: '12/bras' },
  { name: 'Crunch inversé', groups: 'Grand droit:1, Obliques:0.4', sets: 3, reps: '15', notes: 'Bas des abdos : enrouler le bassin, ne pas tirer sur la nuque.' },
  { name: 'Relevés de jambes au sol', groups: 'Grand droit:1, Obliques:0.4', sets: 3, reps: '12', notes: 'Lombaires plaquées au sol : si le dos décolle, plier les genoux.' },
  { name: 'Superman au sol', groups: 'Érecteurs du rachis:1, Grand fessier:0.6, Trapèze inférieur:0.4', sets: 3, reps: '12', notes: 'Extension douce, sans hyperextension lombaire.' },
  { name: 'Planche dynamique (planche-pompe)', groups: 'Grand droit:1, Deltoïde antérieur:0.6, Triceps:0.5, Obliques:0.5', sets: 3, reps: '10' },
  { name: 'Portage frontal (zercher carry)', groups: 'Grand droit:1, Érecteurs du rachis:0.8, Biceps:0.6, Trapèze supérieur:0.6, Quadriceps:0.5', sets: 3, reps: '30 m', notes: 'Charge dans le pli des coudes — très proche du port de la brigantine.' },
  { name: 'Traîneau tiré', groups: 'Ischios:1, Grand fessier:0.8, Grand dorsal:0.6, Cardio:0.7', sets: 4, reps: '20 m' },
  { name: 'Rotation externe couché (élastique)', groups: 'Deltoïde postérieur:0.7', sets: 3, reps: '15/bras', notes: 'Coiffe des rotateurs : très léger, coude collé au corps.' },
  { name: 'Tirage élastique horizontal', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.5, Biceps:0.4', sets: 3, reps: '15', notes: 'Alternative maison ou échauffement du dos.' },
  { name: 'Gainage latéral dynamique (hanche)', groups: 'Obliques:1, Moyen fessier:0.6', sets: 3, reps: '12/côté' },
  { name: 'Étirement pectoraux au mur', groups: 'Grand pectoral:0.3, Deltoïde antérieur:0.3', sets: 2, reps: '30 s/côté', notes: 'Ouvre la cage — compense l’épaule tombante. Sans forcer sur l’AC droite.' },

  // ── 🏢 Basic Fit — parc machines, poulies et barre guidée ─────────────────
  // Balayage du matériel présent en club : cardio, barre guidée (Smith),
  // machines guidées, poulies, zone haltères et cross-training. Les noms
  // reprennent l'appellation française usuelle en salle.

  // Cardio
  { name: 'Vélo elliptique', groups: 'Cardio:1, Quadriceps:0.6, Grand fessier:0.5, Grand dorsal:0.4, Ischios:0.4, Triceps:0.3', sets: 1, reps: '20 min', notes: 'Sans impact : le cardio le plus tolérant pour les rotules.', kind: 'activite' },
  { name: 'Course sur tapis', groups: 'Cardio:1, Gastrocnémiens:0.9, Quadriceps:0.7, Ischios:0.6, Soléaire:0.6, Grand fessier:0.5', sets: 1, reps: '25 min', kind: 'activite' },
  { name: 'Vélo semi-allongé', groups: 'Cardio:0.9, Quadriceps:0.8, Ischios:0.4, Grand fessier:0.4', sets: 1, reps: '25 min', notes: 'Dossier : ménage les lombaires, parfait en récupération active le lendemain du béhourd.', kind: 'activite' },
  { name: 'Vélo de biking (RPM)', groups: 'Cardio:1, Quadriceps:0.9, Grand fessier:0.6, Gastrocnémiens:0.4, Ischios:0.4', sets: 1, reps: '30 min', kind: 'activite' },

  // Barre guidée (Smith machine)
  { name: 'Développé couché à la barre guidée', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.5', sets: 4, reps: '8-10', notes: '⚠️ AC droite : trajectoire imposée — garder les coudes à 45°, ne pas écarter.' },
  { name: 'Développé incliné à la barre guidée', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps:0.4', sets: 4, reps: '10' },
  { name: 'Développé militaire à la barre guidée', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.6, Triceps:0.6, Grand droit:0.3', sets: 3, reps: '8-10' },
  { name: 'Tirage buste penché à la barre guidée', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.6, Biceps:0.5, Érecteurs du rachis:0.3', sets: 4, reps: '10' },
  { name: 'Fentes à la barre guidée', groups: 'Quadriceps:1, Grand fessier:0.8, Moyen fessier:0.4, Ischios:0.4', sets: 3, reps: '10/jambe' },
  { name: 'Poussée de hanches à la barre guidée', groups: 'Grand fessier:1, Ischios:0.5, Grand droit:0.3', sets: 4, reps: '12' },
  { name: 'Haussements d’épaules à la barre guidée', groups: 'Trapèze supérieur:1, Fléchisseurs avant-bras:0.4, Cou:0.4', sets: 4, reps: '12-15', notes: 'Charge lourde possible sans lâcher la barre : idéal pour les trapèzes du harnois.' },
  { name: 'Mollets debout à la barre guidée', groups: 'Gastrocnémiens:1, Soléaire:0.5', sets: 4, reps: '15-20' },

  // Machines guidées
  { name: 'Développé pectoraux convergent (machine)', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.4', sets: 4, reps: '10' },
  { name: 'Rowing à la machine convergente', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.5, Biceps:0.5', sets: 4, reps: '10' },
  { name: 'Élévations latérales à la machine', groups: 'Deltoïde latéral:1, Trapèze supérieur:0.3', sets: 3, reps: '12-15', notes: 'Bras bloqués : moins de triche que les haltères en fin de série.' },
  { name: 'Curl biceps à la machine', groups: 'Biceps:1, Brachial:0.6', sets: 3, reps: '12' },
  { name: 'Extension triceps à la machine', groups: 'Triceps latéral:1, Triceps longue portion:0.6', sets: 3, reps: '12' },
  { name: 'Extension lombaire à la machine', groups: 'Érecteurs du rachis:1, Grand fessier:0.4', sets: 3, reps: '12-15', notes: 'Assis dossier réglé : charge progressive sur les érecteurs, sans à-coup.' },
  { name: 'Presse à cuisses horizontale', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.6, Grand fessier:0.6', sets: 4, reps: '12' },
  { name: 'Presse à cuisses unilatérale', groups: 'Vaste latéral:1, Vaste médial:0.9, Grand fessier:0.6, Droit fémoral:0.6, Moyen fessier:0.4', sets: 3, reps: '10/jambe', notes: 'Corrige le déséquilibre gauche/droite — utile avec la dysplasie rotulienne.' },
  { name: 'Flexion des ischios assis (machine)', groups: 'Biceps fémoral:1, Ischios internes:0.9, Gastrocnémiens:0.4', sets: 3, reps: '12', notes: 'Hanche fléchie : ischios plus étirés qu’allongé, meilleur recrutement.' },
  { name: 'Machine à fessiers (glute drive)', groups: 'Grand fessier:1, Ischios:0.5', sets: 4, reps: '12-15' },
  { name: 'Chaise romaine — relevés de jambes', groups: 'Grand droit:1, Obliques:0.5, Deltoïde antérieur:0.3', sets: 3, reps: '12-15', notes: 'Appui sur les avant-bras : pas de fatigue de préhension, contrairement à la barre.' },
  { name: 'Crunch sur banc incliné', groups: 'Grand droit:1, Obliques:0.4', sets: 3, reps: '15' },

  // Poulies
  { name: 'Tirage vertical prise large', groups: 'Grand dorsal:1, Grand rond:0.7, Trapèze moyen:0.4, Biceps:0.4', sets: 4, reps: '10' },
  { name: 'Tirage vertical prise supination', groups: 'Grand dorsal:1, Biceps:0.8, Grand rond:0.5', sets: 3, reps: '10-12' },
  { name: 'Tirage horizontal poulie prise large', groups: 'Trapèze moyen:1, Rhomboïdes:0.8, Deltoïde postérieur:0.6, Grand dorsal:0.6, Biceps:0.4', sets: 3, reps: '12', notes: 'Coudes hauts : cible le haut du dos — antidote de l’épaule tombante.' },
  { name: 'Extension de hanche à la poulie', groups: 'Grand fessier:1, Ischios:0.5, Érecteurs du rachis:0.3', sets: 3, reps: '12/jambe' },
  { name: 'Abduction de hanche à la poulie', groups: 'Moyen fessier:1, Grand fessier:0.4', sets: 3, reps: '15/jambe', notes: 'Stabilité latérale du genou : directement utile en déplacement sous armure.' },
  { name: 'Crunch à la poulie haute (à genoux)', groups: 'Grand droit:1, Obliques:0.5', sets: 3, reps: '12-15' },
  { name: 'Curl marteau à la corde (poulie)', groups: 'Brachio-radial:1, Biceps:0.7, Brachial:0.7', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie prise inversée', groups: 'Triceps latéral:1, Triceps longue portion:0.4', sets: 3, reps: '12-15' },

  // Haltères et barre libre
  { name: 'Développé Arnold', groups: 'Deltoïde antérieur:1, Deltoïde latéral:0.8, Triceps:0.5', sets: 3, reps: '10', notes: '⚠️ AC droite : la rotation peut tirer — réduire l’amplitude ou rester en prise neutre.' },
  { name: 'Développé haltères au sol (floor press)', groups: 'Grand pectoral:1, Triceps:0.7, Deltoïde antérieur:0.4', sets: 4, reps: '8-10', notes: '⚠️ AC droite : le sol bloque la descente — la variante de développé la plus sûre pour l’épaule.' },
  { name: 'Tirage buste penché aux haltères', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Rhomboïdes:0.5, Biceps:0.5, Deltoïde postérieur:0.4', sets: 4, reps: '10' },
  { name: 'Soulevé de terre jambes tendues aux haltères', groups: 'Ischios:1, Grand fessier:0.8, Érecteurs du rachis:0.6', sets: 3, reps: '10-12' },
  { name: 'Squat sumo à l’haltère', groups: 'Adducteurs:1, Quadriceps:0.8, Grand fessier:0.8, Moyen fessier:0.3', sets: 3, reps: '12' },
  { name: 'Curl incliné aux haltères', groups: 'Biceps:1, Brachial:0.5', sets: 3, reps: '10-12', notes: 'Bras en arrière du buste : étirement maximal de la longue portion.' },
  { name: 'Extension triceps haltère à deux mains', groups: 'Triceps longue portion:1, Triceps latéral:0.5', sets: 3, reps: '12' },
  { name: 'Haussements d’épaules à la barre', groups: 'Trapèze supérieur:1, Fléchisseurs avant-bras:0.4, Cou:0.3', sets: 4, reps: '12' },

  // Zone cross-training
  { name: 'Sangles de suspension — tirage', groups: 'Grand dorsal:1, Trapèze moyen:0.6, Biceps:0.5, Grand droit:0.5, Deltoïde postérieur:0.4', sets: 3, reps: '12' },
  { name: 'Sangles de suspension — pompes', groups: 'Grand pectoral:1, Triceps:0.6, Deltoïde antérieur:0.5, Grand droit:0.5', sets: 3, reps: '12' },
  { name: 'Marche latérale élastique (mini-band)', groups: 'Moyen fessier:1, Grand fessier:0.4', sets: 3, reps: '15/côté', notes: 'Échauffement de hanche : réveille le moyen fessier avant le travail lourd de jambes.' },

  // ── ✊ Préhension (matériel perso) ────────────────────────────────────────
  // L'anneau de poigne se travaille n'importe où : c'est le muscle le plus
  // rentable du béhourd, celui qui lâche avant la force ou le cardio.
  { name: 'Anneau de préhension 40 kg', groups: 'Fléchisseurs avant-bras:1, Brachio-radial:0.5, Brachial:0.3', sets: 1, reps: '15 min', notes: 'Anneau Domyos rouge, résistance difficile (40 kg). Séance libre de 15 min, en alternant les mains. ⚠️ Compenser avec « Extensions de poignets » une fois par semaine — prévention épicondylite.' },
  { name: 'Anneau de préhension — tenue isométrique', groups: 'Fléchisseurs avant-bras:1, Brachio-radial:0.4', sets: 5, reps: '45 s/main', notes: 'Serrage maintenu, pas de répétitions : c’est le mode qui correspond vraiment à tenir l’arme et le bouclier tout un round.' },

  // ── 🌀 Ceinture abdominale ────────────────────────────────────────────────
  // La ceinture ne se résume pas aux crunchs : elle travaille surtout à
  // RÉSISTER — à l'extension, à la rotation, à l'inclinaison. C'est ce transfert
  // qui manque quand la force des jambes ne remonte pas jusqu'aux bras.
  // ⚠️ Antéversion du bassin : privilégier l'anti-extension au travail en flexion.
  { name: 'Gainage ventral lesté', groups: 'Grand droit:1, Obliques:0.6, Dentelé antérieur:0.4, Deltoïde antérieur:0.3', sets: 4, reps: '45 s', notes: 'Disque sur le haut du dos. Bassin en rétroversion : les lombaires ne doivent jamais creuser.' },
  { name: 'Hollow body (bateau)', groups: 'Grand droit:1, Obliques:0.5, Droit fémoral:0.4', sets: 4, reps: '30 s', notes: 'Le meilleur test d’anti-extension : si les lombaires décollent du sol, replier les genoux.' },
  { name: 'Roulette abdominale debout', groups: 'Grand droit:1, Obliques:0.6, Grand dorsal:0.5, Dentelé antérieur:0.5, Deltoïde antérieur:0.3', sets: 3, reps: '8', notes: 'Version dure de la roulette. À ne tenter qu’une fois 3×10 à genoux maîtrisées.' },
  { name: 'Rowing en position de planche (renegade row)', groups: 'Obliques:1, Grand droit:0.9, Grand dorsal:0.7, Deltoïde postérieur:0.4, Fléchisseurs avant-bras:0.4', sets: 3, reps: '8/bras', notes: 'Anti-rotation sous charge : le bassin ne doit pas bouger d’un millimètre. Le transfert le plus direct vers le combat en armure.' },
  { name: 'Planche latérale avec rotation', groups: 'Obliques:1, Grand droit:0.6, Dentelé antérieur:0.5, Deltoïde antérieur:0.3', sets: 3, reps: '10/côté' },
  { name: 'Planche latérale danoise (copenhagen)', groups: 'Obliques:1, Adducteurs:0.9, Grand droit:0.5', sets: 3, reps: '20 s/côté', notes: 'Obliques et adducteurs ensemble. Commencer genou plié sur le banc.' },
  { name: 'Bûcheron à la poulie (haut vers bas)', groups: 'Obliques:1, Grand droit:0.7, Grand dorsal:0.5, Deltoïde antérieur:0.4, Grand fessier:0.4', sets: 3, reps: '12/côté', notes: 'La rotation part des hanches, pas des bras. C’est le geste de frappe en armure.' },
  { name: 'Relevé diagonal à la poulie (bas vers haut)', groups: 'Obliques:1, Grand droit:0.7, Deltoïde antérieur:0.6, Grand fessier:0.4', sets: 3, reps: '12/côté' },
  { name: 'Relevés de jambes tendues suspendu', groups: 'Grand droit:1, Obliques:0.6, Fléchisseurs avant-bras:0.6, Droit fémoral:0.5', sets: 3, reps: '10', notes: 'Version dure des relevés de genoux. Monter sans balancer.' },
  { name: 'Flexion latérale à la poulie', groups: 'Obliques:1, Érecteurs du rachis:0.5', sets: 3, reps: '12/côté', notes: 'Charge modérée : le but est le contrôle latéral, pas l’épaisseur de taille.' },
  { name: 'Gainage sur ballon (anti-extension)', groups: 'Grand droit:1, Obliques:0.5, Dentelé antérieur:0.5, Deltoïde antérieur:0.4', sets: 3, reps: '30 s', notes: 'L’instabilité force le transverse à travailler en continu.' },
  { name: 'Vacuum abdominal', groups: 'Grand droit:0.6', sets: 3, reps: '20 s', notes: 'Transverse profond : expirer à fond puis rentrer le ventre sous les côtes. À jeun, sans charge — c’est ce qui resserre la sangle.' },
  { name: 'Deadbug lesté', groups: 'Grand droit:1, Obliques:0.5', sets: 3, reps: '10/côté', notes: 'Un haltère léger tenu bras tendus : l’anti-extension devient beaucoup plus exigeante.' },
  { name: 'Portage frontal unilatéral (rack sur une épaule)', groups: 'Obliques:1, Grand droit:0.8, Érecteurs du rachis:0.6, Trapèze supérieur:0.5, Quadriceps:0.4', sets: 3, reps: '30 m/côté', notes: 'Charge asymétrique en hauteur : la ceinture encaisse tout. Très proche du port du bouclier.' },
]

/**
 * Anciens noms (parfois anglais) → nom français actuel. Sert à renommer les
 * exercices déjà présents au catalogue plutôt qu'à en créer des doublons.
 */
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
  'farmer’s walk': 'Marche du fermier',
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
  'slackline / travail d’équilibre': 'Slackline (travail d’équilibre)',
}
