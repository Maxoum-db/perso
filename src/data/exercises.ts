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
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // ── Pectoraux ─────────────────────────────────────────────────────────────
  { name: 'Développé couché', groups: 'Pectoraux:1, Triceps:0.5, Épaules:0.4', sets: 4, reps: '8' },
  { name: 'Développé couché haltères', groups: 'Pectoraux:1, Triceps:0.5, Épaules:0.4', sets: 4, reps: '8-10', notes: 'Trajectoire libre : plus doux pour l’épaule droite que la barre.' },
  { name: 'Développé incliné barre', groups: 'Pectoraux:1, Épaules:0.5, Triceps:0.4', sets: 4, reps: '8-10' },
  { name: 'Développé couché incliné haltères', groups: 'Pectoraux:1, Épaules:0.5, Triceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Développé décliné', groups: 'Pectoraux:1, Triceps:0.5', sets: 3, reps: '10' },
  { name: 'Écarté haltères', groups: 'Pectoraux:1, Épaules:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : ne pas descendre les coudes sous la ligne du buste.' },
  { name: 'Écarté à la poulie (cable crossover)', groups: 'Pectoraux:1, Épaules:0.3', sets: 3, reps: '12-15' },
  { name: 'Pec deck (butterfly)', groups: 'Pectoraux:1, Épaules:0.3', sets: 3, reps: '12-15' },
  { name: 'Chest press (machine assise)', groups: 'Pectoraux:1, Triceps:0.5, Épaules:0.4', sets: 3, reps: '10-12' },
  { name: 'Press incliné (machine)', groups: 'Pectoraux:1, Épaules:0.5, Triceps:0.4', sets: 4, reps: '12' },
  { name: 'Converging Incline Press', groups: 'Pectoraux:1, Épaules:0.5, Triceps:0.4', sets: 4, reps: '10' },
  { name: 'Développé incliné convergent (charges libres)', groups: 'Pectoraux:1, Épaules:0.5, Triceps:0.4', sets: 3, reps: '10' },
  { name: 'Pompes', groups: 'Pectoraux:1, Triceps:0.6, Épaules:0.4, Abdos/Core:0.3', sets: 4, reps: '15' },
  { name: 'Pompes déclinées', groups: 'Pectoraux:1, Épaules:0.6, Triceps:0.5, Abdos/Core:0.4', sets: 3, reps: '12' },
  { name: 'Dips barres parallèles', groups: 'Triceps:1, Pectoraux:0.7, Épaules:0.4', sets: 3, reps: '8-10', notes: '⚠️ AC droite : amplitude courte, buste droit.' },
  { name: 'Dips machine assistée', groups: 'Triceps:1, Pectoraux:0.6, Épaules:0.4', sets: 3, reps: '10' },
  { name: 'Pull-over haltère', groups: 'Dos:0.8, Pectoraux:0.7, Triceps:0.3', sets: 3, reps: '12' },

  // ── Dos ───────────────────────────────────────────────────────────────────
  { name: 'Tractions pronation', groups: 'Dos:1, Biceps:0.6, Avant-bras:0.4', sets: 4, reps: '6-10' },
  { name: 'Tractions supination', groups: 'Dos:1, Biceps:0.8, Avant-bras:0.4', sets: 4, reps: '6-10' },
  { name: 'Traction assistée (machine)', groups: 'Dos:1, Biceps:0.6, Avant-bras:0.3', sets: 4, reps: '8-10' },
  { name: 'Tirage vertical prise neutre', groups: 'Dos:1, Biceps:0.5, Avant-bras:0.3', sets: 4, reps: '8-10' },
  { name: 'Tirage vertical devant (lat pulldown)', groups: 'Dos:1, Biceps:0.5, Avant-bras:0.3', sets: 4, reps: '10' },
  { name: 'Rowing barre', groups: 'Dos:1, Trapèzes:0.5, Biceps:0.5, Lombaires:0.4', sets: 4, reps: '8' },
  { name: 'Rowing haltère unilatéral', groups: 'Dos:1, Trapèzes:0.4, Biceps:0.5', sets: 3, reps: '10' },
  { name: 'Rowing poitrine appuyée (chest supported)', groups: 'Dos:1, Trapèzes:0.5, Biceps:0.4', sets: 3, reps: '10' },
  { name: 'Rowing assis machine (leverage)', groups: 'Dos:1, Trapèzes:0.4, Biceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Tirage horizontal poulie prise neutre', groups: 'Dos:1, Trapèzes:0.4, Biceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Soulevé de terre', groups: 'Ischios:1, Fessiers:1, Dos:0.8, Lombaires:0.8, Trapèzes:0.5, Avant-bras:0.4', sets: 4, reps: '6-8' },
  { name: 'Soulevé de terre roumain (RDL)', groups: 'Ischios:1, Fessiers:0.8, Lombaires:0.6, Dos:0.4', sets: 3, reps: '8-10' },
  { name: 'Shrugs haltères', groups: 'Trapèzes:1, Avant-bras:0.3', sets: 3, reps: '12-15' },
  { name: 'Face pulls poulie haute', groups: 'Épaules:1, Trapèzes:0.6, Dos:0.4', sets: 3, reps: '15' },
  { name: 'Hyperextensions (banc lombaire)', groups: 'Fessiers:0.8, Ischios:0.7, Lombaires:0.6', sets: 3, reps: '12' },
  { name: 'Suspension à la barre (dead hang)', groups: 'Avant-bras:1, Dos:0.5, Épaules:0.3', sets: 3, reps: '30 s' },

  // ── Épaules ───────────────────────────────────────────────────────────────
  { name: 'Développé militaire barre', groups: 'Épaules:1, Triceps:0.6, Abdos/Core:0.3', sets: 4, reps: '6-8', notes: '⚠️ AC droite : la barre force la rotation interne — préférer les haltères.' },
  { name: 'Développé militaire haltères prise neutre', groups: 'Épaules:1, Triceps:0.5, Abdos/Core:0.3', sets: 3, reps: '10' },
  { name: 'Converging Shoulder Press', groups: 'Épaules:1, Triceps:0.5', sets: 3, reps: '10' },
  { name: 'Push press haltères prise neutre', groups: 'Épaules:1, Triceps:0.5, Quadriceps:0.4, Fessiers:0.3', sets: 3, reps: '6-8' },
  { name: 'Élévations latérales haltères', groups: 'Épaules:1', sets: 4, reps: '12-15' },
  { name: 'Élévations latérales poulie', groups: 'Épaules:1', sets: 3, reps: '12-15' },
  { name: 'Élévations frontales', groups: 'Épaules:1, Pectoraux:0.3', sets: 3, reps: '12' },
  { name: 'Oiseau haltères (buste penché)', groups: 'Épaules:1, Trapèzes:0.5, Dos:0.3', sets: 3, reps: '15' },
  { name: 'Reverse fly (pec deck inversé)', groups: 'Épaules:1, Trapèzes:0.5, Dos:0.3', sets: 3, reps: '15' },
  { name: 'L-Fly poulie basse ou élastique', groups: 'Épaules:1', sets: 2, reps: '15/bras' },

  // ── Bras ──────────────────────────────────────────────────────────────────
  { name: 'Curl haltères', groups: 'Biceps:1, Avant-bras:0.4', sets: 3, reps: '10-12' },
  { name: 'Curl haltères marteau', groups: 'Biceps:1, Avant-bras:0.6', sets: 3, reps: '10-12' },
  { name: 'Curl barre EZ', groups: 'Biceps:1, Avant-bras:0.4', sets: 3, reps: '10' },
  { name: 'Curl pupitre (machine ou banc Larry Scott)', groups: 'Biceps:1', sets: 3, reps: '10-12' },
  { name: 'Curl poulie basse', groups: 'Biceps:1, Avant-bras:0.3', sets: 3, reps: '12-15' },
  { name: 'Curl inversé (prise pronation)', groups: 'Avant-bras:1, Biceps:0.6', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (corde)', groups: 'Triceps:1', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (barre droite)', groups: 'Triceps:1', sets: 4, reps: '12' },
  { name: 'Extensions triceps au-dessus de la tête (poulie)', groups: 'Triceps:1', sets: 3, reps: '12' },
  { name: 'Barre au front (skull crusher)', groups: 'Triceps:1', sets: 3, reps: '10-12' },
  { name: 'Kickback triceps', groups: 'Triceps:1', sets: 3, reps: '12-15' },
  { name: 'Flexions de poignets (wrist curl)', groups: 'Avant-bras:1', sets: 3, reps: '15-20' },

  // ── Jambes ────────────────────────────────────────────────────────────────
  { name: 'Squat barre arrière', groups: 'Quadriceps:1, Fessiers:0.8, Lombaires:0.5, Ischios:0.4, Abdos/Core:0.4', sets: 4, reps: '6-8' },
  { name: 'Squat guidé', groups: 'Quadriceps:1, Fessiers:0.7, Ischios:0.3', sets: 4, reps: '8' },
  { name: 'Box squat (ou goblet squat)', groups: 'Quadriceps:1, Fessiers:0.8, Ischios:0.4, Abdos/Core:0.3', sets: 3, reps: '10' },
  { name: 'Goblet squat tempo', groups: 'Quadriceps:1, Fessiers:0.6, Abdos/Core:0.4', sets: 3, reps: '10' },
  { name: 'Front squat', groups: 'Quadriceps:1, Abdos/Core:0.5, Fessiers:0.5', sets: 3, reps: '8' },
  { name: 'Presse à cuisses pieds hauts', groups: 'Fessiers:1, Ischios:0.7, Quadriceps:0.6', sets: 3, reps: '10-12' },
  { name: 'Presse à cuisses (pieds standard)', groups: 'Quadriceps:1, Fessiers:0.6, Ischios:0.3', sets: 4, reps: '10-12' },
  { name: 'Fentes marchées haltères', groups: 'Quadriceps:1, Fessiers:0.8, Ischios:0.4', sets: 3, reps: '12/jambe' },
  { name: 'Fentes bulgares', groups: 'Quadriceps:1, Fessiers:0.9, Ischios:0.4', sets: 3, reps: '10/jambe' },
  { name: 'Step-up sur banc', groups: 'Quadriceps:1, Fessiers:0.8, Mollets:0.3', sets: 3, reps: '12/jambe' },
  { name: 'Leg extension (machine)', groups: 'Quadriceps:1', sets: 3, reps: '15' },
  { name: 'Leg curl allongé ou assis', groups: 'Ischios:1, Mollets:0.3', sets: 3, reps: '12' },
  { name: 'Good morning', groups: 'Ischios:1, Lombaires:0.8, Fessiers:0.6', sets: 3, reps: '10' },
  { name: 'Hip thrust (barre ou machine)', groups: 'Fessiers:1, Ischios:0.5', sets: 4, reps: '10-12' },
  { name: 'Abducteurs (machine)', groups: 'Fessiers:1', sets: 3, reps: '15' },
  { name: 'Adducteurs (machine)', groups: 'Adducteurs:1', sets: 3, reps: '15' },
  { name: 'Mollets debout (machine)', groups: 'Mollets:1', sets: 4, reps: '15-20' },
  { name: 'Mollets assis (machine)', groups: 'Mollets:1', sets: 4, reps: '15-20' },
  { name: 'Mollets à la presse', groups: 'Mollets:1', sets: 4, reps: '12-15' },
  { name: 'Terminal knee extensions (élastique)', groups: 'Quadriceps:1', sets: 3, reps: '15' },

  // ── Core ──────────────────────────────────────────────────────────────────
  { name: 'Deadbug', groups: 'Abdos/Core:1', sets: 3, reps: '10' },
  { name: 'Planche frontale', groups: 'Abdos/Core:1, Épaules:0.3', sets: 3, reps: '45 s' },
  { name: 'Planche latérale', groups: 'Abdos/Core:1, Épaules:0.3', sets: 3, reps: '45 s/côté' },
  { name: 'Bird-dog', groups: 'Abdos/Core:1, Lombaires:0.5, Fessiers:0.3', sets: 3, reps: '8/côté' },
  { name: 'Crunch machine (abdos)', groups: 'Abdos/Core:1', sets: 3, reps: '15' },
  { name: 'Relevés de genoux suspendu', groups: 'Abdos/Core:1, Avant-bras:0.4', sets: 3, reps: '12-15' },
  { name: 'Roulette abdominale (ab wheel)', groups: 'Abdos/Core:1, Dos:0.4, Épaules:0.3', sets: 3, reps: '10' },
  { name: 'Pallof press', groups: 'Abdos/Core:1', sets: 3, reps: '12/côté' },
  { name: 'Torso rotation (machine)', groups: 'Abdos/Core:1', sets: 3, reps: '12/côté' },
  { name: 'Russian twist', groups: 'Abdos/Core:1', sets: 3, reps: '20/côté' },
  { name: 'Mountain climbers', groups: 'Abdos/Core:1, Épaules:0.4, Cardio:0.5', sets: 3, reps: '30 s' },

  // ── Fonctionnel / béhourd ────────────────────────────────────────────────
  { name: 'Farmer’s walk', groups: 'Avant-bras:1, Trapèzes:0.8, Abdos/Core:0.6, Quadriceps:0.4, Fessiers:0.4', sets: 4, reps: '30 m' },
  { name: 'Suitcase carry (haltère 1 main)', groups: 'Abdos/Core:1, Avant-bras:0.8, Trapèzes:0.5', sets: 3, reps: '30 m/côté' },
  { name: 'Kettlebell swing', groups: 'Fessiers:1, Ischios:0.8, Lombaires:0.5, Abdos/Core:0.5', sets: 4, reps: '15' },
  { name: 'Turkish get-up', groups: 'Abdos/Core:1, Épaules:0.8, Quadriceps:0.4', sets: 3, reps: '5/côté' },
  { name: 'Burpees', groups: 'Cardio:1, Quadriceps:0.6, Pectoraux:0.5, Abdos/Core:0.5', sets: 4, reps: '10' },
  { name: 'Box jumps', groups: 'Quadriceps:1, Mollets:0.7, Fessiers:0.6', sets: 3, reps: '10' },
  { name: 'Slam ball', groups: 'Abdos/Core:1, Épaules:0.7, Dos:0.5, Cardio:0.6', sets: 4, reps: '12' },
  { name: 'Traîneau poussé (prowler)', groups: 'Quadriceps:1, Fessiers:0.8, Mollets:0.6, Cardio:0.7', sets: 4, reps: '20 m' },
  { name: 'Battle ropes ou rameur sprint', groups: 'Épaules:1, Cardio:0.8, Abdos/Core:0.5, Avant-bras:0.5', sets: 4, reps: '30 s' },

  // ── Natation ──────────────────────────────────────────────────────────────
  { name: 'Crawl (nage libre)', groups: 'Dos:1, Épaules:0.8, Cardio:0.8, Triceps:0.5, Abdos/Core:0.5', sets: 1, reps: '20 min' },
  { name: 'Brasse', groups: 'Pectoraux:1, Cardio:0.8, Adducteurs:0.7, Dos:0.5', sets: 1, reps: '20 min' },
  { name: 'Dos crawlé', groups: 'Dos:1, Épaules:0.7, Cardio:0.7', sets: 1, reps: '15 min' },
  { name: 'Papillon', groups: 'Épaules:1, Pectoraux:0.8, Dos:0.7, Abdos/Core:0.5', sets: 1, reps: '10 min' },
  { name: 'Jambes avec planche (natation)', groups: 'Quadriceps:1, Fessiers:0.6, Mollets:0.5', sets: 4, reps: '50 m' },
  { name: 'Pull buoy (bras seuls)', groups: 'Dos:1, Épaules:0.6, Triceps:0.5', sets: 4, reps: '50 m' },
  { name: 'Nage avec plaquettes', groups: 'Dos:1, Épaules:0.8, Pectoraux:0.5', sets: 4, reps: '50 m' },
  { name: 'Nage en eau libre', groups: 'Dos:1, Cardio:0.9, Épaules:0.7', sets: 1, reps: '30 min' },
  { name: 'Aquagym / marche aquatique', groups: 'Cardio:1, Quadriceps:0.4', sets: 1, reps: '30 min' },

  // ── Course ────────────────────────────────────────────────────────────────
  { name: 'Course à pied — endurance (zone 2)', groups: 'Cardio:1, Mollets:1, Quadriceps:0.7, Ischios:0.7, Fessiers:0.5', sets: 1, reps: '30 min' },
  { name: 'Fractionné 30/30', groups: 'Cardio:1, Mollets:0.8, Quadriceps:0.7, Ischios:0.6', sets: 10, reps: '30 s' },
  { name: 'Sprints en côte', groups: 'Quadriceps:1, Fessiers:0.9, Cardio:0.8, Mollets:0.8', sets: 8, reps: '20 s' },
  { name: 'Trail / sentier', groups: 'Quadriceps:1, Mollets:0.8, Cardio:0.8, Ischios:0.6, Fessiers:0.6', sets: 1, reps: '45 min' },
  { name: 'Marche rapide / randonnée', groups: 'Cardio:0.6, Mollets:0.6, Quadriceps:0.5, Fessiers:0.4', sets: 1, reps: '60 min' },
  { name: 'Rucking (rando avec sac lesté)', groups: 'Cardio:0.7, Quadriceps:0.7, Fessiers:0.7, Trapèzes:0.6, Mollets:0.6, Abdos/Core:0.5', sets: 1, reps: '45 min' },
  { name: 'Corde à sauter', groups: 'Mollets:1, Cardio:0.8, Avant-bras:0.3', sets: 5, reps: '2 min' },
  { name: 'Sprint / pliométrie sur herbe', groups: 'Quadriceps:1, Ischios:0.9, Mollets:0.8, Fessiers:0.7', sets: 6, reps: '30 m' },

  // ── Bois & extérieur ─────────────────────────────────────────────────────
  { name: 'Fendre du bois (hache)', groups: 'Dos:0.8, Abdos/Core:0.8, Épaules:0.7, Avant-bras:0.7, Fessiers:0.6, Lombaires:0.5', sets: 4, reps: '20 coups' },
  { name: 'Sciage manuel (bûche)', groups: 'Dos:1, Avant-bras:0.8, Biceps:0.6, Pectoraux:0.4', sets: 3, reps: '5 min' },
  { name: 'Portage de bûches', groups: 'Avant-bras:1, Trapèzes:0.8, Abdos/Core:0.7, Quadriceps:0.5', sets: 4, reps: '50 m' },
  { name: 'Empilage / rangement de bois', groups: 'Lombaires:0.6, Quadriceps:0.6, Fessiers:0.6, Abdos/Core:0.5', sets: 1, reps: '20 min' },
  { name: 'Débitage / tronçonnage', groups: 'Avant-bras:0.8, Épaules:0.6, Abdos/Core:0.6, Lombaires:0.5', sets: 1, reps: '30 min' },
  { name: 'Débroussaillage / élagage', groups: 'Épaules:1, Avant-bras:0.7, Abdos/Core:0.5', sets: 1, reps: '30 min' },
  { name: 'Vélo / VTT', groups: 'Quadriceps:1, Cardio:0.9, Fessiers:0.6, Mollets:0.5', sets: 1, reps: '45 min' },
  { name: 'Kayak / aviron sur l’eau', groups: 'Dos:1, Abdos/Core:0.7, Épaules:0.7, Cardio:0.7, Biceps:0.6', sets: 1, reps: '40 min' },
  { name: 'Escalade / bloc', groups: 'Dos:1, Avant-bras:1, Biceps:0.7, Abdos/Core:0.6', sets: 1, reps: '60 min' },
  { name: 'Jardinage (bêchage)', groups: 'Lombaires:0.7, Dos:0.6, Fessiers:0.6, Avant-bras:0.5', sets: 1, reps: '45 min' },
  { name: 'Slackline / travail d’équilibre', groups: 'Abdos/Core:1, Mollets:0.6, Quadriceps:0.5', sets: 3, reps: '5 min' },
  { name: 'Étirement fléchisseurs de hanche (fente basse)', groups: 'Fessiers:0.4', sets: 2, reps: '45 s/côté' },
]
