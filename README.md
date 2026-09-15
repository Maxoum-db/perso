# Hub Perso

Mon espace personnel mobile-first : **agenda unifié**, **synthèses** (NotebookLM / Plaud
via Google Drive) et, à venir, **notes** (perso, psy) avec **dictée vocale**.

Site web responsive (React + Vite + Tailwind), backend Supabase, connecté à Google
(Agenda + Drive).

---

## 🗺️ Feuille de route

- **Phase 1 — Google d'abord** ✅ (cette version)
  - Connexion « Se connecter avec Google »
  - Agenda unifié (jour / semaine, filtres par agenda)
  - Synthèses : lecture d'un dossier Google Drive (NotebookLM + exports Plaud)
  - 🛡️ **Béhourd** : suivi d'armure (synchronisé), programme TANK, musculation,
    calendriers dédiés — porté depuis le Hub Prométhée
- **Phase 2 — Notes & dictée** 🔜
  - Notes perso, notes psy (privées), journal — stockées dans Supabase
  - Dictée vocale dans le navigateur (micro Safari iPhone → texte)
- **Phase 3 — Automatisations** 🔜
  - Optimisation d'agenda (créneaux libres, conflits)
  - Indexation / recherche des synthèses et notes Plaud
  - Raccourci iOS « Note au Hub » (le plus proche de Siri)

---

## ⚙️ Configuration (à faire une fois)

L'appli a besoin de **sa propre** connexion Google. Voici les 3 étapes. Compte ~15 min.

### 1) Google Cloud Console — créer l'identifiant OAuth

1. Va sur <https://console.cloud.google.com/> → crée un projet (ex. « Hub Perso »).
2. **APIs & Services → Bibliothèque** : active **Google Calendar API** et **Google Drive API**.
3. **APIs & Services → Écran de consentement OAuth** :
   - Type **External**, en mode **Testing**.
   - Ajoute ton adresse Google comme **utilisateur de test** (indispensable : en mode
     Testing, seuls les comptes de test peuvent se connecter — pas de validation Google
     nécessaire).
4. **APIs & Services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type d'application : **Application Web**.
   - **URI de redirection autorisés** → ajoute exactement :
     ```
     https://ajukuwrznhfsfdeejdkl.supabase.co/auth/v1/callback
     ```
   - Crée → note le **Client ID** et le **Client secret**.

### 2) Supabase — activer le fournisseur Google

Dans le dashboard du projet **dédié Hub Perso** (`ajukuwrznhfsfdeejdkl`, ex-« CRM Global » —
pense à le renommer « Hub Perso » dans *Settings → General*) :

1. **Authentication → Providers → Google** : active-le, colle le **Client ID** et le
   **Client secret** de l'étape 1, puis enregistre.
2. **Authentication → URL Configuration** :
   - **Site URL** : l'URL Vercel de prod (ex. `https://hub-perso.vercel.app`).
   - **Redirect URLs** : ajoute ces deux lignes
     ```
     http://localhost:5173
     https://<ton-app>.vercel.app
     ```
     (ajoute aussi ton domaine perso plus tard, ex. `https://hub.ferme-promethee.fr`).

> Les scopes Google (Agenda + Drive lecture) sont demandés automatiquement par l'appli
> au moment de la connexion — rien à configurer côté Supabase pour ça.

### 3) Vercel — déployer

1. Sur <https://vercel.com> : **Add New → Project → Import** le repo `Maxoum-db/perso`.
2. Vercel détecte Vite automatiquement (build `npm run build`, sortie `dist`).
3. **Environment Variables** → ajoute :
   | Nom | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://ajukuwrznhfsfdeejdkl.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_QnpL8FEUaXFBpwg14kYePA_kZnY_lAS` |
4. **Deploy**. Récupère l'URL de prod et reporte-la dans Supabase (étape 2, Site URL +
   Redirect URLs).

À chaque `git push` sur la branche de prod, Vercel redéploie tout seul.

---

### 4) Polar Flow — relever les séances du capteur (optionnel)

Sert **uniquement** aux séances que le Verity Sense enregistre seul, en mode vert,
sans téléphone. Le capteur les garde en mémoire, l'application Polar les vide vers
Polar Flow, et Couanac vient les y chercher.

> ⚠️ **L'application Polar reste nécessaire.** C'est le seul logiciel qui sait vider
> la mémoire du capteur et mettre à jour son firmware. Ne la supprime pas.
>
> ⚠️ **Pas de sommeil ni de Nightly Recharge.** Ces routes de l'API existent, mais
> elles décrivent des données de **montre**. Le Verity Sense est un capteur
> d'entraînement : il ne se porte pas la nuit et ne mesure pas en continu. Le suivi
> 24/24 n'est pas possible avec ce matériel, et encore moins depuis une page web.

**a) Créer le client AccessLink** — 5 minutes, à faire soi-même :

1. Va sur <https://admin.polaraccesslink.com/> et connecte-toi avec ton compte Polar Flow.
2. Onglet **Application information** :
   | Champ | Valeur |
   |---|---|
   | Application Name | `Couanac Aide` |
   | Business contact | `maximilien@ferme-promethee.fr` |
   | Application Web site | `https://couanac.vercel.app` |
   | **Authorization redirect URL** | `https://couanac.vercel.app/polar-callback` |

   L'URL de redirection est comparée **caractère par caractère** par Polar : `https`,
   pas de barre oblique finale, pas de `www`. Elle doit être identique à
   `POLAR_REDIRECT_URI` posé à l'étape (b).

3. **Available data types** — n'active que ce qui sert :
   | Type | | Pourquoi |
   |---|---|---|
   | Exercise data | ✅ | Les séances. C'est la seule chose que Couanac lit. |
   | Daily activity data | ❌ | Pas / mille pas / calories de la journée : données de montre ou de bracelet. Le Verity Sense n'en produit pas. |
   | Physical information data | ❌ | Taille, poids, VO2max du profil Polar. Couanac ne les lit pas — le poids et la FC max se saisissent dans l'app. |

   Ces cases se modifient plus tard si besoin : autant commencer au strict nécessaire.

4. Termine l'assistant et note le **Client ID** et le **Client Secret**.

**b) Installer les identifiants côté serveur.** Le secret ne doit *jamais* entrer
dans le bundle Vite — il partirait dans le JavaScript public. Il vit dans les
secrets Supabase :

```bash
supabase secrets set \
  POLAR_CLIENT_ID=... \
  POLAR_CLIENT_SECRET=... \
  POLAR_REDIRECT_URI=https://couanac.vercel.app/polar-callback
supabase functions deploy polar
```

**c) Relier le compte** : Réglages › ❤️ Capteur cardiaque › Polar Flow › « Relier mon
compte Polar ».

Ensuite la relève est **automatique** : la carte cardio du journal de musculation
interroge Polar en s'affichant, au plus une fois par demi-heure. Le bouton
« ⟳ Relever Polar » reste là pour forcer — au retour d'une séance, sans attendre.

Le frein d'une demi-heure se mesure sur `last_sync_at`, qui vient du serveur : il
vaut donc pour tous les appareils à la fois, là où un compteur rangé dans le
navigateur laisserait le téléphone et l'ordinateur relever chacun de son côté.

Tant que les trois secrets ne sont pas posés, l'écran affiche « pas encore
configuré » au lieu d'une erreur.

**Ce qui remonte** : début, durée, fréquence moyenne et maximale, calories, distance,
charge Polar. **Pas le temps par zone** — la route `GET /v3/exercises` ne le donne
pas, et la route transactionnelle qui le donnerait efface les séances de façon
irréversible dès qu'on valide la transaction. Ces séances ne comptent donc pas dans
la charge cardiaque hebdomadaire.

---

## 💻 Développement local

```bash
npm install
cp .env.example .env.local   # déjà pré-rempli avec les clés publiques
npm run dev                  # http://localhost:5173
```

> La connexion Google fonctionne aussi en local une fois `http://localhost:5173`
> ajouté dans les Redirect URLs Supabase (étape 2).

### Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev |
| `npm run build` | Vérif TypeScript + build de prod (`dist/`) |
| `npm run preview` | Prévisualise le build de prod |

---

## 🏗️ Architecture

```
src/
  lib/
    supabase.ts   # client Supabase
    auth.tsx      # connexion Google via Supabase + capture du jeton Google
    google.ts     # appels REST Agenda + Drive
    settings.ts   # préférences (dossier Drive, agendas visibles) -> table perso_settings
  components/
    Layout.tsx        # en-tête + navigation par onglets (mobile-first)
    ReconnectGoogle.tsx
    kv.ts         # stockage clé/valeur générique (suivi armure béhourd…)
  data/
    behourd.ts    # données béhourd (armure, programmes, calendriers)
  pages/
    Login.tsx | Home.tsx | Agenda.tsx | Behourd.tsx | Drive.tsx | Settings.tsx
```

**Données** : projet Supabase **dédié** (`ajukuwrznhfsfdeejdkl`), totalement séparé du
projet du Hub Prométhée. Tables `public.perso_settings` (préférences) et
`public.perso_kv` (état des modules, ex. armure béhourd) — protégées par RLS, chaque
utilisateur ne voit que ses propres lignes.

### Note technique sur le jeton Google

Supabase fournit le jeton d'accès Google (`provider_token`) juste après la connexion ;
il n'est pas rafraîchi automatiquement. L'appli le met en cache (~1 h) et propose de
**reconnecter Google** à l'expiration. Une amélioration prévue (phase 1.5) : une *Edge
Function* Supabase qui rafraîchit le jeton en arrière-plan via le `refresh_token`.
