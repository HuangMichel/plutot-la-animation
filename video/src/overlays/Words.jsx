import { DURATION, T, WORDS } from '../script.js';
import { fall, ramp, rise } from './motion.js';

const Line = ({ t, at, out, as: Tag = 'p', className, children }) => {
  const stays = out === undefined;
  const angle = (1 - rise(t, at)) * 86 + (stays ? 0 : ramp(t, out, out + 0.25, fall) * 86);
  const opacity = ramp(t, at, at + 0.1) * (stays ? 1 : 1 - ramp(t, out + 0.15, out + 0.25));
  return (
    <Tag className={className} style={{ transform: `perspective(1600px) rotateX(${angle}deg)`, opacity }}>
      {children}
    </Tag>
  );
};

/** What is said on the table, beside the closed book: the premise, then the promise. */
export const Words = ({ t }) => (
  <>
    {t < T.open && (
      <div className="words" style={WORDS}>
        <Line t={t} as="h1" at={T.intro} out={T.introOut}>
          {'En Isère, 2\u202f872 sites touristiques.'}
        </Line>
        <Line t={t} className="lead" at={T.intro + 0.18} out={T.introOut}>
          Plutôt là dit s’il y aura du monde.
        </Line>
      </div>
    )}
    {t > T.end && (
      <div className="words" style={WORDS}>
        <Line t={t} as="h1" at={T.end}>
          À vous d’essayer.
        </Line>
        <Line t={t} className="link" at={T.end + 0.3}>
          Ouvrir l’application<b>plutola.hackathon-flux-touristique.vicode.fr</b>
        </Line>
        <Line t={t} className="link" at={T.end + 0.4}>
          Voir le widget<b>sdk.hackathon-flux-touristique.vicode.fr</b>
        </Line>
        <Line t={t} className="fine" at={T.end + 0.6}>
          {'Projet du hackathon DGE «\u00a0Gestion des flux touristiques\u00a0». L’affluence est une estimation\u00a0; les figurines et les partenaires sont des démonstrations.'}
        </Line>
      </div>
    )}
    <div className="fade" style={{ opacity: ramp(t, DURATION - 0.7, DURATION - 0.1) }} />
  </>
);
