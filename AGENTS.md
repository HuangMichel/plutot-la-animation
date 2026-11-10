# Plutôt là, le livre animé

Présentation 3D (Vite + Three.js) du projet Plutôt là. Contexte produit : `PRODUCT.md`.

- `npm run dev` : serveur de développement. `npm run build` puis `npm run preview` : version statique (`dist/`).
- Pas de tests ni de lint. Vérifier un changement visuel en regardant le rendu : bureau 1440×900, mobile 390×844, `prefers-reduced-motion`, et sans WebGL (la page doit rester lisible).
- `src/data.js` : textes, niveaux, partenaires, points de vue caméra, et `BEATS`, les étapes du récit. `src/scene/` : la scène (papier, décor, foule, particules, post-traitement). `public/ill/` : illustrations reprises de l'application.
- Le récit avance par étapes (`BEATS`) : la visite guidée, la molette et les flèches passent toutes par `applyBeat` dans `src/main.js`. Chaque étape cumule l'état des précédentes, donc elle montre la même scène quel que soit le chemin pris. Pour ajouter un moment au récit, ajouter une étape ; ne pas piloter la scène à part.
- En développement, `window.tour` et `window.stage` exposent l'état (étape courante, visite en cours, caméra) pour vérifier un comportement depuis la console.
- Les couleurs, polices et personnages sont ceux de l'application : ne pas en inventer. Les partenaires du widget sont des démonstrations et doivent rester marqués comme tels.
- `video/` : le film Remotion, qui importe `src/scene/` et `src/data.js`. Lire `video/AGENTS.md` avant de toucher au film, et après avoir changé la scène.
