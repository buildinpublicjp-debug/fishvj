// Instrument program/preview compositor (raw WebGL2, one fullscreen pass).
//
// Deck content is a procedural stand-in driven by each deck's playhead (real
// video stacks are WebCodecs-gated). The 3-band EQ is approximated from
// multi-tap samples of that procedural field, and the two decks are combined
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
uniform float uOA, uOB, uX;
uniform vec3 uEqA, uEqB;  // LOW/MID/HI gains

// seed differentiates deck geometry so decks A/B are distinct content, not just
// a tint of the same pattern (seed 0 = concentric mandala, seed 1 = flowing
// diagonal weave).
vec3 pattern(vec2 uv, float phase, vec3 tint, float seed){
  vec2 c = uv - 0.5;
  float r = length(c);
  float a = atan(c.y, c.x);
  float f = 5.0 + seed*5.0;
  float bands = sin((uv.x*f + uv.y*(2.0+seed*3.0) + phase*0.25)*3.14159);
  float rings = sin(r*(20.0 - seed*12.0) - phase*0.5 + uTime*0.4);
  float spokes = cos(a*(6.0 + seed*6.0) + phase*0.15 + seed*1.7);
  float diag = sin((uv.x - uv.y)*(6.0 + seed*10.0) + phase*0.35 - uTime*0.3);
  float v = 0.5 + mix(0.34*bands*rings + 0.14*spokes, 0.30*diag + 0.16*bands, seed);
  return tint * clamp(0.25 + 0.85*v, 0.0, 1.4);
}

// 3-band EQ approximated from concentric procedural samples.
vec3 eq(vec2 uv, float phase, vec3 tint, vec3 g, float seed){
  vec3 full = pattern(uv, phase, tint, seed);
  vec3 g1 = vec3(0.0), g2 = vec3(0.0);
  for(int i=0;i<6;i++){
    float ang = float(i)*1.0472;
    g1 += pattern(uv + vec2(cos(ang),sin(ang))*0.010, phase, tint, seed);
    g2 += pattern(uv + vec2(cos(ang),sin(ang))*0.030, phase, tint, seed);
  }
  g1/=6.0; g2/=6.0;
  vec3 low = g2, mid = g1-g2, hi = full-g1;
  return clamp(g.x*low + g.y*mid + g.z*hi, 0.0, 1.0);
}

void main(){
  vec3 A = uHas.x>0.5 ? eq(vUv, uPhase.x, uTintA, uEqA, 0.0) : vec3(0.0);
  vec3 B = uHas.y>0.5 ? eq(vUv, uPhase.y, uTintB, uEqB, 1.0) : vec3(0.0);
  float aA = uHas.x>0.5 ? uOA : 0.0;
  float aB = uHas.y>0.5 ? uOB : 0.0;
  vec3 pA = A*uOA, pB = B*uOB;   // premultiplied by channel opacity
  float wA = 1.0-uX, wB = uX;
  vec3 C = clamp(wA*pA + wB*pB, 0.0, 1.0);
  float al = clamp(wA*aA + wB*aB, 0.0, 1.0);
  o = vec4(C, al);
}`;

export type OutputMode = "program" | "previewA" | "previewB";

export type Compositor = {
  render(snapshot: InstrumentSnapshot, mode: OutputMode, timeSec: number): void;
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
  const uHas = u("uHas"), uOA = u("uOA"), uOB = u("uOB"), uX = u("uX"), uEqA = u("uEqA"), uEqB = u("uEqB");
  const A_TINT: [number, number, number] = [1.0, 0.36, 0.69];
  const B_TINT: [number, number, number] = [0.23, 0.82, 1.0];

  return {
    render(s, mode, timeSec) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, timeSec);
      gl.uniform2f(uPhase, s.A.framePosition, s.B.framePosition);
      gl.uniform3fv(uTintA, A_TINT);
      gl.uniform3fv(uTintB, B_TINT);
      gl.uniform3f(uEqA, s.A.eq.LOW, s.A.eq.MID, s.A.eq.HI);
      gl.uniform3f(uEqB, s.B.eq.LOW, s.B.eq.MID, s.B.eq.HI);
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
      gl.deleteProgram(prog);
    },
  };
}
