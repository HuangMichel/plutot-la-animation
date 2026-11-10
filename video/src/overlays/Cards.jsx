import { Easing } from 'remotion';
import { HOURS, LEVELS, LEVEL_COLOURS, levelAt } from '../../../src/data.js';
import { LEVEL_TURNS, T, clamp01, hourAt } from '../script.js';
import { QUICK, fall, ramp, rise } from './motion.js';

const Card = ({ t, from, to, sun, children }) => {
  if (t <= from || t >= to + 0.3) return null;
  const angle = (1 - rise(t, from)) * 84 + ramp(t, to, to + 0.26, fall) * 84;
  const opacity = ramp(t, from, from + 0.1) * (1 - ramp(t, to + 0.16, to + 0.26));
  return (
    <div className="card" style={{ transform: `perspective(1800px) rotateX(${angle}deg)`, opacity }}>
      {children}
      <i className="light" style={{ background: `color-mix(in srgb, ${sun} 20%, white)` }} />
    </div>
  );
};

/** The day's forecast, the hour under the sun arm picked out. */
const Hours = ({ t, from }) => {
  const hour = hourAt(t);
  const level = levelAt(hour);
  const turn = LEVEL_TURNS.findLast((x) => x.t <= t);
  const beat = turn ? 1 - rise(t, turn.t, QUICK) : 0;
  return (
    <div className="hours">
      <div className="bars">
        {HOURS.map((h, i) => {
          const near = clamp01(1 - Math.abs(hour - h.hour));
          const grown = rise(t, from + 0.3 + i * 0.04, QUICK);
          return (
            <i
              key={h.hour}
              style={{
                '--c': LEVEL_COLOURS[h.level],
                height: `${h.height * 100}%`,
                opacity: 0.45 + 0.55 * near,
                transform: `scaleY(${grown * (1 + 0.06 * near)})`,
                boxShadow: `0 0 0 4px rgba(11, 53, 64, ${near})`,
              }}
            />
          );
        })}
      </div>
      <div className="ticks">
        <span style={{ opacity: clamp01((hour - 8.7) / 0.6) }}>8 h</span>
        <span style={{ opacity: clamp01((19.3 - hour) / 0.6) }}>20 h</span>
        <b style={{ left: `${((hour - 7.5) / 13) * 100}%` }}>{Math.round(hour)} h</b>
      </div>
      <div className="verdict">
        <i style={{ '--c': LEVEL_COLOURS[level], transform: `scale(${1 + 0.3 * beat})` }} />
        <p>
          <strong>{LEVELS[level].name}</strong>
          {LEVELS[level].advice.replace(' :', '\u00a0:')}
        </p>
      </div>
    </div>
  );
};

/** A fingertip on the manager's screen. */
const Tap = ({ t, at }) => {
  if (t < at - 0.3 || t > at + 0.45) return null;
  const down = ramp(t, at - 0.3, at);
  const out = ramp(t, at, at + 0.45, Easing.out(Easing.cubic));
  return <i className="tap" style={{ opacity: down * (1 - out), transform: `scale(${1.5 - 0.5 * down + 0.9 * out})` }} />;
};

const press = (t, at) => ({ transform: `scale(${1 - 0.05 * ramp(t, at - 0.08, at) * (1 - ramp(t, at, at + 0.25))})` });

const said = (level) => LEVELS[level].name.toLowerCase();

export const Cards = ({ t, view }) => {
  const { sun, partner, levels } = view;
  const published = t >= T.publish;
  const pasted = t >= T.paste;
  const swap = Math.max(T.board + 0.2, ...T.partners.filter((x) => x <= t));
  return (
    <>
      <Card t={t} from={T.lake} to={T.lakeOut} sun={sun}>
        <p className="place">Lac de Paladru, samedi 11 juillet 2026</p>
        <h2>{'Y aura-t-il du monde\u00a0?'}</h2>
        <Hours t={t} from={T.lake} />
      </Card>

      <Card t={t} from={T.chemin} to={T.cheminOut} sun={sun}>
        <h2>Un coin plus calme, et le chemin.</h2>
        <p>
          Étang du Sauget, à 17 km.
          <br />
          Le lac passe de {said(levelAt(hourAt(t)))} à {said(levels.paladru)}.
        </p>
      </Card>

      <Card t={t} from={T.besoins} to={T.besoinsOut} sun={sun}>
        <h2>{'Avez-vous des besoins particuliers\u00a0?'}</h2>
        <p className="even">Sept questions en images. Les lieux qui ne conviennent pas sont mis de côté.</p>
      </Card>

      <Card t={t} from={T.gestionnaire} to={T.gestionnaireOut} sun={sun}>
        <h2>Le gestionnaire prévient en deux gestes.</h2>
        <div className="levels">
          {Object.entries(LEVELS).map(([id, level]) => (
            <span key={id} className={id === 'sature' && t >= T.niveau ? 'is-on' : ''} style={id === 'sature' ? press(t, T.niveau) : null}>
              <i style={{ '--c': LEVEL_COLOURS[id] }} />
              {level.name}
              {id === 'sature' && <Tap t={t} at={T.niveau} />}
            </span>
          ))}
        </div>
        <div className={`btn${published ? ' is-done' : ''}`} style={press(t, T.publish)}>
          Publier le signalement
          <Tap t={t} at={T.publish} />
        </div>
        <p className="status">
          {published ? 'C’est publié\u00a0! Le signalement remplace l’estimation chez le visiteur.' : `Lac du Lauvitel\u00a0: ${said(levels.lauvitel)}, d’après l’estimation.`}
        </p>
      </Card>

      <Card t={t} from={T.widget} to={T.widgetOut} sun={sun}>
        <h2>Deux lignes pour un office de tourisme.</h2>
        <pre className="code">
          {pasted ? '<script type="module" src="https://sdk.hackathon-flux-touristique.vicode.fr/embed/plutot-la-widget.js"></script>\n<plutot-la-widget partenaire="' : (t * 2) % 1 < 0.5 ? '▍\n ' : ' \n '}
          {pasted && <b>{partner.id}</b>}
          {pasted && '" config="…"></plutot-la-widget>'}
          <i className="flash" style={{ opacity: pasted ? 0.5 * (1 - ramp(t, T.paste, T.paste + 0.5)) : 0 }} />
        </pre>
        <p className="partner" style={{ transform: `scale(${t < T.board + 0.2 ? 0 : 0.85 + 0.15 * rise(t, swap, QUICK)})` }}>
          <span className="swatch">
            {[partner.colours.primaire, partner.colours.carte, partner.colours.texte].map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </span>
          {partner.name}
          <em>démo</em>
        </p>
        <p>
          Le widget prend les couleurs du site.
          <br />
          Pas de compte, pas de clé, pas de serveur.
        </p>
      </Card>

      <Card t={t} from={T.moment} to={T.momentOut} sun={sun}>
        <p className="place">Lac de Paladru, le même samedi</p>
        <h2>Et le bon moment.</h2>
        <Hours t={t} from={T.moment} />
      </Card>
    </>
  );
};
