// Instrument program/preview compositor (raw WebGL2, one fullscreen pass).
//
// Deck content is either a REAL frame stack (ImageBitmap textures via the
// §6.4-benched independent-frames path) or a procedural stand-in driven by the
// deck playhead. The 3-band EQ is approximated with multi-tap samples (flat EQ
// short-circuits via the HI+MID+LOW=full identity), and the two decks combine
// with the §7.4 premultiplied linear cross-dissolve. The exact 5-tap binomial
// pyramid EQ lives in app/engine/instrument/eq.ts as the tested reference; this
// shader is a lightweight port for the live surface. One renderer per output
// canvas, all driven by the same InstrumentSnapshot, so program and preview
// never drift.
import type { InstrumentSnapshot } from "../engine/instrument/store";

const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float uTime;
uniform vec2 uPhase;      // deck A/B playhead frame position
uniform vec3 uTintA, uTintB;
uniform vec2 uHas;        // deck loaded flags
uniform vec2 uUseTex;     // deck has a real frame texture
uniform sampler2D uTexA, uTexB;
uniform float uOA, uOB, uX;
uniform vec3 uEqA, uEqB;  // LOW/MID/HI gains

// Procedural stand-ins: deck A (seed 0) smooth mandala field, deck B (seed 1)
// sparse bright lattice on near-black so overlap reads as two layers.
vec3 pattern(vec2 uv, float phase, vec3 tint, float seed){
  vec2 c = uv - 0.5;
  float r = length(c);
  float a = atan(c.y, c.x);
  if (seed < 0.5) {
    float bands = sin((uv.x*7.0 + uv.y*3.0 + phase*0.25)*3.14159);
    float rings = sin(r*20.0 - phase*0.5 + uTime*0.4);
    float spokes = cos(a*6.0 + phase*0.15);
    float v = 0.5 + 0.34*bands*rings + 0.14*spokes;
    return tint * clamp(0.28 + 0.8*v, 0.0, 1.4);
  }
  float gx = sin((uv.x*22.0 + phase*0.3)*3.14159);
  float gy = sin((uv.y*13.0 - phase*0.2)*3.14159);
  float dots = pow(max(0.0, gx*gy), 6.0);
  float diag = pow(max(0.0, sin((uv.x - uv.y)*18.0 + phase*0.4 - uTime*0.3)), 5.0) * 0.6;
  float v = dots + diag;
  return tint * clamp(v * 1.9, 0.0, 1.6);
}

vec3 srcA(vec2 uv){
  if (uUseTex.x > 0.5) return texture(uTexA, vec2(uv.x, 1.0 - uv.y)).rgb;
  return pattern(uv, uPhase.x, uTintA, 0.0);
}
vec3 srcB(vec2 uv){
  if (uUseTex.y > 0.5) return texture(uTexB, vec2(uv.x, 1.0 - uv.y)).rgb;
  return pattern(uv, uPhase.y, uTintB, 1.0);
}

// 3-band EQ approximation. Flat gains (all 1) short-circuit — the identity
// HI+MID+LOW = full means flat EQ is exactly the source, and the taps are the
// expensive part.
vec3 eqA(vec2 uv, vec3 g){
  vec3 full = srcA(uv);
  if (abs(g.x-1.0) + abs(g.y-1.0) + abs(g.z-1.0) < 0.004) return clamp(full, 0.0, 1.0);
  vec3 g1 = vec3(0.0), g2 = vec3(0.0);
  for(int i=0;i<4;i++){
    float ang = float(i)*1.5708;
    g1 += srcA(uv + vec2(cos(ang),sin(ang))*0.010);
    g2 += srcA(uv + vec2(cos(ang),sin(ang))*0.030);
  }
  g1/=4.0; g2/=4.0;
  return clamp(g.x*g2 + g.y*(g1-g2) + g.z*(full-g1), 0.0, 1.0);
}
vec3 eqB(vec2 uv, vec3 g){
  vec3 full = srcB(uv);
  if (abs(g.x-1.0) + abs(g.y-1.0) + abs(g.z-1.0) < 0.004) return clamp(full, 0.0, 1.0);
  vec3 g1 = vec3(0.0), g2 = vec3(0.0);
  for(int i=0;i<4;i++){
    float ang = float(i)*1.5708;
    g1 += srcB(uv + vec2(cos(ang),sin(ang))*0.010);
    g2 += srcB(uv + vec2(cos(ang),sin(ang))*0.030);
  }
  g1/=4.0; g2/=4.0;
  return clamp(g.x*g2 + g.y*(g1-g2) + g.z*(full-g1), 0.0, 1.0);
}

void main(){
  vec3 A = uHas.x>0.5 ? eqA(vUv, uEqA) : vec3(0.0);
  vec3 B = uHas.y>0.5 ? eqB(vUv, uEqB) : vec3(0.0);
  float aA = uHas.x>0.5 ? uOA : 0.0;
  float aB = uHas.y>0.5 ? uOB : 0.0;
  vec3 pA = A*uOA, pB = B*uOB;   // premultiplied by channel opacity
  float wA = 1.0-uX, wB = uX;
  vec3 C = clamp(wA*pA + wB*pB, 0.0, 1.0);
  float al = clamp(wA*aA + wB*aB, 0.0, 1.0);
  o = vec4(C, al);
}`;

export type OutputMode = "program" | "previewA" | "previewB";
export type DeckFrames = { A?: ImageBitmap | null; B?: ImageBitmap | null };

export type Compositor = {
  render(snapshot: InstrumentSnapshot, mode: OutputMode, timeSec: number, frames?: DeckFrames): void;
  resize(w: number, h: number): void;
  dispose(): void;
};

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

export function createCompositor(canvas: HTMLCanvasElement): Compositor {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: true })!;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const uTime = u("uTime"), uPhase = u("uPhase"), uTintA = u("uTintA"), uTintB = u("uTintB");
  const uHas = u("uHas"), uUseTex = u("uUseTex"), uOA = u("uOA"), uOB = u("uOB"), uX = u("uX");
  const uEqA = u("uEqA"), uEqB = u("uEqB");
  gl.uniform1i(u("uTexA"), 0);
  gl.uniform1i(u("uTexB"), 1);
  const A_TINT: [number, number, number] = [1.0, 0.36, 0.69];
  const B_TINT: [number, number, number] = [0.23, 0.82, 1.0];

  const makeTex = () => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const texA = makeTex();
  const texB = makeTex();
  let lastA: ImageBitmap | null = null;
  let lastB: ImageBitmap | null = null;

  const uploadIfChanged = (unit: number, tex: WebGLTexture, bmp: ImageBitmap | null, last: ImageBitmap | null) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (bmp && bmp !== last) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    }
    return bmp;
  };

  return {
    render(s, mode, timeSec, frames) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, timeSec);
      gl.uniform2f(uPhase, s.A.framePosition, s.B.framePosition);
      gl.uniform3fv(uTintA, A_TINT);
      gl.uniform3fv(uTintB, B_TINT);
      gl.uniform3f(uEqA, s.A.eq.LOW, s.A.eq.MID, s.A.eq.HI);
      gl.uniform3f(uEqB, s.B.eq.LOW, s.B.eq.MID, s.B.eq.HI);
      lastA = uploadIfChanged(0, texA, frames?.A ?? null, lastA);
      lastB = uploadIfChanged(1, texB, frames?.B ?? null, lastB);
      gl.uniform2f(uUseTex, frames?.A ? 1 : 0, frames?.B ? 1 : 0);
      if (mode === "program") {
        gl.uniform2f(uHas, s.A.stackHash ? 1 : 0, s.B.stackHash ? 1 : 0);
        gl.uniform1f(uOA, s.A.opacity);
        gl.uniform1f(uOB, s.B.opacity);
        gl.uniform1f(uX, s.crossfader);
      } else {
        // preview: selected deck pre-channel-fader (opacity 1, no crossfade).
        const isA = mode === "previewA";
        gl.uniform2f(uHas, isA && s.A.stackHash ? 1 : 0, !isA && s.B.stackHash ? 1 : 0);
        gl.uniform1f(uOA, 1);
        gl.uniform1f(uOB, 1);
        gl.uniform1f(uX, isA ? 0 : 1);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
    },
    dispose() {
      gl.deleteBuffer(buf);
      gl.deleteTexture(texA);
      gl.deleteTexture(texB);
      gl.deleteProgram(prog);
    },
  };
}
