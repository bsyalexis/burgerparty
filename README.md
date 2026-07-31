# 🍔 Burger Party

Borne de commande pour une soirée burgers à la maison. Les invités scannent
un lien, composent leur burger comme au fast-food, et la cuisine voit tomber
les commandes en direct.

HTML / CSS / JS natifs — aucun framework, aucune étape de build.
Hébergé sur Vercel, données sur Supabase.

---

## Les deux écrans

| Écran | URL | Pour qui |
| --- | --- | --- |
| Commande | `/` | Les invités |
| Cuisine | `/cuisine` | Toi |

L'écran cuisine demande un code, défini dans `assets/js/config.js`
(`KITCHEN_CODE`). C'est un garde-fou contre les ouvertures accidentelles,
**pas un secret** : le code est lisible dans le source. Change-le avant la
soirée si tu tiens à ce que personne ne s'y balade.

## Le parcours invité

1. Prénom
2. Choix du burger
3. Retrait d'ingrédients + cuisson (uniquement pour les burgers à la viande)
4. Accompagnements et boissons
5. Récap + mot pour la cuisine
6. Ticket avec numéro, statut mis à jour tout seul, modifiable ou annulable

La commande est retenue dans le `localStorage` du téléphone : rouvrir le lien
rouvre le ticket, pas un nouveau formulaire.

## L'écran cuisine

- **Commandes** — une carte par commande, dans l'ordre d'arrivée. Un bouton
  fait avancer le statut : Nouvelle → En cuisine → Prête → Servie. La flèche
  revient en arrière, la croix supprime.
- **Récap cuisine** — les totaux de ce qu'il reste à préparer : burgers,
  cuissons, ingrédients à retirer, accompagnements, boissons.
- **Commandes ouvertes / fermées** — coupe la prise de commande quand le
  service démarre. Les invités voient alors un écran « commandes closes ».

Mise à jour en temps réel via Supabase Realtime, avec un rafraîchissement
automatique toutes les 15 s en filet de sécurité si le wifi lâche. Un « ding »
sonne à chaque nouvelle commande.

---

## Modifier le menu

Tout le menu vit en base — pas besoin de redéployer. Table `burgers` et table
`sides` dans le [Table Editor Supabase](https://supabase.com/dashboard/project/eqbvfhhxrovsscldcgfh/editor).

Colonnes utiles de `burgers` :

| Colonne | Rôle |
| --- | --- |
| `name`, `tagline`, `emoji` | ce qui s'affiche sur la carte |
| `ingredients` | tableau de texte — chaque entrée devient un bouton « retirer » |
| `needs_cooking` | `true` = on demande la cuisson (viande rouge) |
| `sort_order` | ordre d'affichage |
| `available` | `false` = retiré du menu, sans casser les commandes déjà passées |

`sides` fonctionne pareil, avec `category` à `side` (accompagnement) ou
`drink` (boisson).

La table `settings` (ligne unique) porte le nom de la soirée (`party_name`),
un message d'accueil libre (`message`) et l'état des commandes (`orders_open`).

## Identité visuelle

Toutes les couleurs, tailles et rayons sont des variables CSS regroupées dans
le bloc `:root` en haut de `assets/css/app.css`. Pour reskinner l'app à partir
d'un moodboard, il n'y a que ce bloc à toucher.

---

## Structure

```
index.html            parcours de commande
cuisine.html          écran cuisine
assets/css/app.css    tous les styles + les tokens de design
assets/js/config.js   URL Supabase, clé publique, code cuisine, libellés
assets/js/api.js      client PostgREST minimal (fetch, zéro dépendance)
assets/js/order.js    machine à étapes du parcours invité
assets/js/kitchen.js  liste temps réel + récap agrégé
vercel.json           URLs propres, cache, en-têtes
```

La page invité ne charge **aucune** dépendance externe : deux fichiers JS
locaux et une feuille de style. Le SDK Supabase (pour le temps réel) n'est
chargé qu'à la demande sur l'écran cuisine.

## Développer en local

```bash
python3 -m http.server 4321
```

Puis http://localhost:4321.

---

## Sécurité — à savoir

C'est une app de soirée entre amis, pas un produit. Les politiques RLS
autorisent le rôle anonyme à lire, créer, modifier et supprimer des commandes,
sans authentification. Concrètement : **quiconque a le lien peut voir et
modifier toutes les commandes.**

C'était le choix assumé pour éviter toute friction (pas de compte, pas de code
par invité). Les données concernées se limitent à des prénoms et des choix de
burger. Si le lien devait circuler plus largement que prévu, ferme les
commandes depuis l'écran cuisine — ou mets le projet en pause dans Supabase
une fois la soirée finie.
