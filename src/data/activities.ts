// Activités hors salle : natation, course, travail du bois, extérieur.
// Ajoutées automatiquement au catalogue de chaque utilisateur (voir
// ensureSeeded dans lib/muscu.ts). Les consignes tiennent compte des
// contraintes récurrentes : épaule droite (disjonction AC), rotules
// (dysplasie), bassin en antéversion.

export interface ActivityTemplate {
  name: string
  muscle_group: string
  sets: number
  reps: string // durée (« 30 min »), distance (« 50 m ») ou répétitions
  notes: string
}

export const OUTDOOR_ACTIVITIES: ActivityTemplate[] = [
  // ── 🏊 Natation ───────────────────────────────────────────────────────────
  { name: 'Crawl (nage libre)', muscle_group: 'Haut du corps (global)', sets: 1, reps: '20 min', notes: 'Dos + épaules + gainage. Roulis des épaules, respiration 3 temps.' },
  { name: 'Brasse', muscle_group: 'Haut du corps (global)', sets: 1, reps: '20 min', notes: 'Pectoraux + adducteurs. Mouvement symétrique : doux pour l’épaule droite.' },
  { name: 'Dos crawlé', muscle_group: 'Dos', sets: 1, reps: '15 min', notes: 'Ouvre la cage thoracique — excellent contre l’épaule tombante.' },
  { name: 'Papillon', muscle_group: 'Épaules', sets: 1, reps: '10 min', notes: '⚠️ AC droite : très exigeant pour l’épaule, à écarter à la moindre douleur.' },
  { name: 'Jambes avec planche (natation)', muscle_group: 'Jambes (global)', sets: 4, reps: '50 m', notes: 'Quadriceps + fessiers sans aucun impact — idéal rotules.' },
  { name: 'Pull buoy (bras seuls)', muscle_group: 'Dos', sets: 4, reps: '50 m', notes: 'Isole le haut du corps, jambes au repos.' },
  { name: 'Nage avec plaquettes', muscle_group: 'Dos', sets: 4, reps: '50 m', notes: '⚠️ AC droite : augmente nettement la charge sur l’épaule, à doser.' },
  { name: 'Nage en eau libre', muscle_group: 'Haut du corps (global)', sets: 1, reps: '30 min', notes: 'Endurance + thermorégulation. Repères visuels réguliers.' },
  { name: 'Aquagym / marche aquatique', muscle_group: 'Cardio', sets: 1, reps: '30 min', notes: 'Récupération active sans impact.' },

  // ── 🏃 Course ─────────────────────────────────────────────────────────────
  { name: 'Course à pied — endurance (zone 2)', muscle_group: 'Jambes (global)', sets: 1, reps: '30 min', notes: 'Allure conversation. Charge = ton poids de corps à chaque foulée.' },
  { name: 'Fractionné 30/30', muscle_group: 'Cardio', sets: 10, reps: '30 s', notes: 'Cardio anaérobie — proche de l’effort d’un round de béhourd.' },
  { name: 'Sprints en côte', muscle_group: 'Jambes (global)', sets: 8, reps: '20 s', notes: 'Puissance jambes avec moins d’impact rotulien qu’à plat.' },
  { name: 'Trail / sentier', muscle_group: 'Jambes (global)', sets: 1, reps: '45 min', notes: '⚠️ Rotules : la descente est très excentrique — raccourcir la foulée.' },
  { name: 'Marche rapide / randonnée', muscle_group: 'Jambes (global)', sets: 1, reps: '60 min', notes: 'Zone 2 sans impact. Parfait en récupération.' },
  { name: 'Rucking (rando avec sac lesté)', muscle_group: 'Jambes (global)', sets: 1, reps: '45 min', notes: 'Simule le port du harnois. Sac 10-15 kg, dos droit, ceinture serrée.' },
  { name: 'Corde à sauter', muscle_group: 'Mollets', sets: 5, reps: '2 min', notes: '⚠️ Rotules : réception amortie sur l’avant du pied.' },

  // ── 🪓 Travail du bois ────────────────────────────────────────────────────
  { name: 'Fendre du bois (hache)', muscle_group: 'Full body', sets: 4, reps: '20 coups', notes: 'Chaîne postérieure + core + grip — le geste le plus proche du béhourd. Jambes fléchies, rotation contrôlée, alterner les côtés.' },
  { name: 'Sciage manuel (bûche)', muscle_group: 'Dos', sets: 3, reps: '5 min', notes: 'Tirage horizontal + endurance de préhension. Alterner les bras.' },
  { name: 'Portage de bûches', muscle_group: 'Full body', sets: 4, reps: '50 m', notes: 'Farmer’s walk naturel : charge près du corps, dos droit, gainage.' },
  { name: 'Empilage / rangement de bois', muscle_group: 'Full body', sets: 1, reps: '20 min', notes: 'Squats et hinges répétés. Plier les jambes, jamais le dos (antéversion).' },
  { name: 'Débitage / tronçonnage', muscle_group: 'Full body', sets: 1, reps: '30 min', notes: 'Port de charge + gainage prolongé. Pauses régulières.' },
  { name: 'Débroussaillage / élagage', muscle_group: 'Épaules', sets: 1, reps: '30 min', notes: '⚠️ AC droite : bras en l’air prolongé — alterner les côtés souvent.' },

  // ── 🌳 Autres activités d’extérieur ───────────────────────────────────────
  { name: 'Vélo / VTT', muscle_group: 'Jambes (global)', sets: 1, reps: '45 min', notes: 'Sans impact — le meilleur cardio pour des rotules sensibles.' },
  { name: 'Kayak / aviron sur l’eau', muscle_group: 'Dos', sets: 1, reps: '40 min', notes: 'Tirage + rotation du tronc, gainage constant.' },
  { name: 'Escalade / bloc', muscle_group: 'Dos', sets: 1, reps: '60 min', notes: 'Grip + dos + biceps, au poids du corps. ⚠️ AC droite : éviter les grands jetés.' },
  { name: 'Jardinage (bêchage)', muscle_group: 'Full body', sets: 1, reps: '45 min', notes: 'Hinge répété sous charge légère. Dos droit, fessiers serrés.' },
  { name: 'Sprint / pliométrie sur herbe', muscle_group: 'Jambes (global)', sets: 6, reps: '30 m', notes: 'Sol souple = impact rotulien réduit. Au poids du corps.' },
  { name: 'Slackline / travail d’équilibre', muscle_group: 'Abdos/Core', sets: 3, reps: '5 min', notes: 'Proprioception + gainage profond — la stabilité utile en armure.' },
]
