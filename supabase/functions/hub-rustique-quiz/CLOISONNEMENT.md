# Cloisonner le planning de révision par compte

`learn_review_state` et `learn_review_log` (base du Hub Prométhée) n'ont pas de
colonne `user_id`. La clé est `card_id` seul. **Deux personnes qui révisent la
même carte écrasent mutuellement leur planning**, en silence : la carte
réapparaît ou disparaît sans raison visible, et aucune des deux ne peut le
diagnostiquer depuis l'application.

## Pourquoi ce n'est pas corrigé ici

La table a **deux écrivains** :

| Écrivain | Où | Conflit déclaré |
|---|---|---|
| `hub-rustique-quiz` (cette fonction) | projet Aide, clé de service | `onConflict: card_id` |
| `recordLearnReview()` | application Hub Prométhée, `src/lib/supabase.js` | `onConflict: card_id` |

Ajouter `user_id` et déplacer la contrainte d'unicité sur `(card_id, user_id)`
**casse le second** dès que la migration passe : son `onConflict: card_id` ne
correspond plus à aucune contrainte, et ses écritures échouent. Le dépôt
`hub-promethee` est privé et n'est pas modifiable depuis ici — la migration
seule ferait donc plus de dégâts que le défaut qu'elle répare.

## Ce qui est en place en attendant

`submit_review` **refuse l'écriture** à tout compte autre que le propriétaire
(`review_non_cloisonnee`, HTTP 409). La lecture reste ouverte : consulter les
fiches et les paquets ne dérange personne.

Aujourd'hui la section Rustique n'est accordée à aucun autre compte
(`perso_acces`), donc le garde-fou ne se déclenche jamais. Il existe pour le
jour où elle le sera — c'est-à-dire pour le moment exact où le défaut
deviendrait actif.

## L'ordre à respecter le jour où on cloisonne

1. **Migration additive**, sans rien casser :

   ```sql
   alter table learn_review_state add column user_id uuid;
   alter table learn_review_log  add column user_id uuid;

   -- Les lignes existantes appartiennent au propriétaire.
   update learn_review_state set user_id = '<uuid du propriétaire>' where user_id is null;
   update learn_review_log  set user_id = '<uuid du propriétaire>' where user_id is null;

   alter table learn_review_state alter column user_id set not null;
   -- NOT NULL AVANT l'unicité : une contrainte unique traite chaque NULL comme
   -- distinct, donc une colonne nullable laisserait proliférer les doublons
   -- sans jamais lever d'erreur.
   create unique index learn_review_state_card_user on learn_review_state (card_id, user_id);
   ```

2. **Les deux écrivains passent à `onConflict: 'card_id,user_id'` et renseignent
   `user_id`** — Hub Prométhée d'abord ou en même temps, jamais après.

3. **Seulement ensuite**, retirer l'ancienne contrainte sur `card_id` et le
   garde-fou de `submit_review`.

Tant que l'étape 2 n'est pas faite des deux côtés, l'étape 1 ne doit pas partir.
