import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/index.js');
// The film borrows the presentation's illustrations instead of copying them.
Config.setPublicDir('../public');
// The book is a WebGL scene: ANGLE gives the headless browser the real GPU.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(96);
Config.setColorSpace('bt709');
// The lens adds grain to every frame: a slow preset keeps it without a heavy file.
Config.setCrf(17);
Config.setX264Preset('slow');
