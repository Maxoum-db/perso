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
     https://pizuebrltwzdhlrrqpaw.supabase.co/auth/v1/callback
     ```
   - Crée → note le **Client ID** et le **Client secret**.

### 2) Supabase — activer le fournisseur Google

Dans le dashboard du projet `pizuebrltwzdhlrrqpaw` :

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
   | `VITE_SUPABASE_URL` | `https://pizuebrltwzdhlrrqpaw.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_S3h4S7fa2_QHVkSb7ZgI2g_SYTI0TM_` |
4. **Deploy**. Récupère l'URL de prod et reporte-la dans Supabase (étape 2, Site URL +
   Redirect URLs).

À chaque `git push` sur la branche de prod, Vercel redéploie tout seul.

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
  pages/
    Login.tsx | Home.tsx | Agenda.tsx | Drive.tsx | Settings.tsx
```

**Données** : table `public.perso_settings` (Supabase), protégée par RLS — chaque
utilisateur ne voit que sa propre ligne. Isolée des tables `hub_*` / `phase1_*`
existantes du projet.

### Note technique sur le jeton Google

Supabase fournit le jeton d'accès Google (`provider_token`) juste après la connexion ;
il n'est pas rafraîchi automatiquement. L'appli le met en cache (~1 h) et propose de
**reconnecter Google** à l'expiration. Une amélioration prévue (phase 1.5) : une *Edge
Function* Supabase qui rafraîchit le jeton en arrière-plan via le `refresh_token`.
