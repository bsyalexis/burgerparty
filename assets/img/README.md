# Photos des burgers

Un fichier par burger, nommé d'après son `slug` en base :

| Fichier | Burger |
| --- | --- |
| `klassik-cheese.jpg` | Klassik Cheese |
| `kiffeur-doignon.jpg` | Kiffeur D'Oignon |
| `pleuresurlepoulet.jpg` | PleureSurLePoulet |

C'est la colonne `image_url` de la table `burgers` qui pointe vers ces
fichiers. Changer d'extension ou de nom se fait donc en base, depuis le Table
Editor Supabase, sans redéploiement. Tant qu'un fichier est absent, la carte
retombe sur l'emoji du burger — rien ne casse.

## Remplacer une photo

Les originaux fournis pesaient 2,2 Mo à eux trois, pour une vignette affichée
en 104 px. Ils ont été ramenés à **140 ko au total** : carrés de 360 px,
aplatis sur fond blanc, JPEG qualité 80.

La recette, avec le `sips` livré avec macOS — en deux passes, car `sips`
ignore le changement de format quand on le combine au redimensionnement :

```bash
sips -Z 360 source.png --padToHeightWidth 360 360 --padColor FFFFFF --out tmp.png
sips -s format jpeg -s formatOptions 80 tmp.png --out klassik-cheese.jpg
```

Le fond blanc est volontaire : la vignette est blanche, donc la transparence
ne sert à rien et coûte cher en poids. Le format carré garantit que les trois
burgers sont cadrés pareil.
