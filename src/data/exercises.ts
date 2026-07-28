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
  { name: 'Développé couché', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.5', sets: 4, reps: '8' },
  { name: 'Développé couché haltères', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.5', sets: 4, reps: '8-10', notes: 'Trajectoire libre : plus doux pour l’épaule droite que la barre.' },
  { name: 'Développé incliné barre', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps:0.4', sets: 4, reps: '8-10' },
  { name: 'Développé couché incliné haltères', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.6, Triceps:0.4', sets: 3, reps: '10-12' },
  { name: 'Développé décliné', groups: 'Pectoraux:1, Triceps:0.5', sets: 3, reps: '10' },
  { name: 'Écarté haltères', groups: 'Grand pectoral:1, Deltoïde antérieur:0.3', sets: 3, reps: '12', notes: '⚠️ AC droite : ne pas descendre les coudes sous la ligne du buste.' },
  { name: 'Écarté à la poulie', groups: 'Pectoraux:1, Épaules:0.3', sets: 3, reps: '12-15' },
  { name: 'Écarté à la machine (pec deck)', groups: 'Grand pectoral:1, Deltoïde antérieur:0.3', sets: 3, reps: '12-15' },
  { name: 'Développé pectoraux à la machine', groups: 'Grand pectoral:1, Triceps:0.5, Deltoïde antérieur:0.4', sets: 3, reps: '10-12' },
  { name: 'Développé incliné à la machine', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.5, Triceps:0.4', sets: 4, reps: '12' },
  { name: 'Développé incliné convergent (machine)', groups: 'Pectoral supérieur:1, Deltoïde antérieur:0.5, Triceps:0.4', sets: 4, reps: '10' },
  { name: 'Développé incliné convergent (charges libres)', groups: 'Pectoraux:1, Épaules:0.5, Triceps:0.4', sets: 3, reps: '10' },
  { name: 'Pompes', groups: 'Pectoraux:1, Triceps:0.6, Épaules:0.4, Abdos/Core:0.3', sets: 4, reps: '15' },
  { name: 'Pompes déclinées', groups: 'Pectoraux:1, Épaules:0.6, Triceps:0.5, Abdos/Core:0.4', sets: 3, reps: '12' },
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
  { name: 'Suspension à la barre', groups: 'Avant-bras:1, Grand dorsal:0.5, Deltoïde postérieur:0.3', sets: 3, reps: '30 s' },

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
  { name: 'Extensions triceps poulie haute (corde)', groups: 'Triceps:1', sets: 3, reps: '12' },
  { name: 'Extensions triceps poulie haute (barre droite)', groups: 'Triceps:1', sets: 4, reps: '12' },
  { name: 'Extensions triceps au-dessus de la tête (poulie)', groups: 'Triceps:1', sets: 3, reps: '12' },
  { name: 'Barre au front', groups: 'Triceps:1', sets: 3, reps: '10-12' },
  { name: 'Extension triceps buste penché', groups: 'Triceps:1', sets: 3, reps: '12-15' },
  { name: 'Flexions de poignets', groups: 'Avant-bras:1', sets: 3, reps: '15-20' },

  // ── Jambes ────────────────────────────────────────────────────────────────
  { name: 'Squat barre arrière', groups: 'Quadriceps:1, Grand fessier:0.8, Érecteurs du rachis:0.5, Ischios:0.4, Grand droit:0.4', sets: 4, reps: '6-8' },
  { name: 'Squat guidé', groups: 'Quadriceps:1, Grand fessier:0.7', sets: 4, reps: '8' },
  { name: 'Squat sur box (ou squat gobelet)', groups: 'Quadriceps:1, Grand fessier:0.8, Ischios:0.4', sets: 3, reps: '10' },
  { name: 'Squat gobelet en tempo', groups: 'Quadriceps:1, Grand fessier:0.6, Grand droit:0.4', sets: 3, reps: '10' },
  { name: 'Squat barre devant', groups: 'Droit fémoral:1, Vaste latéral:0.8, Vaste médial:0.8, Grand droit:0.5, Grand fessier:0.5', sets: 3, reps: '8' },
  { name: 'Presse à cuisses pieds hauts', groups: 'Grand fessier:1, Ischios:0.7, Quadriceps:0.6', sets: 3, reps: '10-12' },
  { name: 'Presse à cuisses (pieds standard)', groups: 'Vaste latéral:1, Vaste médial:0.9, Droit fémoral:0.7, Grand fessier:0.5', sets: 4, reps: '10-12' },
  { name: 'Fentes marchées haltères', groups: 'Quadriceps:1, Grand fessier:0.8, Moyen fessier:0.5, Ischios:0.4', sets: 3, reps: '12/jambe' },
  { name: 'Fentes bulgares', groups: 'Quadriceps:1, Grand fessier:0.9, Moyen fessier:0.5', sets: 3, reps: '10/jambe' },
  { name: 'Montée sur banc', groups: 'Quadriceps:1, Grand fessier:0.8, Moyen fessier:0.4', sets: 3, reps: '12/jambe' },
  { name: 'Extension des jambes à la machine', groups: 'Droit fémoral:1, Vaste latéral:0.8, Vaste médial:0.8', sets: 3, reps: '15' },
  { name: 'Flexion des ischios à la machine', groups: 'Biceps fémoral:1, Ischios internes:0.9, Gastrocnémiens:0.3', sets: 3, reps: '12' },
  { name: 'Flexion du buste barre au dos', groups: 'Ischios:1, Érecteurs du rachis:0.8, Grand fessier:0.6', sets: 3, reps: '10' },
  { name: 'Poussée de hanches (barre ou machine)', groups: 'Grand fessier:1, Ischios:0.5', sets: 4, reps: '10-12' },
  { name: 'Abducteurs (machine)', groups: 'Moyen fessier:1', sets: 3, reps: '15' },
  { name: 'Adducteurs (machine)', groups: 'Adducteurs:1', sets: 3, reps: '15' },
  { name: 'Mollets debout (machine)', groups: 'Gastrocnémiens:1, Soléaire:0.5', sets: 4, reps: '15-20' },
  { name: 'Mollets assis (machine)', groups: 'Soléaire:1, Gastrocnémiens:0.4', sets: 4, reps: '15-20' },
  { name: 'Mollets à la presse', groups: 'Gastrocnémiens:1, Soléaire:0.6', sets: 4, reps: '12-15' },
  { name: 'Extension terminale du genou (élastique)', groups: 'Vaste médial:1', sets: 3, reps: '15' },

  // ── Core ──────────────────────────────────────────────────────────────────
  { name: 'Deadbug (gainage bras-jambes alternés)', groups: 'Abdos/Core:1', sets: 3, reps: '10' },
  { name: 'Planche frontale', groups: 'Abdos/Core:1, Épaules:0.3', sets: 3, reps: '45 s' },
  { name: 'Planche latérale', groups: 'Obliques:1, Abdos/Core:0.6, Épaules:0.3', sets: 3, reps: '45 s/côté' },
  { name: 'Bird-dog (gainage croisé)', groups: 'Abdos/Core:1, Lombaires:0.5, Fessiers:0.3', sets: 3, reps: '8/côté' },
  { name: 'Crunch à la machine', groups: 'Abdos/Core:1', sets: 3, reps: '15' },
  { name: 'Relevés de genoux suspendu', groups: 'Abdos/Core:1, Avant-bras:0.4', sets: 3, reps: '12-15' },
  { name: 'Roulette abdominale', groups: 'Abdos/Core:1, Dos:0.4, Épaules:0.3', sets: 3, reps: '10' },
  { name: 'Anti-rotation à la poulie (Pallof)', groups: 'Abdos/Core:1, Obliques:0.8', sets: 3, reps: '12/côté' },
  { name: 'Rotation du buste à la machine', groups: 'Obliques:1, Abdos/Core:0.6', sets: 3, reps: '12/côté' },
  { name: 'Rotations russes', groups: 'Obliques:1, Abdos/Core:0.7', sets: 3, reps: '20/côté' },
  { name: 'Grimpeurs au sol', groups: 'Abdos/Core:1, Épaules:0.4, Cardio:0.5', sets: 3, reps: '30 s' },

  // ── Fonctionnel / béhourd ────────────────────────────────────────────────
  { name: 'Extensions cervicales (élastique)', groups: 'Cou:1', sets: 3, reps: '15', notes: 'Amplitude contrôlée, sans à-coup. Renforce la nuque — prévention commotion sous heaume.' },
  { name: 'Pont cervical (front bridge)', groups: 'Cou:1, Trapèzes:0.4', sets: 3, reps: '30 s', notes: 'Isométrique doux, appui sur un tapis. Progresser très lentement en durée.' },
  { name: 'Flexions latérales de nuque', groups: 'Cou:1', sets: 3, reps: '12/côté', notes: 'Résistance manuelle légère. Essentiel pour encaisser les frappes latérales.' },
  { name: 'Marche du fermier', groups: 'Avant-bras:1, Trapèze supérieur:0.8, Obliques:0.6, Grand droit:0.5, Quadriceps:0.4', sets: 4, reps: '30 m' },
  { name: 'Port valise (haltère à une main)', groups: 'Obliques:1, Abdos/Core:0.8, Avant-bras:0.8, Trapèzes:0.5', sets: 3, reps: '30 m/côté' },
  { name: 'Balancier à la kettlebell', groups: 'Fessiers:1, Ischios:0.8, Lombaires:0.5, Abdos/Core:0.5', sets: 4, reps: '15' },
  { name: 'Relevé turc', groups: 'Abdos/Core:1, Épaules:0.8, Quadriceps:0.4', sets: 3, reps: '5/côté' },
  { name: 'Burpees', groups: 'Cardio:1, Quadriceps:0.6, Pectoraux:0.5, Abdos/Core:0.5', sets: 4, reps: '10' },
  { name: 'Sauts sur box', groups: 'Quadriceps:1, Mollets:0.7, Fessiers:0.6', sets: 3, reps: '10' },
  { name: 'Lancer de ballon lesté', groups: 'Abdos/Core:1, Obliques:0.7, Épaules:0.7, Dos:0.5, Cardio:0.6', sets: 4, reps: '12' },
  { name: 'Traîneau poussé', groups: 'Quadriceps:1, Fessiers:0.8, Mollets:0.6, Cardio:0.7', sets: 4, reps: '20 m' },
  { name: 'Cordes ondulatoires ou rameur en sprint', groups: 'Épaules:1, Cardio:0.8, Abdos/Core:0.5, Avant-bras:0.5', sets: 4, reps: '30 s' },

  // ── Natation ──────────────────────────────────────────────────────────────
  { name: 'Crawl (nage libre)', groups: 'Dos:1, Épaules:0.8, Cardio:0.8, Triceps:0.5, Abdos/Core:0.5', sets: 1, reps: '20 min' },
  { name: 'Brasse', groups: 'Pectoraux:1, Cardio:0.8, Adducteurs:0.7, Dos:0.5', sets: 1, reps: '20 min' },
  { name: 'Dos crawlé', groups: 'Dos:1, Épaules:0.7, Cardio:0.7', sets: 1, reps: '15 min' },
  { name: 'Papillon', groups: 'Épaules:1, Pectoraux:0.8, Dos:0.7, Abdos/Core:0.5', sets: 1, reps: '10 min' },
  { name: 'Jambes avec planche (natation)', groups: 'Quadriceps:1, Fessiers:0.6, Mollets:0.5', sets: 4, reps: '50 m' },
  { name: 'Nage bras seuls (pull buoy)', groups: 'Dos:1, Épaules:0.6, Triceps:0.5', sets: 4, reps: '50 m' },
  { name: 'Nage avec plaquettes', groups: 'Dos:1, Épaules:0.8, Pectoraux:0.5', sets: 4, reps: '50 m' },
  { name: 'Nage en eau libre', groups: 'Dos:1, Cardio:0.9, Épaules:0.7', sets: 1, reps: '30 min' },
  { name: 'Aquagym / marche aquatique', groups: 'Cardio:1, Quadriceps:0.4', sets: 1, reps: '30 min' },

  // ── Course ────────────────────────────────────────────────────────────────
  { name: 'Course à pied — endurance (zone 2)', groups: 'Cardio:1, Gastrocnémiens:1, Soléaire:0.8, Quadriceps:0.7, Ischios:0.7, Grand fessier:0.5', sets: 1, reps: '30 min' },
  { name: 'Fractionné 30/30', groups: 'Cardio:1, Mollets:0.8, Quadriceps:0.7, Ischios:0.6', sets: 10, reps: '30 s' },
  { name: 'Sprints en côte', groups: 'Quadriceps:1, Grand fessier:0.9, Gastrocnémiens:0.8, Cardio:0.8, Ischios:0.6', sets: 8, reps: '20 s' },
  { name: 'Course en sentier', groups: 'Quadriceps:1, Gastrocnémiens:0.8, Cardio:0.8, Ischios:0.6, Grand fessier:0.6, Tibial antérieur:0.5', sets: 1, reps: '45 min' },
  { name: 'Marche rapide / randonnée', groups: 'Cardio:0.6, Mollets:0.6, Quadriceps:0.5, Fessiers:0.4', sets: 1, reps: '60 min' },
  { name: 'Randonnée avec sac lesté', groups: 'Cardio:0.7, Quadriceps:0.7, Fessiers:0.7, Trapèzes:0.6, Mollets:0.6, Abdos/Core:0.5', sets: 1, reps: '45 min' },
  { name: 'Corde à sauter', groups: 'Gastrocnémiens:1, Soléaire:0.6, Cardio:0.8, Tibial antérieur:0.4', sets: 5, reps: '2 min' },
  { name: 'Sprint / pliométrie sur herbe', groups: 'Quadriceps:1, Ischios:0.9, Mollets:0.8, Fessiers:0.7', sets: 6, reps: '30 m' },

  // ── Bois & extérieur ─────────────────────────────────────────────────────
  { name: 'Fendre du bois (hache)', groups: 'Obliques:0.9, Dos:0.8, Abdos/Core:0.8, Épaules:0.7, Avant-bras:0.7, Fessiers:0.6, Lombaires:0.5', sets: 4, reps: '20 coups' },
  { name: 'Sciage manuel (bûche)', groups: 'Dos:1, Avant-bras:0.8, Biceps:0.6, Pectoraux:0.4', sets: 3, reps: '5 min' },
  { name: 'Portage de bûches', groups: 'Avant-bras:1, Trapèzes:0.8, Abdos/Core:0.7, Quadriceps:0.5', sets: 4, reps: '50 m' },
  { name: 'Empilage / rangement de bois', groups: 'Lombaires:0.6, Quadriceps:0.6, Fessiers:0.6, Abdos/Core:0.5', sets: 1, reps: '20 min' },
  { name: 'Débitage / tronçonnage', groups: 'Avant-bras:0.8, Épaules:0.6, Abdos/Core:0.6, Lombaires:0.5', sets: 1, reps: '30 min' },
  { name: 'Débroussaillage / élagage', groups: 'Épaules:1, Avant-bras:0.7, Abdos/Core:0.5', sets: 1, reps: '30 min' },
  { name: 'Vélo / VTT', groups: 'Quadriceps:1, Cardio:0.9, Fessiers:0.6, Mollets:0.5', sets: 1, reps: '45 min' },
  { name: 'Kayak / aviron sur l’eau', groups: 'Dos:1, Abdos/Core:0.7, Épaules:0.7, Cardio:0.7, Obliques:0.6, Biceps:0.6', sets: 1, reps: '40 min' },
  { name: 'Escalade / bloc', groups: 'Dos:1, Avant-bras:1, Biceps:0.7, Abdos/Core:0.6', sets: 1, reps: '60 min' },
  { name: 'Jardinage (bêchage)', groups: 'Lombaires:0.7, Dos:0.6, Fessiers:0.6, Avant-bras:0.5', sets: 1, reps: '45 min' },
  { name: 'Slackline (travail d’équilibre)', groups: 'Abdos/Core:1, Mollets:0.6, Quadriceps:0.5', sets: 3, reps: '5 min' },
  { name: 'Étirement fléchisseurs de hanche (fente basse)', groups: 'Fessiers:0.4', sets: 2, reps: '45 s/côté' },
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
  'leg curl allongé ou assis': 'Flexion des ischios à la machine',
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
