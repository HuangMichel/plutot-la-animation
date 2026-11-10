import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import '@fontsource-variable/fredoka/index.css';
import '@fontsource-variable/nunito/index.css';
import './film.css';
import { createFilmStage, loadAssets } from './stage/filmStage.js';
import { Cards } from './overlays/Cards.jsx';
import { Pins } from './overlays/Pins.jsx';
import { Words } from './overlays/Words.jsx';

export const Film = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvas = useRef(null);
  const [stage, setStage] = useState(null);
  const [handle] = useState(() => delayRender('Le livre se met en place'));

  useEffect(() => {
    let made = null;
    loadAssets(staticFile).then((assets) => {
      made = createFilmStage(canvas.current, assets, { width, height });
      setStage(made);
      continueRender(handle);
    });
    return () => made?.dispose();
  }, [handle, width, height]);

  // The book is brought to the frame first, so the labels know where its places are.
  const view = useMemo(() => stage?.seek(frame) ?? null, [stage, frame]);
  useLayoutEffect(() => {
    if (view) stage.draw();
  }, [stage, view]);

  const t = frame / fps;
  return (
    <AbsoluteFill className="film">
      <canvas ref={canvas} />
      {view && (
        <>
          <Pins t={t} view={view} />
          <Cards t={t} view={view} />
          <Words t={t} />
        </>
      )}
    </AbsoluteFill>
  );
};
