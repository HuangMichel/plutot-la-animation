// What the presentation says and shows. Wording follows the two live sites.

export const LEVEL_COLOURS = { calme: '#2BB0AD', modere: '#FFC941', charge: '#FD795B', sature: '#E01E1E' };

export const LEVELS = {
  calme: { name: 'Calme', advice: 'Bon moment pour venir.', crowd: 5, mood: 'content' },
  modere: { name: 'Modéré', advice: 'Du monde, et encore de la place.', crowd: 15, mood: 'content' },
  charge: { name: 'Chargé', advice: 'Beaucoup de monde sur la plage.', crowd: 29, mood: 'surpris' },
  sature: { name: 'Saturé', advice: 'Site plein : mieux vaut aller ailleurs.', crowd: 46, mood: 'fatigue' },
};

export const countToLevel = (count) => (count <= 8 ? 'calme' : count <= 20 ? 'modere' : count <= 36 ? 'charge' : 'sature');

// Lac de Paladru, samedi 11 juillet 2026 : the widget's demonstration day.
// The site gives 15 h to 20 h (très fréquenté jusqu'à 18 h, plus calme à partir
// de 20 h); the morning is filled in to complete the curve.
export const HOURS = [
  [8, 'calme', 0.14], [9, 'calme', 0.24], [10, 'modere', 0.5], [11, 'modere', 0.56], [12, 'modere', 0.44],
  [13, 'modere', 0.4], [14, 'charge', 0.62], [15, 'sature', 0.92], [16, 'sature', 0.84], [17, 'sature', 0.66],
  [18, 'charge', 0.42], [19, 'charge', 0.26], [20, 'calme', 0.12],
].map(([hour, level, height]) => ({ hour, level, height }));

export const levelAt = (hour) => HOURS[Math.max(0, Math.min(12, Math.round(hour) - 8))].level;

export const NEEDS = {
  aucun: {
    hero: 'chapeau',
    rule: 'Aucun lieu n’est mis de côté.',
  },
  fauteuil: {
    hero: 'fauteuil',
    rule: 'On écarte l’escalade, la via ferrata, les refuges et la montagne. Les sentiers et les lieux sans parking ni arrêt à moins de 500 m passent après.',
    fold: ['lauvitel'],
    notes: { lauvitel: 'Écarté : montagne' },
    view: 'besoins-lauvitel',
  },
  canne: {
    hero: 'canne',
    rule: 'On préfère les lieux desservis par les transports en commun et les visites accompagnées (musées, patrimoine). On signale les sentiers.',
    notes: { bastille: 'Préféré : patrimoine, desservi' },
  },
  chien: {
    hero: 'chien',
    rule: 'On écarte les réserves naturelles, où les chiens sont en général interdits. On signale les espaces naturels sensibles, les musées et les plages.',
    notes: { paladru: 'Signalé : plage' },
  },
};

// The demonstration partners of the widget site, with the themes it ships.
export const PARTNERS = [
  {
    id: 'pays-voironnais', name: 'Pays Voironnais', radius: 0, button: 40,
    colours: { primaire: '#FFED00', surPrimaire: '#1F1416', texte: '#1F1416', description: '#24352C', libelle: '#2F4A3B', carte: '#B3D5C1', fond: '#FFFFFF', contour: '#9FC4AF', surlignage: '#D7E8DE' },
  },
  {
    id: 'grenoble-alpes-tourisme', name: 'Grenoble Alpes Tourisme', radius: 0, button: 0,
    colours: { primaire: '#DF3100', surPrimaire: '#FFFFFF', texte: '#212121', description: '#333333', libelle: '#5A5A5A', carte: '#EEEEEE', fond: '#FFFFFF', contour: '#D6D6D6', surlignage: '#FFFFFF' },
  },
  {
    id: 'chartreuse', name: 'Destination Chartreuse', radius: 0, button: 0,
    colours: { primaire: '#3C3935', surPrimaire: '#F9B122', texte: '#3C3935', description: '#4F4B46', libelle: '#5C5853', carte: '#F8F5F2', fond: '#FFFFFF', contour: '#E2DCD4', surlignage: '#EFE9E1' },
  },
  {
    id: 'alpes-isere', name: 'Alpes Isère', radius: 8, button: 999,
    colours: { primaire: '#161616', surPrimaire: '#FFFFFF', texte: '#161616', description: '#3A3B45', libelle: '#4A4C5A', carte: '#D9DBE8', fond: '#FFFFFF', contour: '#C3C6DA', surlignage: '#EEEFF5' },
  },
  {
    id: 'societe-lac-paladru', name: 'Société du Lac de Paladru', radius: 4, button: 999, serif: true,
    colours: { primaire: '#880A0C', surPrimaire: '#FFFFFF', texte: '#440506', description: '#5C2526', libelle: '#6B3A3B', carte: '#FBEDED', fond: '#FFFFFF', contour: '#EDA5A6', surlignage: '#F6DADA' },
  },
  {
    id: 'plutot-la', name: 'Plutôt là', radius: 8, button: 999,
    colours: { primaire: '#0F6E6D', surPrimaire: '#FFFFFF', texte: '#0B3540', description: '#2E5560', libelle: '#4A6B73', carte: '#FFFFFF', fond: '#FEF4E1', contour: '#E3D6BD', surlignage: '#FFF2D3' },
  },
].map((p) => ({ ...p, colours: { ...p.colours, calme: '#2BB0AD', modere: '#FFC941', charge: '#FD795B', sature: '#E01E1E' } }));

/**
 * Camera views. `target` is what the lens looks at, `az`/`el` the direction it
 * looks from (degrees), `span` the width and height of the scene that must fit
 * in the free part of the screen, `blur` the depth-of-field strength, `sway`
 * how far the lens drifts around the view while nobody steers (degrees).
 */
export const STOPS = [
  { id: 'livre', target: [0, 1.6, -0.3], az: 3, el: 30, span: [26.8, 12.8], blur: 0.5, sway: 6 },
  { id: 'paladru', target: [-4.7, 0.6, 1.7], az: 17, el: 32, span: [10.2, 6.6], blur: 0.7 },
  { id: 'chemin', target: [0.7, 0.4, 2.9], az: 4, el: 41, span: [19.8, 9.6], blur: 0.45 },
  { id: 'besoins', target: [0, 2.0, 5.6], az: 0, el: 12, span: [9.8, 5.4], blur: 0.9 },
  { id: 'gestionnaire', target: [8.0, 1.9, -3.0], az: 15, el: 24, span: [8.2, 6.2], blur: 0.7 },
  { id: 'widget', target: [-8.8, 1.45, 4.9], az: -14, el: 15, span: [6.2, 4.4], blur: 0.75 },
];

// Other places the lens can stand inside a page.
export const SHOTS = [
  // The Éclaireurs in front, the lac du Lauvitel behind them: the place a wheelchair answer sets aside.
  { id: 'besoins-lauvitel', target: [2.7, 0.6, 1.4], az: -6, el: 34, span: [15.8, 10.4], blur: 0.35 },
];

export const START = { hour: 15, redirect: false, need: 'aucun', signal: false, partner: 'pays-voironnais' };

/**
 * The story, one beat per wheel step. `set` adds to what the beats before it
 * left, so a beat shows the same scene however it is reached. `via` is a
 * detour played only when stepping forward into the beat. `hold` is how long
 * the guided tour stays on it, in milliseconds.
 */
export const BEATS = [
  { stop: 'livre', hold: 5200 },
  { stop: 'paladru', hold: 4600 },
  { stop: 'paladru', set: { hour: 20 }, via: { hour: 8 }, hold: 7600 },
  { stop: 'chemin', set: { hour: 15 }, hold: 4600 },
  { stop: 'chemin', set: { redirect: true }, hold: 6800 },
  { stop: 'besoins', hold: 3600 },
  { stop: 'besoins', set: { need: 'canne' }, hold: 3600 },
  { stop: 'besoins', set: { need: 'chien' }, hold: 3600 },
  { stop: 'besoins', set: { need: 'fauteuil' }, hold: 5400 },
  { stop: 'gestionnaire', set: { need: 'aucun' }, hold: 4600 },
  { stop: 'gestionnaire', set: { signal: true }, hold: 5400 },
  { stop: 'widget', hold: 3800 },
  { stop: 'widget', set: { partner: 'grenoble-alpes-tourisme' }, hold: 2200 },
  { stop: 'widget', set: { partner: 'societe-lac-paladru' }, hold: 2200 },
  { stop: 'widget', set: { partner: 'plutot-la' }, hold: 3600 },
];

// Where each pin and note is anchored in the scene.
export const ANCHORS = {
  paladru: [-5.6, 1.5, 1.4],
  chemin: [7.3, 1.7, 3.3],
  besoins: [0, 2.3, 6.0],
  gestionnaire: [8.0, 3.5, -3.6],
  widget: [-9.6, 2.9, 3.9],
  bastille: [3.3, 3.7, -0.9],
};

// Where a site's pin comes to rest once its paper has folded into the page.
export const FOLDED = { lauvitel: [8.0, 0.9, -3.3] };
