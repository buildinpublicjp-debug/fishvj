"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type ModeName = "MYSTIC" | "SENSUAL" | "EUPHORIC";
export type ColorPreset = "CLEAN" | "PUNCH" | "ACID" | "DEEP";
export type SwimType = "SCHOOL" | "GLIDE" | "WAVE" | "FLOAT";

export type AudioLevels = {
  kick: number;
  bass: number;
  mid: number;
  high: number;
};

export type VisualConfig = {
  mode: ModeName;
  colorPreset: ColorPreset;
  colorDrive: number;
  fishCount: number;
  speed: number;
  depth: number;
  dive: boolean;
  selectedSpecies: number;
  swimType: SwimType;
};

type FishCanvasProps = {
  config: VisualConfig;
  audio: AudioLevels;
  onFps: (fps: number) => void;
};

const MAX_FISH = 2000;

const backgroundVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const backgroundFragment = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uKick;
  uniform float uBass;
  uniform float uHigh;
  uniform float uDive;
  uniform float uMode;
  uniform float uDrive;
  uniform float uColorPreset;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec3 palette(float t) {
    vec3 a = vec3(0.035, 0.055, 0.12);
    vec3 b = vec3(0.48, 0.48, 0.56);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = mix(
      vec3(0.02, 0.33, 0.68),
      uMode < 0.5 ? vec3(0.55, 0.08, 0.82) :
      (uMode < 1.5 ? vec3(0.95, 0.18, 0.03) : vec3(0.05, 0.82, 0.72)),
      0.55
    );
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    float r = length(p);
    float a = atan(p.y, p.x);
    float travel = uTime * (0.08 + uDive * 0.85 + uBass * 0.14);

    float invR = 0.12 / max(r, 0.035);
    float tunnelBands = abs(fract(invR * 2.15 - travel) - 0.5);
    float ring = smoothstep(0.12, 0.015, tunnelBands);
    float spokes = pow(max(0.0, cos(a * (8.0 + uMode * 2.0) + invR * 1.8 - travel * 0.7)), 18.0);
    float spiral = pow(max(0.0, sin(a * 5.0 + log(r + 0.03) * 8.0 - travel * 1.5)), 11.0);

    vec2 starCell = floor((p / max(r, 0.12) * invR + travel * vec2(0.15, 0.08)) * 75.0);
    float starSeed = hash21(starCell);
    float star = step(0.982, starSeed) * smoothstep(1.0, 0.1, r);

    float pulse = 1.0 + uKick * 0.65;
    vec3 col = vec3(0.0015, 0.003, 0.015);
    col += palette(invR * 0.45 + a / 6.28318 + travel * 0.05) * ring * (0.11 + 0.32 * uDive) * pulse;
    col += palette(a / 6.28318 + uTime * 0.02) * spokes * (0.025 + uDrive * 0.05);
    col += palette(invR + 0.28) * spiral * 0.035 * (0.3 + uDive);
    col += palette(starSeed + uTime * 0.03) * star * (0.12 + uHigh * 0.75);

    float portal = exp(-r * (10.0 + 4.0 * sin(uTime * 0.5)));
    col += mix(vec3(0.0, 0.6, 1.0), vec3(1.0, 0.0, 0.74), 0.5 + 0.5 * sin(uTime * 0.7)) * portal * (0.35 + uKick);

    float vignette = smoothstep(1.5, 0.15, r);
    col *= 0.32 + 0.85 * vignette;

    if (uColorPreset > 2.5) col *= vec3(0.52, 0.66, 0.82);
    if (uColorPreset > 0.5 && uColorPreset < 1.5) col = (col - 0.045) * 1.38 + 0.045;
    if (uColorPreset > 1.5 && uColorPreset < 2.5) col *= 1.15 + 0.2 * sin(vec3(0.0, 2.1, 4.2) + uTime * 0.7);

    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const fishVertex = `
  precision highp float;
  attribute vec3 aOffset;
  attribute float aScale;
  attribute float aPhase;
  attribute float aSpecies;
  attribute float aMotion;
  attribute float aVelocity;
  attribute float aDirection;
  varying vec2 vUv;
  varying float vSpecies;
  varying float vDepth;
  varying float vFocus;
  uniform float uTime;
  uniform float uAspect;
  uniform float uKick;
  uniform float uBass;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uDepth;
  uniform float uDive;
  uniform float uMode;
  uniform float uSelectedSpecies;
  uniform float uSwimFocus;

  void main() {
    vUv = uv;
    vSpecies = aSpecies;

    float modeSpeed = uMode < 0.5 ? 0.56 : (uMode < 1.5 ? 0.84 : 1.25);
    float zSpeed = (0.018 + uDive * 0.135) * uSpeed * modeSpeed * aVelocity;
    float z = fract(aOffset.z + uTime * zSpeed);
    z = mix(0.18, 1.0, pow(z, mix(1.35, 0.75, uDepth)));
    vDepth = z;

    float flow = uTime * (0.035 + 0.075 * uSpeed) * aVelocity * modeSpeed * aDirection;
    float x = mod(aOffset.x + flow + 1.55, 3.1) - 1.55;
    float y = aOffset.y;

    float school = 1.0 - step(0.5, abs(aMotion - 0.0));
    float glide = 1.0 - step(0.5, abs(aMotion - 1.0));
    float wave = 1.0 - step(0.5, abs(aMotion - 2.0));
    float floating = 1.0 - step(0.5, abs(aMotion - 3.0));

    y += sin(uTime * 1.7 * aVelocity + aPhase * 9.0 + x * 3.0) * (0.018 * school + 0.008 * glide);
    y += sin(uTime * 1.05 + aPhase * 6.0) * 0.052 * wave;
    y += sin(uTime * 0.52 + aPhase * 4.0) * 0.07 * floating;
    x += cos(uTime * 0.62 + aPhase * 5.0) * 0.018 * floating;

    float radialScale = mix(0.045, 1.18, pow(z, 1.6));
    x *= radialScale;
    y *= radialScale;

    float orbit = aPhase * 6.28318 + uTime * (0.08 + 0.35 * uDive) * aDirection;
    float ox = cos(orbit) * abs(aOffset.x) * radialScale;
    float oy = sin(orbit) * abs(aOffset.y) * radialScale;
    x = mix(x, ox, uDive * 0.86);
    y = mix(y, oy, uDive * 0.86);

    float speciesFocus = 1.0 - step(0.4, abs(aSpecies - uSelectedSpecies));
    float motionFocus = 1.0 - step(0.4, abs(aMotion - uSwimFocus));
    vFocus = max(speciesFocus, motionFocus * 0.72);

    float perspective = mix(0.12, 1.58, pow(z, 1.58));
    float bodyScale = aScale * perspective * (0.7 + vFocus * 0.74);
    bodyScale *= 1.0 + uKick * (0.09 + school * 0.08);

    vec2 local = position.xy;
    float swimWave = sin((uv.x * 7.0 - uTime * (3.0 + uSpeed * 4.0) * aVelocity) + aPhase * 12.0);
    local.y += swimWave * (1.0 - uv.x) * (0.012 + wave * 0.045 + school * 0.018);
    local.x *= aDirection;

    float width = 0.14 * bodyScale;
    vec2 clipSize = vec2(width, width * uAspect / 0.89);
    vec2 clipPos = vec2(x, y) + local * clipSize;

    clipPos += normalize(vec2(x, y) + vec2(0.0001)) * uBass * uDive * 0.018;
    gl_Position = vec4(clipPos, z * 0.8, 1.0);
  }
`;

const fishFragment = `
  precision highp float;
  varying vec2 vUv;
  varying float vSpecies;
  varying float vDepth;
  varying float vFocus;
  uniform sampler2D uAtlas;
  uniform float uTime;
  uniform float uHigh;
  uniform float uDrive;
  uniform float uColorPreset;
  uniform float uMode;

  vec3 hueShift(vec3 color, float angle) {
    const vec3 k = vec3(0.577350269);
    float c = cos(angle);
    return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
  }

  void main() {
    float species = floor(vSpecies + 0.5);
    float column = mod(species, 4.0);
    float row = floor(species / 4.0);
    vec2 atlasUv = vec2((vUv.x + column) / 4.0, (vUv.y + (1.0 - row)) / 2.0);
    vec4 texel = texture2D(uAtlas, atlasUv);
    if (texel.a < 0.035) discard;

    vec3 color = texel.rgb;
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float contrast = 1.0 + uDrive * (uColorPreset > 0.5 && uColorPreset < 1.5 ? 0.72 : 0.34);
    color = (color - 0.5) * contrast + 0.5;
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.0 + uDrive * 0.48);

    if (uColorPreset > 1.5 && uColorPreset < 2.5) {
      color = hueShift(color, sin(uTime * 0.6 + vSpecies) * 0.52 + uDrive * 0.25);
    }
    if (uColorPreset > 2.5) {
      color *= vec3(0.58, 0.82, 1.18);
      color = mix(color, color * color * 1.35, 0.35);
    }
    if (uMode > 1.5) {
      color = hueShift(color, sin(uTime * 0.16 + vSpecies) * 0.22);
    }

    color += color * uHigh * (0.12 + max(lum - 0.5, 0.0) * 0.55);
    float focusAlpha = mix(0.28, 0.84, vFocus);
    float depthFade = smoothstep(0.12, 0.32, vDepth);
    float edgeGlow = smoothstep(0.05, 0.45, texel.a) * (0.35 + uDrive * 0.2);
    float alpha = texel.a * focusAlpha * depthFade;
    color *= 0.58 + edgeGlow * 0.62 + vFocus * 0.16;

    gl_FragColor = vec4(max(color, 0.0), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function modeValue(mode: ModeName) {
  return mode === "MYSTIC" ? 0 : mode === "SENSUAL" ? 1 : 2;
}

function colorValue(color: ColorPreset) {
  return color === "CLEAN" ? 0 : color === "PUNCH" ? 1 : color === "ACID" ? 2 : 3;
}

function swimValue(swim: SwimType) {
  return swim === "SCHOOL" ? 0 : swim === "GLIDE" ? 1 : swim === "WAVE" ? 2 : 3;
}

export function FishCanvas({ config, audio, onFps }: FishCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  const audioRef = useRef(audio);
  const onFpsRef = useRef(onFps);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  useEffect(() => {
    onFpsRef.current = onFps;
  }, [onFps]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.setClearColor(0x01020a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "fish-canvas";
    renderer.domElement.setAttribute("aria-label", "Live FishVJ visual output");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const sharedUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 16 / 9 },
      uKick: { value: 0 },
      uBass: { value: 0 },
      uHigh: { value: 0 },
      uDive: { value: 0 },
      uMode: { value: 0 },
      uDrive: { value: 0.65 },
      uColorPreset: { value: 1 },
    };

    const backgroundGeometry = new THREE.PlaneGeometry(2, 2);
    const backgroundMaterial = new THREE.ShaderMaterial({
      vertexShader: backgroundVertex,
      fragmentShader: backgroundFragment,
      uniforms: sharedUniforms,
      depthTest: false,
      depthWrite: false,
    });
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    backgroundMesh.renderOrder = -10;
    scene.add(backgroundMesh);

    const baseGeometry = new THREE.PlaneGeometry(1, 1, 12, 2);
    const fishGeometry = new THREE.InstancedBufferGeometry();
    fishGeometry.index = baseGeometry.index;
    fishGeometry.setAttribute("position", baseGeometry.getAttribute("position"));
    fishGeometry.setAttribute("uv", baseGeometry.getAttribute("uv"));

    const offsets = new Float32Array(MAX_FISH * 3);
    const scales = new Float32Array(MAX_FISH);
    const phases = new Float32Array(MAX_FISH);
    const species = new Float32Array(MAX_FISH);
    const motions = new Float32Array(MAX_FISH);
    const velocities = new Float32Array(MAX_FISH);
    const directions = new Float32Array(MAX_FISH);
    const speciesScales = [0.7, 1.14, 0.94, 1.2, 0.86, 1.24, 0.94, 0.82];
    const speciesMotions = [0, 1, 3, 1, 3, 2, 3, 0];

    for (let i = 0; i < MAX_FISH; i += 1) {
      const speciesIndex = i % 8;
      const spiralBand = i % 23;
      const angle = (spiralBand / 23) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 0.18 + Math.pow(Math.random(), 0.68) * 1.28;
      offsets[i * 3] = Math.cos(angle) * radius;
      offsets[i * 3 + 1] = Math.sin(angle) * radius * 0.74;
      offsets[i * 3 + 2] = (i / MAX_FISH + Math.random() * 0.09) % 1;
      scales[i] = speciesScales[speciesIndex] * (0.5 + Math.random() * 0.78);
      phases[i] = Math.random();
      species[i] = speciesIndex;
      motions[i] = speciesMotions[speciesIndex];
      velocities[i] = 0.62 + Math.random() * 0.86;
      directions[i] = Math.random() > 0.18 ? 1 : -1;
    }

    fishGeometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    fishGeometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scales, 1));
    fishGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    fishGeometry.setAttribute("aSpecies", new THREE.InstancedBufferAttribute(species, 1));
    fishGeometry.setAttribute("aMotion", new THREE.InstancedBufferAttribute(motions, 1));
    fishGeometry.setAttribute("aVelocity", new THREE.InstancedBufferAttribute(velocities, 1));
    fishGeometry.setAttribute("aDirection", new THREE.InstancedBufferAttribute(directions, 1));
    fishGeometry.instanceCount = configRef.current.fishCount;

    const texture = new THREE.TextureLoader().load("/seeds/fish-atlas-v1.png");
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const fishUniforms = {
      ...sharedUniforms,
      uAtlas: { value: texture },
      uSpeed: { value: 0.7 },
      uDepth: { value: 0.72 },
      uSelectedSpecies: { value: 0 },
      uSwimFocus: { value: 0 },
    };

    const fishMaterial = new THREE.ShaderMaterial({
      vertexShader: fishVertex,
      fragmentShader: fishFragment,
      uniforms: fishUniforms,
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fishMesh = new THREE.Mesh(fishGeometry, fishMaterial);
    fishMesh.frustumCulled = false;
    fishMesh.renderOrder = 1;
    scene.add(fishMesh);

    let width = 1;
    let height = 1;
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(bounds.width));
      height = Math.max(1, Math.floor(bounds.height));
      renderer.setSize(width, height, false);
      sharedUniforms.uAspect.value = width / height;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const startTime = performance.now();
    let lastFrame = performance.now();
    let fpsAccumulator = 0;
    let fpsFrames = 0;
    let displayFps = 60;
    let currentDive = configRef.current.dive ? 1 : 0;
    let smoothKick = 0;
    let smoothBass = 0;
    let smoothHigh = 0;

    const render = () => {
      const now = performance.now();
      const deltaMs = Math.max(0.1, now - lastFrame);
      lastFrame = now;
      fpsAccumulator += deltaMs;
      fpsFrames += 1;
      if (fpsAccumulator >= 650) {
        displayFps = Math.round((fpsFrames * 1000) / fpsAccumulator);
        onFpsRef.current(displayFps);
        fpsAccumulator = 0;
        fpsFrames = 0;
      }

      const cfg = configRef.current;
      const levels = audioRef.current;
      const elapsed = (now - startTime) / 1000;
      currentDive += ((cfg.dive ? 1 : 0) - currentDive) * Math.min(1, deltaMs / 620);
      smoothKick += (levels.kick - smoothKick) * 0.2;
      smoothBass += (levels.bass - smoothBass) * 0.14;
      smoothHigh += (levels.high - smoothHigh) * 0.18;

      sharedUniforms.uTime.value = elapsed;
      sharedUniforms.uKick.value = smoothKick;
      sharedUniforms.uBass.value = smoothBass;
      sharedUniforms.uHigh.value = smoothHigh;
      sharedUniforms.uDive.value = currentDive;
      sharedUniforms.uMode.value = modeValue(cfg.mode);
      sharedUniforms.uDrive.value = cfg.colorDrive;
      sharedUniforms.uColorPreset.value = colorValue(cfg.colorPreset);
      fishUniforms.uSpeed.value = cfg.speed;
      fishUniforms.uDepth.value = cfg.depth;
      fishUniforms.uSelectedSpecies.value = cfg.selectedSpecies;
      fishUniforms.uSwimFocus.value = swimValue(cfg.swimType);
      fishGeometry.instanceCount = Math.min(MAX_FISH, Math.max(1, cfg.fishCount));
      renderer.toneMappingExposure =
        cfg.colorPreset === "DEEP" ? 0.82 : cfg.colorPreset === "PUNCH" ? 1.2 : 1.04;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    let animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      scene.remove(backgroundMesh, fishMesh);
      backgroundGeometry.dispose();
      backgroundMaterial.dispose();
      baseGeometry.dispose();
      fishGeometry.dispose();
      fishMaterial.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="fish-canvas-host" ref={hostRef} />;
}
