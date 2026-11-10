import { Easing, interpolate, spring } from 'remotion';
import { FPS } from '../script.js';

// The spring of the book's own pop-ups (src/scene/paper.js): labels stand up the way its paper does.
export const PAPER = { stiffness: 120, damping: 13, mass: 1 };
export const QUICK = { stiffness: 210, damping: 16, mass: 1 };

/** 0 before `at`, then springs to 1 with a little overshoot. */
export const rise = (t, at, config = PAPER) => (t <= at ? 0 : spring({ frame: Math.round((t - at) * FPS * 100) / 100, fps: FPS, config }));

/** 0 before `from`, 1 after `to`. */
export const ramp = (t, from, to, easing = Easing.inOut(Easing.cubic)) =>
  interpolate(t, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const fall = Easing.in(Easing.cubic);
