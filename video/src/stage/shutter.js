import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

// The canvas holds display values; light only adds up once they are decoded.
const addFragment = `
  uniform sampler2D tFrame;
  uniform float uWeight;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tFrame, vUv).rgb;
    c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
    gl_FragColor = vec4(c * uWeight, 1.0);
  }`;

const showFragment = `
  uniform sampler2D tSum;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSum, vUv).rgb;
    c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    gl_FragColor = vec4(c, 1.0);
  }`;

const pass = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });

/**
 * A shutter in front of the presentation's lens. A frame in which the camera
 * travels is the average of several exposures along the way, so a fast move
 * smears like film instead of strobing. The lens is taken as it is: each
 * exposure is its finished picture, copied off the canvas.
 */
export class Shutter {
  constructor(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.renderer = renderer;
    this.frame = new THREE.FramebufferTexture(size.x, size.y);
    this.sum = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.add = pass(addFragment, { tFrame: { value: this.frame }, uWeight: { value: 1 } });
    this.show = pass(showFragment, { tSum: { value: this.sum.texture } });
    this.quad = new FullScreenQuad(this.add);
  }

  /** `expose(k)` draws exposure `k` of `count` on the canvas. */
  take(count, expose) {
    if (count === 1) return expose(0);
    const r = this.renderer;
    this.add.uniforms.uWeight.value = 1 / count;
    for (let k = 0; k < count; k++) {
      expose(k);
      r.setRenderTarget(null);
      r.copyFramebufferToTexture(this.frame);
      // The first exposure replaces what the sum held, the others add to it.
      this.add.blending = k ? THREE.AdditiveBlending : THREE.NoBlending;
      this.quad.material = this.add;
      r.setRenderTarget(this.sum);
      r.autoClear = false;
      this.quad.render(r);
      r.autoClear = true;
    }
    this.quad.material = this.show;
    r.setRenderTarget(null);
    this.quad.render(r);
  }
}
