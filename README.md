# Plutôt là, le livre animé

Cette présentation 3D montre les trois volets de Plutôt là : l'application visiteur, l'espace gestionnaire et le widget partenaire. Le contexte produit se trouve dans [PRODUCT.md](PRODUCT.md).

## Lancer la présentation

Installez Node.js et npm, puis exécutez les commandes suivantes à la racine du projet :

```sh
npm ci
npm run dev
```

Ouvrez l'adresse affichée par Vite. Pour construire et prévisualiser la version statique :

```sh
npm run build
npm run preview
```

La construction écrit les fichiers dans `dist/`.

## Parcourir la présentation

La visite guidée démarre après l'ouverture du livre. La molette et les flèches du clavier parcourent les étapes du récit. Une action du lecteur met la visite guidée en pause. Lorsque le système demande moins d'animations, la visite ne démarre pas automatiquement.

Le contenu du panneau reste accessible lorsque WebGL n'est pas disponible. Les partenaires du widget sont des exemples de démonstration.

## Structure

- `src/data.js` contient les textes, les niveaux d'affluence, les partenaires, les vues et les étapes `BEATS`. La fonction `countToLevel` associe un nombre de figurines à un niveau. La présentation et le film utilisent les mêmes seuils.
- `src/main.js` gère le panneau, les commandes et la progression du récit. `applyBeat` applique l'état cumulé d'une étape.
- `src/scene/` contient la scène Three.js, notamment le décor, la foule et les effets.
- `public/ill/` contient les illustrations de l'application.
- `video/` contient le film Remotion. Il réutilise la scène et les données, avec son propre script.

Pour ajouter une étape au récit, modifiez `BEATS` dans `src/data.js`. La visite guidée, la molette et les flèches passent par `applyBeat` pour conserver le même état quel que soit le chemin suivi.

## Principes d'architecture

### Récit et état

`BEATS` décrit les étapes de la présentation. Chaque propriété `set` complète l'état des étapes précédentes à partir de `START`. `stateAt` reconstruit cet état, puis `applyBeat` met à jour le panneau et demande le cadrage et les changements de scène. Les étapes peuvent ainsi être atteintes dans un ordre différent sans perdre leur état attendu.

Pour ajouter un moment à la visite, définissez son état dans `BEATS` et passez par `applyBeat`. Gardez les commandes manuelles synchronisées avec le panneau et la scène. Les changements de scène peuvent attendre l'arrivée de la caméra : `tellSceneIn` assure cette synchronisation.

### Données et scène

Placez les données du récit et les règles communes à la présentation et au film dans `src/data.js`. Par exemple, utilisez `countToLevel` pour convertir un nombre de figurines en niveau d'affluence. Gardez les calculs propres à chaque rendu dans son pilote de scène.

`src/scene/stage.js` pilote la présentation en temps réel. Les modules de `src/scene/` construisent les éléments visuels et leurs effets. Le panneau reste utilisable si la création de la scène WebGL échoue ; ne rendez pas le contenu du panneau dépendant de la création de la scène.

### Film

`video/src/stage/filmStage.js` importe les données et les éléments de scène partagés. Le film garde son propre script et son propre pilote : il calcule les images par pas fixes à partir du numéro d'image. Ne remplacez pas ce fonctionnement par la boucle temps réel de la présentation. Vérifiez le film après toute modification d'une interface ou d'un élément de scène partagé.

## Film

Installez les dépendances du film depuis `video/` :

```sh
cd video
npm ci
npm run studio
```

Dans ce répertoire, `npm run render` crée `out/plutot-la.mp4` et `npm run poster` crée `out/affiche.png`. Le film est muet et dure 85 secondes. Son script se trouve dans `video/src/script.js`.

## Vérification

Le projet ne dispose pas de suite de tests ni de commande de lint. Après un changement visuel, vérifiez la présentation en 1440 × 900 et en 390 × 844, avec `prefers-reduced-motion` et sans WebGL. Vérifiez aussi le clavier.

Après une modification de la scène, rendez et relisez un brouillon du film. Les commandes et les points à vérifier figurent dans [video/AGENTS.md](video/AGENTS.md). Les consignes de développement de la présentation figurent dans [AGENTS.md](AGENTS.md).
