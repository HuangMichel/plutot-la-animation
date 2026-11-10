import { Composition } from 'remotion';
import { Film } from './Film.jsx';
import { FPS, FRAMES, HEIGHT, WIDTH } from './script.js';

export const Root = () => (
  <Composition id="Film" component={Film} durationInFrames={FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
