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
| Cuisine | `/cuisine-740e27` | Toi |

L'adresse de la cuisine est volontairement imprévisible : c'est elle, et non
le code, qui empêche un invité de tomber dessus. Renommer le fichier
`cuisine-740e27.html` change l'adresse ; `/cuisine` tout court renvoie un 404.

L'écran demande ensuite un code, défini dans `assets/js/config.js`
(`KITCHEN_CODE`). C'est un garde-fou contre les ouvertures accidentelles,
**pas un secret** : le code est lisible dans le source.

## Le parcours invité

1. Prénom
2. Choix du burger
3. Personnalisation : retrait d'ingrédients, suppléments, sauces, et cuisson
   pour les burgers à la viande
4. Accompagnements et boissons — **étape sautée automatiquement** tant qu'il
   n'y a aucune ligne `side` ou `drink` dans la table `addons`
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

Tout le menu vit en base — pas besoin de redéployer. Tables `burgers` et
`addons` dans le [Table Editor Supabase](https://supabase.com/dashboard/project/eqbvfhhxrovsscldcgfh/editor).

Colonnes utiles de `burgers` :

| Colonne | Rôle |
| --- | --- |
| `name`, `tagline`, `emoji` | ce qui s'affiche sur la carte |
| `ingredients` | tableau de texte — chaque entrée devient un bouton « retirer » |
| `needs_cooking` | `true` = on demande la cuisson (viande rouge) |
| `sort_order` | ordre d'affichage |
| `available` | `false` = retiré du menu, sans casser les commandes déjà passées |

`addons` porte tout ce qui s'ajoute à la commande. C'est la colonne `category`
qui décide où l'option apparaît dans le parcours :

| `category` | Où ça s'affiche |
| --- | --- |
| `extra` | Suppléments, sur l'écran de personnalisation (avec un `+`) |
| `sauce` | Sauces, sur le même écran |
| `side` | Accompagnements, sur l'écran « Avec ça ? » |
| `drink` | Boissons, sur le même écran |

Une catégorie sans aucune ligne disparaît de l'interface toute seule — et si
ni `side` ni `drink` n'existent, l'étape « Avec ça ? » saute entièrement. Pour
rouvrir cette étape, il suffit d'ajouter une ligne `side` (par exemple des
frites) : rien à redéployer.

La table `settings` (ligne unique) porte le nom de la soirée (`party_name`),
un message d'accueil libre (`message`) et l'état des commandes (`orders_open`).

## Identité visuelle

Direction « sticker shop » : orange plein, fond crème quadrillé, capitales
lourdes, contours nets et ombres dures décalées.

Toutes les couleurs, tailles, rayons, l'épaisseur du trait (`--stroke`) et
l'ombre (`--shadow`) sont des variables CSS regroupées dans le bloc `:root` en
haut de `assets/css/app.css`. C'est le seul endroit à toucher pour faire
bouger l'ensemble.

La typo d'affichage est **Anton** (SIL Open Font License), auto-hébergée dans
`assets/fonts/anton-latin.woff2` — 12 ko, sous-ensemble latin, préchargée.
Aucune requête vers un CDN de polices.

### Animations

La motion passe par **GSAP** (3.15, auto-hébergé dans
`assets/js/vendor/`, 71 ko / 28 ko gzip), pilotée depuis `assets/js/motion.js`.

- **Ouverture de fiche produit** — la vignette du burger choisi s'envole de sa
  carte jusqu'en tête de l'écran de personnalisation. C'est un FLIP à la main :
  on relève la position de départ avant de masquer l'étape, puis GSAP revient
  à la position d'arrivée.
- **Transitions d'étape** — le bloc glisse dans le sens de la navigation, ses
  sections montent en cascade, les cartes arrivent une à une.
- **Micro-interactions** — enfoncement au doigt sur tout ce qui se touche, avec
  retour élastique ; rebond de confirmation au moment du choix.
- **Ticket** — le numéro et le statut se tamponnent sur le papier.
- **Validation** — une gerbe d'autocollants traverse l'écran.

Règle de partage : **GSAP possède les `transform`, le CSS garde les couleurs,
les ombres et les états.** Les deux ne doivent jamais animer la même propriété
sur le même élément, sinon le style en ligne posé par GSAP gagne en silence —
c'est pour ça qu'il n'y a plus un seul `:active` avec `transform` dans la
feuille de style.

Tout passe par `transform` et `opacity` — rien ne déclenche de recalcul de
mise en page.

Deux filets de sécurité : si GSAP ne se charge pas, chaque fonction de
`motion.js` devient un no-op ; et si le système demande moins de mouvement,
tout est coupé de la même façon. Dans les deux cas l'app reste entièrement
utilisable, simplement sans animation.

---

## Structure

```
index.html                      parcours de commande
cuisine-740e27.html             écran cuisine (nom volontairement imprévisible)
assets/css/app.css              tous les styles + les tokens de design
assets/fonts/anton-latin.woff2  typo d'affichage, auto-hébergée
assets/img/                     photos des burgers (voir le README du dossier)
assets/js/config.js             URL Supabase, clé publique, code cuisine, libellés
assets/js/api.js                client PostgREST minimal (fetch, zéro dépendance)
assets/js/motion.js             toute la motion (GSAP)
assets/js/vendor/gsap.min.js    GSAP, auto-hébergé
assets/js/order.js              machine à étapes du parcours invité
assets/js/kitchen.js            liste temps réel + récap agrégé
vercel.json                     URLs propres, cache, en-têtes
```

Rien n'est chargé depuis un domaine tiers : GSAP, la police et les photos
sont tous servis par le site lui-même. Seul le SDK Supabase, nécessaire au
temps réel, est chargé à la demande sur l'écran cuisine.

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

Dernier point : **si ce dépôt est public, l'adresse de la cuisine ne l'est
plus.** Le nom du fichier suffit à la reconstituer. Passer le dépôt en privé
(Settings → General → Danger Zone sur GitHub) est ce qui rend l'adresse
réellement imprévisible.
