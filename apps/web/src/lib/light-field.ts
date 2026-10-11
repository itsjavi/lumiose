// The landing's light field: a light source at the top right of the hero, drawn with two small WebGL
// programs and no library. A full-screen fragment shader paints the glow, the rays and a slow nebula;
// a point list adds the photons drifting away from the source. The LightField island owns the loop,
// the pause control and reduced motion; this module only draws.

const FIELD_VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif`;

const FIELD_FRAGMENT = `${PRECISION}
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uSrc;
uniform float uIntensity;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - uSrc) * vec2(uRes.x / uRes.y, 1.0);
  float d = length(p);
  vec3 night = mix(vec3(0.027, 0.024, 0.102), vec3(0.05, 0.043, 0.15), uv.y);
  float rays = pow(fbm(vec2(atan(p.y, p.x) * 4.0, uTime * 0.04)), 2.6);
  float rayMask = rays * exp(-d * 1.35) * smoothstep(0.0, 0.25, d);
  float neb = fbm(p * 2.0 + vec2(uTime * 0.015, -uTime * 0.01));
  vec3 indigo = vec3(0.56, 0.52, 1.0);
  vec3 amber = vec3(1.0, 0.75, 0.42);
  vec3 col = night;
  col += indigo * exp(-d * 2.1) * (0.22 + 0.3 * neb) * uIntensity;
  col += mix(indigo, amber, 0.65) * rayMask * 0.75 * uIntensity;
  col += amber * exp(-d * d * 22.0) * 0.85 * uIntensity;
  col *= 1.0 - 0.3 * pow(length(uv - vec2(0.5, 0.6)) * 1.1, 2.0);
  col += (hash(uv * uRes + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const PHOTON_VERTEX = `
attribute float aSeed;
uniform float uTime;
uniform vec2 uSrc;
uniform float uScale;
uniform float uIntensity;
varying float vAlpha;
varying float vWarm;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float life = fract(uTime * (0.012 + 0.02 * h(aSeed * 1.7)) + h(aSeed * 3.1));
  float ang = 3.14159 + (h(aSeed * 5.3) - 0.35) * 2.2;
  float spd = 0.4 + 1.3 * h(aSeed * 7.9);
  vec2 pos = uSrc * 2.0 - 1.0 + vec2(cos(ang), sin(ang)) * life * spd;
  pos.x += sin(uTime * 0.4 + aSeed) * 0.01;
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = (1.2 + 2.6 * h(aSeed * 9.1)) * uScale * (1.2 - life * 0.6);
  vAlpha = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life)) * uIntensity;
  // They fade out before they reach the copy, which sits on the left (and below on tall screens).
  vAlpha *= smoothstep(-0.1, 0.4, pos.x) * smoothstep(-0.6, 0.2, pos.y);
  vWarm = h(aSeed * 2.3);
}`;

const PHOTON_FRAGMENT = `${PRECISION}
varying float vAlpha;
varying float vWarm;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(mix(vec3(0.62, 0.58, 1.0), vec3(1.0, 0.82, 0.55), vWarm) * a * vAlpha, 1.0);
}`;

const PHOTONS = 220;

/**
 * Where the light sits, in the canvas's unit square (0,0 bottom left): top right, beside the copy
 * on wide screens; above it on narrow ones, where the copy spans the whole width.
 */
const WIDE = { x: 0.84, y: 0.7 };
const TALL = { x: 0.84, y: 0.93 };

export interface LightField {
  /** Draws one frame: `time` in seconds, `intensity` from 0 (dark) to 1. */
  draw(time: number, intensity: number): void;
  /** Leans the light toward a point of the canvas (0..1, top left origin), a little. */
  lean(x: number, y: number): void;
  /** Matches the drawing buffer to the canvas's size. */
  resize(): void;
}

function program(gl: WebGLRenderingContext, vertex: string, fragment: string) {
  const linked = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(linked, shader);
  }
  gl.linkProgram(linked);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(linked) ?? "");
  return linked;
}

function buffer(gl: WebGLRenderingContext, data: Float32Array) {
  const created = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, created);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return created;
}

/** The light field on `canvas`, or undefined without WebGL (the page keeps its CSS gradient). */
export function createLightField(canvas: HTMLCanvasElement): LightField | undefined {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  if (gl === null) return undefined;
  let field: WebGLProgram;
  let photons: WebGLProgram;
  try {
    field = program(gl, FIELD_VERTEX, FIELD_FRAGMENT);
    photons = program(gl, PHOTON_VERTEX, PHOTON_FRAGMENT);
  } catch {
    return undefined;
  }
  // One triangle covers the screen; one seed per photon.
  const quad = buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
  const seeds = buffer(
    gl,
    Float32Array.from({ length: PHOTONS }, (_, i) => i + 1),
  );
  const u = (target: WebGLProgram, name: string) => gl.getUniformLocation(target, name);
  const fieldAttribute = gl.getAttribLocation(field, "aPos");
  const seedAttribute = gl.getAttribLocation(photons, "aSeed");

  // The field is soft: half the device resolution is enough, and costs a quarter of the pixels.
  // `scale` is drawing-buffer pixels per CSS pixel; photon sizes follow it.
  let scale = 1;
  let base = WIDE;
  const source = { ...base };
  const target = { ...base };

  return {
    resize() {
      scale = Math.min(devicePixelRatio, 2) / 2;
      const width = Math.max(1, Math.round(canvas.clientWidth * scale));
      const height = Math.max(1, Math.round(canvas.clientHeight * scale));
      // Below 64rem (the landing's `$bp.lg`) the copy spans the whole width, under the light.
      const next = canvas.clientWidth >= 1024 && width >= height ? WIDE : TALL;
      if (next !== base) {
        base = next;
        Object.assign(source, base);
        Object.assign(target, base);
      }
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    },
    lean(x, y) {
      target.x = base.x + (x - 0.5) * 0.1;
      target.y = base.y + (0.5 - y) * 0.06;
    },
    draw(time, intensity) {
      source.x += (target.x - source.x) * 0.04;
      source.y += (target.y - source.y) * 0.04;

      gl.disable(gl.BLEND);
      gl.useProgram(field);
      gl.uniform1f(u(field, "uTime"), time);
      gl.uniform2f(u(field, "uRes"), canvas.width, canvas.height);
      gl.uniform2f(u(field, "uSrc"), source.x, source.y);
      gl.uniform1f(u(field, "uIntensity"), intensity);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(fieldAttribute);
      gl.vertexAttribPointer(fieldAttribute, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(fieldAttribute);

      // Photons add light: additive blending over the field.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(photons);
      gl.uniform1f(u(photons, "uTime"), time);
      gl.uniform2f(u(photons, "uSrc"), source.x, source.y);
      gl.uniform1f(u(photons, "uScale"), scale);
      gl.uniform1f(u(photons, "uIntensity"), intensity);
      gl.bindBuffer(gl.ARRAY_BUFFER, seeds);
      gl.enableVertexAttribArray(seedAttribute);
      gl.vertexAttribPointer(seedAttribute, 1, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, PHOTONS);
      gl.disableVertexAttribArray(seedAttribute);
    },
  };
}
