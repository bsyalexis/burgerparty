# Photos des burgers

Un fichier par burger, nommé d'après son `slug` en base :

| Fichier attendu | Burger |
| --- | --- |
| `klassik-cheese.png` | Klassik Cheese |
| `kiffeur-doignon.png` | Kiffeur D'Oignon |
| `pleuresurlepoulet.png` | PleureSurLePoulet |

C'est la colonne `image_url` de la table `burgers` qui pointe vers ces
fichiers (`/assets/img/<slug>.png`). Si tes images sont en `.jpg`, pas besoin
de les convertir : change simplement l'extension dans `image_url` depuis le
Table Editor Supabase, ça prend effet immédiatement sans redéploiement.

Tant qu'un fichier est absent, la carte retombe sur l'emoji du burger — rien
ne casse.

**Format conseillé** : carré, 600×600 environ, fond blanc ou transparent.
Les photos sont affichées en `contain` sur une tuile blanche, donc les deux
types de fond se fondent de la même façon.
