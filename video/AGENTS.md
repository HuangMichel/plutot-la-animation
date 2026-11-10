# Plutôt là, le film

Film de présentation de 85 s (Remotion), tourné dans le livre animé lui-même : `src/stage/filmStage.js` rejoue la scène de `../src/scene/` image par image, et `src/overlays/` pose les cartons et les repères par-dessus, en DOM.

- `npm run render` : `out/plutot-la.mp4` (1080p, muet). `npm run studio` : aperçu. `npm run poster` : l'affiche.
- Le film se règle dans `src/script.js` : les temps (`T`, en secondes), les poses de caméra (`KEYS`), les évènements (`EVENTS`).
- Tout se déduit du numéro d'image. La scène avance par pas fixes depuis la première image et le hasard vient de `rng` à graine : chaque onglet de rendu obtient ainsi la même image.
- Le film importe `../src/scene/` et `../src/data.js` tels quels et pilote leurs objets directement (pop-ups, foule, particules, objectif). Il a son propre script et ses propres cadrages : `BEATS` et `applyBeat` restent ceux de la présentation, qui vit en temps réel. Après un changement de la scène, rendre un brouillon et le relire.
- Pas de tests : relire le rendu. Brouillon : `npx remotion render Film out/brouillon.mp4 --scale=0.5 --crf=24`. Planche-contact : `ffmpeg -i out/brouillon.mp4 -vf "fps=1/2,scale=480:-1,tile=6x8" -frames:v 1 out/planche.png`. Image en pleine taille : `npx remotion still Film out/image.png --frame=N`. Regarder les cadrages, les textes entiers, les repères posés sur leur lieu.
