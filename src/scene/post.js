import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const quadVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

// Depth of field, worked out at half size and laid over the sharp picture:
//   1. shrink: the scene at half size, each pixel keeping one view depth;
//   2. gather: each pixel collects the neighbours whose own blur circle reaches it;
//   3. the grade pass adds the result where there is blur, and only there.
// Blur is soft by nature, so half the resolution costs a quarter and shows nothing.

const shrinkFragment = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uNear, uFar, uFocus;
  varying vec2 vUv;
  float viewDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
    return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  }
  void main() {
    // Of the four pixels under this one, keep the depth nearest the focal
    // plane: a block that straddles an edge then counts as sharp, and stays
    // out of the blur around it.
    vec2 o = uTexel * 0.5;
    vec4 d = vec4(viewDepth(vUv - o), viewDepth(vUv + vec2(o.x, -o.y)), viewDepth(vUv + vec2(-o.x, o.y)), viewDepth(vUv + o));
    vec4 off = abs(d - uFocus);
    float depth = off.x <= min(off.y, min(off.z, off.w)) ? d.x : off.y <= min(off.z, off.w) ? d.y : off.z <= off.w ? d.z : d.w;
    // One filtered tap between four pixels is their average.
    gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, depth);
  }`;

const gatherFragment = `
  uniform sampler2D tHalf;
  uniform vec2 uTexel;
  uniform float uFocus, uAperture, uMaxBlur;
  varying vec2 vUv;
  // 36 taps on three rings of 6, 12 and 18: each stands for the same share of the disc.
  const float SHARE = 4.0 / 147.0;
  float blurOf(float depth) {
    return clamp(abs(depth - uFocus) / uFocus * uAperture, 0.0, 1.0) * uMaxBlur;
  }
  void main() {
    vec4 centre = texture2D(tHalf, vUv);
    float radius = blurOf(centre.a);
    vec3 sum = vec3(0.0);
    float cover = 0.0;
    for (int ring = 1; ring <= 3; ring++) {
      float r = uMaxBlur * float(ring) * 2.0 / 7.0;
      int count = ring * 6;
      float step = 6.2831853 / float(count);
      mat2 turn = mat2(cos(step), sin(step), -sin(step), cos(step));
      vec2 dir = vec2(cos(step * 0.5 * float(ring)), sin(step * 0.5 * float(ring))) * r * uTexel;
      for (int i = 0; i < count; i++) {
        vec4 tap = texture2D(tHalf, vUv + dir);
        dir = turn * dir;
        float b = blurOf(tap.a);
        // What lies behind a sharper pixel must not spill onto it.
        if (tap.a > centre.a) b = min(b, radius * 2.0);
        // A wide circle spreads its light thin: the part that lands here shrinks with its area.
        float k = smoothstep(r - 1.0, r + 1.0, b) * SHARE * uMaxBlur * uMaxBlur / max(b * b, 1.0);
        sum += tap.rgb * k;
        cover += k;
      }
    }
    // Barely out of focus: the half-size picture is itself the small blur.
    float self = smoothstep(0.5, 2.5, radius) * max(0.0, 1.0 - cover);
    sum += centre.rgb * self;
    cover += self;
    // Premultiplied: alpha says how much of the sharp picture this replaces.
    gl_FragColor = vec4(sum / max(1.0, cover), min(1.0, cover));
  }`;

// The lens: the blur laid over the sharp picture, a soft vignette toward the
// table's dark, and a breath of grain.
const gradeFragment = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tSoft;
  uniform float uSoft, uTime, uVignette, uAspect;
  uniform vec2 uCentre;
  varying vec2 vUv;
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    vec4 soft = texture2D(tSoft, vUv) * uSoft;
    c = c * (1.0 - soft.a) + soft.rgb;
    vec2 d = (vUv - uCentre) * vec2(uAspect, 1.0);
    float v = smoothstep(0.35, 1.15, length(d));
    c *= 1.0 - uVignette * v;
    float g = hash(gl_FragCoord.xy + fract(uTime) * 311.0) - 0.5;
    c += c * g * 0.055;
    gl_FragColor = vec4(c, 1.0);
  }`;

const pass = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: quadVertex, fragmentShader, depthTest: false, depthWrite: false });

export class Lens {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.dofOn = true;
    this.bloomOn = true;

    const hdr = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
    const flat = { ...hdr, depthBuffer: false };
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { ...hdr, samples: 4, depthTexture: new THREE.DepthTexture(1, 1) });
    this.half = new THREE.WebGLRenderTarget(1, 1, flat);
    this.soft = new THREE.WebGLRenderTarget(1, 1, flat);
    this.graded = new THREE.WebGLRenderTarget(1, 1, flat);

    const texel = { value: new THREE.Vector2() };
    const focus = { value: 20 };
    this.shrink = pass(shrinkFragment, {
      tDiffuse: { value: this.sceneTarget.texture }, tDepth: { value: this.sceneTarget.depthTexture },
      uTexel: texel, uNear: { value: camera.near }, uFar: { value: camera.far }, uFocus: focus,
    });
    this.gather = pass(gatherFragment, { tHalf: { value: this.half.texture }, uTexel: texel, uFocus: focus, uAperture: { value: 1 }, uMaxBlur: { value: 8 } });
    this.grade = pass(gradeFragment, {
      tDiffuse: { value: this.sceneTarget.texture }, tSoft: { value: this.soft.texture }, uSoft: { value: 1 },
      uTime: { value: 0 }, uVignette: { value: 0.5 }, uCentre: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 },
    });
    this.quad = new FullScreenQuad(this.shrink);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.6, 1.1);
    this.output = new OutputPass();
    this.output.renderToScreen = true;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
  }

  setSize(w, h) {
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    this.sceneTarget.setSize(w, h);
    this.half.setSize(hw, hh);
    this.soft.setSize(hw, hh);
    this.graded.setSize(w, h);
    this.bloom.setSize(w, h);
    this.output.setSize(w, h);
    this.shrink.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.grade.uniforms.uAspect.value = w / h;
    this.height = h;
  }

  draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  /** `focus` is the distance to what should be sharp; `strength` scales the blur. */
  render(t, focus, strength) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneTarget);
    r.render(this.scene, this.camera);

    const soft = this.dofOn && strength > 0.01;
    if (soft) {
      const s = this.shrink.uniforms, g = this.gather.uniforms;
      s.uNear.value = this.camera.near;
      s.uFar.value = this.camera.far;
      s.uFocus.value = focus;
      g.uAperture.value = 1.8 * strength;
      g.uMaxBlur.value = (this.height / 900) * 8.5;
      this.draw(this.shrink, this.half);
      this.draw(this.gather, this.soft);
    }
    this.grade.uniforms.uSoft.value = soft ? 1 : 0;
    this.grade.uniforms.uTime.value = t;
    this.draw(this.grade, this.graded);

    if (this.bloomOn) this.bloom.render(r, null, this.graded, 0, false);
    this.output.render(r, null, this.graded, 0, false);
  }
}
