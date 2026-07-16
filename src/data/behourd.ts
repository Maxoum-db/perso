// ============================================================================
// Données de la section Béhourd (portées depuis le Hub Prométhée — PersoLifestyle).
// 🛡️ Armure · ⚔️ Programme TANK · 💪 Musculation · 📅 Calendriers dédiés
// ============================================================================

export interface Exercise {
  name: string
  sets: number
  reps: string
  weight_pct_1rm: number
  rest_s?: number
  machine: string
  notes: string
}

export interface Session {
  label: string
  color: string
  icon: string
  duration_min: number
  warmup: string
  exercises: Exercise[]
  cooldown: string
}

export interface ArmorPiece {
  slot: string
  icon: string
  typical_weight_kg: number
  must_have: boolean
  owned: boolean
  weight_actual_kg?: number
  notes?: string
  notes_user?: string
  pre_order?: boolean
  expected_delivery?: string
  manufacturer?: string
  product_code?: string
  url?: string
  price_usd?: number
}

export interface EventCategory {
  id: string
  label: string
  color: string
  duration_typ_min: number
  default_recurrence?: string
}

export interface CalendarCfg {
  name: string
  description: string
  recommended_color: string
  event_categories: EventCategory[]
  weekly_recurring?: { day: string; time: string; event: string }[]
}

// ============================================================================
// PROGRAMME TANK BÉHOURD 100kg / 180cm — 3 séances/sem + 1 optionnelle
// ============================================================================
export const TANK_BEHOURD_PROGRAM = {
  description:
    "Programme TANK 3-4 séances/semaine optimisé pour porter armure 38 kg + jouer tank en béhourd. Compound movements simples, focus force + masse + endurance combat.",
  user_profile: {
    poids_kg: 100,
    taille_cm: 180,
    IMC: 30.9,
    classification: 'Surpoids classe I — recomp possible',
    objectif: 'Body recomp (perdre gras + gagner muscle) + préparation tank béhourd',
    duree_programme: '12-16 semaines avant amélioration visible',
  },
  weekly_split: {
    'Lundi (optionnel)': { type: 'Mobilité + technique béhourd sec', duration_min: 45, intensity: 'léger' },
    Mardi: { type: 'Séance A — Force Lower + Push', duration_min: 60, intensity: 'élevée' },
    Mercredi: { type: 'Repos / récup active (marche 30 min)', duration_min: 0, intensity: '—' },
    Jeudi: { type: 'Séance B — Force Upper + Pull', duration_min: 60, intensity: 'élevée' },
    Vendredi: { type: 'Séance C — Conditioning Tank (HIIT armuré simulé)', duration_min: 50, intensity: 'modérée à élevée' },
    Samedi: { type: '⚔️ BÉHOURD CLUB — entraînement technique + sparring', duration_min: 120, intensity: 'élevée' },
    Dimanche: { type: 'Repos total + récup', duration_min: 0, intensity: '—' },
  } as Record<string, { type: string; duration_min: number; intensity: string }>,
  sessions: {
    mardi_A: {
      label: 'MARDI — Séance A : Force Lower + Push',
      color: '#DC2626',
      icon: '🦵',
      duration_min: 60,
      warmup: '10 min vélo intensité légère + mobilité hanches/épaules (cercles bras, fentes dynamiques)',
      exercises: [
        { name: 'Squat barre arrière', sets: 4, reps: '6-8', weight_pct_1rm: 75, rest_s: 120, machine: 'Cage squat + barre olympique', notes: 'CŒUR DU PROGRAMME. Profondeur cuisses parallèles. Pieds largeur épaules. Si débutant : commencer avec barre seule (20 kg) puis +5 kg/séance.' },
        { name: 'Développé militaire (Overhead Press)', sets: 3, reps: '6-8', weight_pct_1rm: 65, rest_s: 90, machine: 'Cage squat + barre OU haltères', notes: 'Critique pour porter heaume + spallières. Gainage abdo, pas de cambré.' },
        { name: 'Soulevé de terre roumain (RDL)', sets: 3, reps: '8', weight_pct_1rm: 70, rest_s: 90, machine: 'Barre olympique', notes: 'Chaîne postérieure (fessiers + ischios). Dos plat, hanches en arrière.' },
        { name: 'Presse à cuisses 45° (ou Goblet squat)', sets: 3, reps: '10-12', weight_pct_1rm: 70, rest_s: 60, machine: 'Presse 45° OU haltère 25 kg', notes: 'Volume jambes complémentaire. Phase excentrique lente 2s.' },
        { name: 'Élévations latérales haltères', sets: 3, reps: '12-15', weight_pct_1rm: 50, rest_s: 60, machine: 'Haltères 5-10 kg', notes: 'Deltoïdes — port harnois = épaules très sollicitées.' },
        { name: 'Planche frontale', sets: 3, reps: '45-60s', weight_pct_1rm: 0, rest_s: 45, machine: 'Tapis', notes: 'Gainage isométrique. Bassin neutre.' },
      ],
      cooldown: '5 min étirements doux (quadriceps, ischios, fessiers, épaules)',
    },
    jeudi_B: {
      label: 'JEUDI — Séance B : Force Upper + Pull',
      color: '#0891B2',
      icon: '🦾',
      duration_min: 60,
      warmup: '10 min rameur intensité légère + mobilité épaules/cervicales (rotations bras, étirements pec doorway)',
      exercises: [
        { name: 'Soulevé de terre conventionnel', sets: 4, reps: '5', weight_pct_1rm: 80, rest_s: 180, machine: 'Barre olympique + disques', notes: 'EXERCICE ROI. Force globale + dos massif (tank). Dos plat, barre proche du corps. Commencer 60-80 kg, +5 kg/sem si correcte forme.' },
        { name: 'Tractions pronation (ou tirage vertical)', sets: 4, reps: '6-10', weight_pct_1rm: 100, rest_s: 90, machine: 'Barre traction + assistance OU machine tirage', notes: 'Si < 6 reps tractions : assistance machine 30-40 kg ou élastiques. Cible grand dorsal.' },
        { name: 'Développé couché incliné haltères', sets: 3, reps: '8-10', weight_pct_1rm: 65, rest_s: 90, machine: 'Banc inclinable 30° + haltères', notes: 'Pecs supérieurs + épaules. Trajectoire en cloche. Coudes 45°.' },
        { name: 'Rowing barre buste penché', sets: 3, reps: '10', weight_pct_1rm: 65, rest_s: 90, machine: 'Barre olympique', notes: 'Dos épais (signature tank). Buste 45°, tirage vers nombril, squeeze omoplates.' },
        { name: 'Curl haltères marteau (prise neutre)', sets: 3, reps: '10-12', weight_pct_1rm: 55, rest_s: 60, machine: 'Haltères', notes: 'Biceps + brachial — préhension arme/bouclier. Pas de balancier.' },
        { name: 'Face pulls poulie haute', sets: 3, reps: '15', weight_pct_1rm: 40, rest_s: 60, machine: 'Poulie haute + corde', notes: 'Deltoïdes postérieurs + trapèzes moyens. Anti-round-shoulder. Critique pour port harnois.' },
      ],
      cooldown: '5 min étirements (dos, biceps, épaules, pecs)',
    },
    vendredi_C: {
      label: 'VENDREDI — Séance C : Conditioning Tank (HIIT armuré simulé)',
      color: '#7C3AED',
      icon: '⚔️',
      duration_min: 50,
      warmup: '10 min échauffement progressif : vélo + jumping jacks + mobilité dynamique',
      exercises: [
        { name: "Farmer's walk (port armure simulé)", sets: 4, reps: '30 m', weight_pct_1rm: 60, rest_s: 90, machine: 'Haltères 25-35 kg/main OU trap bar', notes: 'SIMULE LE PORT HARNOIS. Marche lente, dos droit, gainage. Cible : 4×30m.' },
        { name: 'Goblet squat tempo', sets: 3, reps: '12', weight_pct_1rm: 50, rest_s: 60, machine: 'Haltère 20-25 kg ou kettlebell', notes: 'Tempo 3s descente, 1s pause bas, 1s remontée. Brûle quad + core sous charge.' },
        { name: 'Push press (épaulé-jeté ou OHP explosif)', sets: 3, reps: '6-8', weight_pct_1rm: 60, rest_s: 90, machine: 'Barre olympique', notes: 'PUISSANCE EXPLOSIVE. Légère flexion jambes + extension violente pour pousser barre au-dessus. Reproduit frappe béhourd.' },
        { name: 'Battle ropes ou Burpees', sets: 4, reps: '30s on / 30s off', weight_pct_1rm: 0, rest_s: 30, machine: 'Cordes ou tapis', notes: 'Cardio anaérobie pur. Simule round 3 min combat béhourd. Si pas de cordes : burpees ou mountain climbers.' },
        { name: 'Box jumps (ou step-up haltères)', sets: 3, reps: '10', weight_pct_1rm: 0, rest_s: 60, machine: 'Box 40-60 cm OU step + haltères 10 kg', notes: 'Explosivité jambes. Réception genoux fléchis, descente contrôlée.' },
        { name: 'Circuit core gainage 3 positions', sets: 3, reps: '45s par position', weight_pct_1rm: 0, rest_s: 30, machine: 'Tapis', notes: 'Planche frontale → planche latérale G → planche latérale D. Pas de pause entre positions.' },
      ],
      cooldown: '10 min stretching complet (hanches, ischios, épaules, dos lombaire) + 5 min respiration cohérente',
    },
    lundi_optionnel: {
      label: 'LUNDI (optionnel) — Mobilité + technique béhourd',
      color: '#16A34A',
      icon: '🧘',
      duration_min: 45,
      warmup: '5 min cardio léger (corde à sauter ou marche rapide)',
      exercises: [
        { name: 'Yoga / flow mobilité', sets: 1, reps: '20 min', weight_pct_1rm: 0, rest_s: 0, machine: 'Tapis', notes: 'Focus épaules (poses cobra, dolphin), hanches (pigeon, malasana), cervicales. CRUCIAL pour endurer harnois sans douleur.' },
        { name: 'Drills technique béhourd sec (sans contact)', sets: 3, reps: '3 min', weight_pct_1rm: 0, rest_s: 60, machine: 'Bouclier + arme (sans armure ou avec gambeson)', notes: 'Frappes à vide enchaînées : 1-2-3 alternance bouclier/arme. Travail du timing + footwork.' },
        { name: 'Cardio Zone 2 (60-70% FCmax)', sets: 1, reps: '15 min', weight_pct_1rm: 0, rest_s: 0, machine: 'Vélo / rameur / marche rapide', notes: 'Endurance fondamentale. Améliore récup entre rounds combat. Doit pouvoir parler en continu.' },
      ],
      cooldown: '5 min étirements ciblés selon courbatures de la semaine',
    },
  } as Record<string, Session>,
  nutrition: {
    objectif_macro: 'Body recomp gras → muscle (déficit calorique léger + protéines élevées)',
    calories_jour: '≈ 2400-2600 kcal (-300 vs maintenance) — perte 1.5 kg/mois sans perdre muscle',
    proteines_g_jour: 200,
    proteines_sources: ['Viande (poulet, dinde, bœuf maigre)', 'Œufs (4-6/jour OK)', 'Poissons gras (saumon, sardines, maquereau)', 'Légumineuses (lentilles, pois chiches, haricots)', 'Whey protéine en collation 1-2× si besoin'],
    glucides_g_jour: 250,
    glucides_sources: ['Riz, patate douce, avoine, pain complet', 'Fruits (2-3/jour)', 'Légumes verts à volonté'],
    lipides_g_jour: 70,
    lipides_sources: ['Huile olive, avocat, noix/amandes, poissons gras'],
    hydratation_L: 3.5,
    supplements_optionnels: [
      'Créatine monohydrate 5g/jour (sécurité prouvée, +5-10% force)',
      "Whey protéine si pas d'apport suffisant via alimentation",
      'Multivitamines (insurance policy)',
      'Vitamine D3 1000-2000 UI/jour (octobre-avril surtout)',
    ],
    timing: 'Repas 4× : petit-dej (protéines + glucides), midi (équilibré), pré-séance 1h30 avant (glucides), post-séance 30min (protéines + glucides rapides)',
  },
  progression: {
    semaine_1_4: "Phase d'adaptation : technique > charges. Augmenter de +2.5kg/séance sur les compound.",
    semaine_5_8: 'Phase de force : approcher 1RM théorique (squat 1.2-1.5× poids corps = 120-150 kg objectif, SDT 1.5-2× = 150-200 kg).',
    semaine_9_12: 'Phase de masse : ajouter exercices isolation, +1 série par groupe.',
    semaine_12_plus: 'Réévaluation : si toujours surpoids, ajuster macro vers cut plus prononcé. Si maigre : surplus 200 cal.',
  },
  measurements_to_track: [
    'Poids matin à jeun 1× par semaine',
    'Tour de taille (ombilic) 1× par mois',
    'Photo silhouette face/profil 1× par mois (lumière constante)',
    'Charges aux 3 exercices clés (squat, SDT, bench) tous les jours d\'entraînement',
    'FCmax au repos 1× par mois (baisse = condition cardio s\'améliore)',
  ],
}

// ============================================================================
// PROGRAMME MUSCULATION BASIC FIT (Push/Pull/Legs split)
// ============================================================================
export const MUSCU_PROGRAM: Record<string, { label: string; color: string; icon: string; duration_min: number; exercises: Exercise[] }> = {
  push: {
    label: 'Push (Pecs + Épaules + Triceps)',
    color: '#DC2626',
    icon: '💪',
    duration_min: 60,
    exercises: [
      { name: 'Développé couché barre', sets: 4, reps: '8-10', weight_pct_1rm: 75, machine: 'Banc plat + barre olympique', notes: 'Pause 90s. Pieds ancrés au sol. Scapulas serrées.' },
      { name: 'Développé incliné haltères', sets: 3, reps: '10-12', weight_pct_1rm: 65, machine: 'Banc inclinable 30-45°', notes: 'Cible pecs supérieurs. Trajectoire en cloche.' },
      { name: 'Développé militaire (Overhead Press)', sets: 4, reps: '6-8', weight_pct_1rm: 70, machine: 'Cage squat + barre', notes: 'Gainage abdo. Pas de cambré lombaire excessif.' },
      { name: 'Élévations latérales haltères', sets: 4, reps: '12-15', weight_pct_1rm: 50, machine: 'Haltères 5-10kg', notes: 'Coude légèrement plié. Lent à la descente.' },
      { name: 'Dips poitrine', sets: 3, reps: 'max', weight_pct_1rm: 100, machine: 'Barres parallèles dips', notes: 'Penché en avant pour cibler pecs. Lest possible.' },
      { name: 'Extensions triceps poulie haute', sets: 3, reps: '12-15', weight_pct_1rm: 55, machine: 'Poulie haute + corde', notes: 'Coudes collés au corps. Descente lente.' },
    ],
  },
  pull: {
    label: 'Pull (Dos + Biceps + Trapèzes)',
    color: '#0891B2',
    icon: '🦾',
    duration_min: 60,
    exercises: [
      { name: 'Tractions pronation lestées', sets: 4, reps: '6-10', weight_pct_1rm: 100, machine: 'Barre de traction + ceinture lest', notes: 'Si pas 6 reps : assistance machine ou élastiques.' },
      { name: 'Rowing barre buste penché', sets: 4, reps: '8-10', weight_pct_1rm: 70, machine: 'Barre olympique', notes: 'Buste 45°, dos droit. Tirage vers nombril.' },
      { name: 'Tirage horizontal poulie', sets: 3, reps: '10-12', weight_pct_1rm: 65, machine: 'Poulie basse + V-bar', notes: 'Coudes collés. Squeeze omoplates en fin.' },
      { name: 'Face pulls poulie haute', sets: 3, reps: '15-20', weight_pct_1rm: 40, machine: 'Poulie haute + corde', notes: 'Cible deltoids postérieurs + trapèzes moyens. Anti-roundshoulder.' },
      { name: 'Curl haltères assis incliné', sets: 3, reps: '10-12', weight_pct_1rm: 60, machine: 'Banc 45° + haltères', notes: 'Bras pendants relâchés. Pas de balancier.' },
      { name: 'Curl marteau (hammer)', sets: 3, reps: '12-15', weight_pct_1rm: 55, machine: 'Haltères', notes: 'Cible brachial + brachioradial. Prise neutre.' },
    ],
  },
  legs: {
    label: 'Legs (Quadriceps + Ischios + Mollets + Fessiers)',
    color: '#16A34A',
    icon: '🦵',
    duration_min: 75,
    exercises: [
      { name: 'Squat barre arrière', sets: 5, reps: '5-8', weight_pct_1rm: 80, machine: 'Cage squat + barre olympique', notes: 'Profondeur cuisses parallèles minimum. Ceinture lombaire si > 100kg.' },
      { name: 'Soulevé de terre roumain (RDL)', sets: 4, reps: '8-10', weight_pct_1rm: 70, machine: 'Barre olympique', notes: 'Hanches en arrière, dos plat. Cible ischios + fessiers.' },
      { name: 'Presse à cuisses 45°', sets: 4, reps: '10-12', weight_pct_1rm: 75, machine: 'Presse à cuisses inclinée', notes: 'Pieds largeur épaules milieu plate-forme. Pas de verrouillage genoux.' },
      { name: 'Fentes haltères marchées', sets: 3, reps: '12 par jambe', weight_pct_1rm: 55, machine: 'Haltères', notes: 'Pas long, genou avant 90°. Cible quad + fessiers.' },
      { name: 'Leg curl couché (ischios)', sets: 3, reps: '12-15', weight_pct_1rm: 60, machine: 'Machine leg curl', notes: 'Contraction max en haut. Phase excentrique 2s.' },
      { name: 'Mollets debout machine', sets: 4, reps: '15-20', weight_pct_1rm: 70, machine: 'Machine standing calf raise', notes: 'Amplitude totale, étirement bas. Pause 1s.' },
    ],
  },
  core: {
    label: 'Core/Gainage (jour récup actif optionnel)',
    color: '#7C3AED',
    icon: '🧱',
    duration_min: 30,
    exercises: [
      { name: 'Planche frontale', sets: 3, reps: '60-90s', weight_pct_1rm: 0, machine: 'Tapis', notes: 'Gainage isométrique. Bassin neutre, ne pas cambrer.' },
      { name: 'Planche latérale', sets: 3, reps: '45s/côté', weight_pct_1rm: 0, machine: 'Tapis', notes: 'Obliques. Hanches levées, alignées.' },
      { name: 'Pallof press poulie', sets: 3, reps: '12/côté', weight_pct_1rm: 50, machine: 'Poulie réglable', notes: 'Anti-rotation transverse. Gainage actif.' },
      { name: 'Hanging knee raises', sets: 3, reps: '12-15', weight_pct_1rm: 0, machine: 'Barre traction', notes: 'Pas de balancier. Contrôle. Cible abdo bas.' },
      { name: 'Russian twists lestées', sets: 3, reps: '20/côté', weight_pct_1rm: 30, machine: 'Disque 5-10kg', notes: 'Pieds décollés. Rotation thoracique.' },
    ],
  },
}

// ============================================================================
// CONSEILS BÉHOURD (entraînement spécifique)
// ============================================================================
export const BEHOURD_TRAINING = {
  physical_focus: [
    'Cardio anaérobie : sprints courts (30s) + récup 90s — endurance combat (rounds 1-3 min)',
    'Force explosive : squats + deadlifts + olympic lifts (clean, snatch)',
    'Endurance musculaire bras : tirages, curl haute reps (push/pull à 12-15 reps)',
    'Tronc/core : gainage + rotation transverse (Pallof, anti-rotation)',
    'Mobilité épaules + hanches : workshop yoga 1×/sem (port harnois = limitation amplitude)',
  ],
  specific_drills: [
    'Frappes à vide (sec) avec bouclier + arme : 3×3 min avec 1 min récup',
    'Travail technique partner drills 30 min sans contact lourd',
    'Sparring contact contrôlé 50% : 2×3 min par session',
    'Manipulation de poids déséquilibré (sac de sable épaule) — habituation port harnois',
  ],
  weekly_template: {
    Lundi: 'Push (musculation)',
    Mardi: 'Béhourd entraînement technique (frappes + drills)',
    Mercredi: 'Pull (musculation)',
    Jeudi: 'Béhourd cardio + conditioning (HIIT armuré)',
    Vendredi: 'Legs (musculation)',
    Samedi: 'Béhourd sparring contact',
    Dimanche: 'Récupération active (yoga, marche, mobilité)',
  } as Record<string, string>,
  injury_prevention: [
    'Échauffement 15 min : cardio léger + mobilité articulaire (épaules, cervicales, hanches)',
    'Étirements POST-entraînement uniquement (jamais à froid)',
    'Hydratation : 1L/h en armure (transpiration intense)',
    'Cou/cervicales : entraîner deep neck flexors (front bridge) — anti-commotion',
  ],
}

// ============================================================================
// ARMURE — Set MBO réel : ROA Chameleon (Armor Workshop Pavlo Kozak)
// Acier 30 HGSA — la fiche fabricant annonce 33 kg pour le set complet
// (heaume + brigantine + jupe + bras + jambes) : les poids par pièce
// ci-dessous sont des estimations calées pour totaliser 33 kg.
// Livraison 1er nov 2026.
// ============================================================================
export const ARMOR_PIECES_TEMPLATE: ArmorPiece[] = [
  { slot: 'Heaume ROA Chameleon', icon: '🪖', typical_weight_kg: 4.5, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En cours de fabrication — livraison prévue 1er novembre 2026. Casque ROA Chameleon acier 30 HGSA. Vision oeillères + ventilation. Padding intérieur.', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '155 (set)', url: 'https://armor-workshop-pavlokozak.com.ua/shop/armor-set-roa-chameleon' },
  { slot: 'Brigantine (cuirasse plaquée)', icon: '🛡️', typical_weight_kg: 10, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: "📦 En cours — livraison 1er novembre 2026. Body armor brigantine — plaques d'acier rivetées sur tissu. Couvre torse + dos + flancs.", manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '155 (set)' },
  { slot: 'Brigantine skirt (jupe)', icon: '🛡️', typical_weight_kg: 3.5, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En cours — livraison 1er novembre 2026. Jupe brigantine — protection bassin + cuisses hautes.', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '155 (set)' },
  { slot: 'Full arms armor (bras + gantelets)', icon: '💪', typical_weight_kg: 7, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En cours — livraison 1er novembre 2026. Set bras COMPLET : spallières + brassards + coudières + avant-bras + GANTELETS (mitons inclus).', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '155 (set)' },
  { slot: 'Full legs armor (jambes + sabatons)', icon: '🦵', typical_weight_kg: 8, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En cours — livraison 1er novembre 2026. Set jambes COMPLET : cuissards + genouillères + jambières + SABATONS inclus.', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '155 (set)' },
  { slot: 'Gambeson + pantalons matelassés', icon: '🧥', typical_weight_kg: 3.5, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En attente livraison. Sous-couche matelassée coton 8-12 couches. Critique absorption chocs.', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '114', price_usd: 320 },
  { slot: 'Soft sports belt (Softbelt)', icon: '🎗️', typical_weight_kg: 0.8, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En attente livraison. Ceinture matelassée renforcée — supporte armure jambes.', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '116', price_usd: 90 },
  { slot: 'Leather boots black (chaussures cuir)', icon: '👞', typical_weight_kg: 1.4, must_have: true, owned: false, pre_order: true, expected_delivery: '2026-11-01', notes: '📦 En attente livraison. Bottes cuir noir lacées. Adhérence sol + flexion cheville sous sabatons.', manufacturer: 'Armor Workshop Pavlo Kozak', product_code: '182', price_usd: 195 },
  { slot: 'Hache de combat (bohurd)', icon: '🪓', typical_weight_kg: 1.4, must_have: true, owned: false, notes: '🛒 À acheter : hache bohurd réglementaire 1.2-1.6 kg + tête émoussée. Conforme IMCF/HMB. Style tank polyvalent (force + portée).' },
  { slot: 'Bocle (buckler petit bouclier rond)', icon: '🛡️', typical_weight_kg: 1.5, must_have: true, owned: false, notes: '🛒 À acheter : bocle (buckler) — petit bouclier rond métal ~30 cm diamètre. Tenue à 1 main, paré rapide. Idéal duos avec hache.' },
]

// ============================================================================
// CALENDRIERS DÉDIÉS (Google Calendar séparés)
// ============================================================================
export const BEHOURD_CALENDAR_CFG: CalendarCfg = {
  name: 'Prométhée Béhourd',
  description: 'Agenda 100% béhourd : cours hebdo, sparring, tournois, événements MERA/IMCF/HMB, préparation tournois. Séparé du calendrier Perso (vie privée) et des agendas Hub Brassage/Projet.',
  recommended_color: '#DC2626',
  event_categories: [
    { id: 'behourd_club', label: '🛡️ Entraînement club (samedi)', color: '#DC2626', duration_typ_min: 120, default_recurrence: 'WEEKLY' },
    { id: 'behourd_sparring', label: '⚔️ Sparring contact', color: '#991B1B', duration_typ_min: 90 },
    { id: 'behourd_technique', label: '🥋 Drill technique sec (sans armure)', color: '#7F1D1D', duration_typ_min: 60 },
    { id: 'behourd_tournoi', label: '🏆 Tournoi / compétition', color: '#7C2D12', duration_typ_min: 480 },
    { id: 'behourd_mera', label: '🇫🇷 Événement MERA (Médiéval)', color: '#9A3412', duration_typ_min: 600 },
    { id: 'behourd_imcf', label: '🌍 Compétition IMCF/HMB', color: '#92400E', duration_typ_min: 720 },
    { id: 'armure_essai', label: '🔧 Essayage/ajustement armure', color: '#B45309', duration_typ_min: 90 },
    { id: 'behourd_prep', label: '📋 Préparation tournoi', color: '#A16207', duration_typ_min: 45 },
  ],
  weekly_recurring: [{ day: 'Samedi', time: '14:00-16:00', event: '🛡️ Entraînement club (technique + sparring)' }],
}

export const PERSO_CALENDAR_CFG: CalendarCfg = {
  name: 'Prométhée Perso',
  description: 'Agenda perso (HORS béhourd) : séances muscu Basic Fit, yoga/mobilité, événements privés famille/amis.',
  recommended_color: '#7C3AED',
  event_categories: [
    { id: 'muscu_push', label: '💪 Push (muscu)', color: '#0891B2', duration_typ_min: 60 },
    { id: 'muscu_pull', label: '🦾 Pull (muscu)', color: '#0E7490', duration_typ_min: 60 },
    { id: 'muscu_legs', label: '🦵 Legs (muscu)', color: '#155E75', duration_typ_min: 75 },
    { id: 'yoga_mobility', label: '🧘 Yoga/Mobilité', color: '#16A34A', duration_typ_min: 45 },
    { id: 'perso_event', label: '📅 Événement perso (famille/amis)', color: '#7C3AED', duration_typ_min: 60 },
  ],
}
