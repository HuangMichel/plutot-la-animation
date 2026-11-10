import { LEVELS, LEVEL_COLOURS } from '../../../src/data.js';
import { HEROES, T } from '../script.js';
import { PAPER, QUICK, fall, ramp, rise } from './motion.js';

const NEEDS = { chapeau: 'Aucun', canne: 'Canne blanche', fauteuil: 'Fauteuil roulant', chien: 'Avec un chien' };

const Pin = ({ t, at, from, to, kind = '', lift = 20, children }) => {
  if (t <= from || t >= to + 0.2) return null;
  const size = rise(t, from, kind.includes('is-hero') ? PAPER : QUICK) * (1 - ramp(t, to, to + 0.2, fall));
  return (
    <div className={`pin ${kind}`} style={{ transform: `translate(${at.x}px, ${at.y}px) translate(-50%, -100%) translateY(${-lift}px) scale(${size})` }}>
      {children}
    </div>
  );
};

export const Pins = ({ t, view }) => {
  const { at, levels, signalled } = view;
  const told = 1 + 0.3 * (t > T.publish ? 1 - rise(t, T.publish, QUICK) : 0);
  return (
    <>
      {Object.keys(HEROES).map((id, i) => (
        <Pin key={id} t={t} at={at[id]} from={T.heroes[i] + 0.3} to={T.besoinsOut} kind="is-plain">
          {NEEDS[id]}
        </Pin>
      ))}

      <Pin t={t} at={at.paladru} from={T.settle + 0.3} to={T.cheminOut}>
        <i style={{ '--c': LEVEL_COLOURS[levels.paladru] }} />
        <span>
          Lac de Paladru<small>{LEVELS[levels.paladru].name}</small>
        </span>
      </Pin>
      <Pin t={t} at={at.sauget} from={T.settle + 0.4} to={T.cheminOut} kind="is-plain">
        <span>
          Étang du Sauget<small>à 17 km</small>
        </span>
      </Pin>
      <Pin t={t} at={at.lauvitel} from={T.gestionnaire + 0.4} to={T.gestionnaireOut}>
        <i style={{ '--c': LEVEL_COLOURS[levels.lauvitel], transform: `scale(${told})` }} />
        <span>
          Lac du Lauvitel<small>{signalled ? 'Saturé, signalé' : LEVELS[levels.lauvitel].name}</small>
        </span>
      </Pin>

      <Pin t={t} at={at.plein} from={T.plein} to={T.settle} kind="is-hero is-plain" lift={35}>
        {'C’est plein\u00a0?'}
      </Pin>
      <Pin t={t} at={at.la} from={T.la} to={T.settle} kind="is-hero is-plain is-sun" lift={35}>
        Plutôt là.
      </Pin>
    </>
  );
};
