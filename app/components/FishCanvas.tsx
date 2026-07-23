"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  AUDIO_TICK_INTERVAL,
  createSeededRandom,
  deck,
  engine,
  FixedStepClock,
  installCaptureBridge,
  isCaptureEnabled,
  type AudioLevels,
  type RenderSnapshot,
} from "../engine";

export type { AudioLevels } from "../engine";

type FishCanvasProps = {
  audio: AudioLevels;
  onFps: (fps: number) => void;
};

const MAX_SOURCE_FISH = 2000;
const RING_COUNT = 6;

// Quantize an analyser band to the 8-bit resolution the replay format stores,
// so a live session and its replay feed the reducer identical values.
const quantizeBand = (value: number) =>
  Math.round(Math.min(1, Math.max(0, value)) * 255) / 255;

const fullscreenVertex = `
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
  uniform float uSceneMix;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec3 rainbow(float t) {
    return 0.58 + 0.52 * cos(6.28318 * (t + vec3(0.0, 0.68, 0.35)));
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    float r = length(p);
    float a = atan(p.y, p.x);
    float travel = uTime * (0.055 + uDive * 0.46 + uBass * 0.06);

    vec3 col = vec3(0.0);
    float core = exp(-r * (14.0 + uKick * 4.0));
    float spiral = pow(max(0.0, sin(a * 3.0 + log(r + 0.025) * 10.0 - travel * 3.0)), 28.0);
    spiral *= smoothstep(1.5, 0.12, r);
    float ray = pow(max(0.0, cos(a * 4.0 - log(r + 0.035) * 4.0 + travel)), 34.0);
    ray *= smoothstep(1.55, 0.16, r);

    vec2 starUv = floor((p * (30.0 + 42.0 * r)) + travel * vec2(9.0, 4.0));
    float starSeed = hash21(starUv);
    float stars = step(0.987, starSeed) * smoothstep(1.5, 0.08, r);

    col += rainbow(a / 6.28318 + uTime * 0.02) * spiral * (0.01 + 0.045 * uDive);
    col += rainbow(r * 0.24 + uTime * 0.015) * ray * (0.004 + 0.012 * uDrive);
    col += rainbow(starSeed) * stars * (0.06 + uHigh * 0.45);
    col += mix(vec3(0.0, 0.42, 1.0), vec3(1.0, 0.0, 0.58), 0.5 + 0.5 * sin(uTime * 0.55))
      * core * (0.22 + uKick * 0.75);

    float blackGate = smoothstep(0.01, 0.055, max(max(col.r, col.g), col.b));
    col *= blackGate;
    col *= smoothstep(1.68, 0.04, r);

    float waterDepth = smoothstep(1.0, -1.0, p.y);
    vec3 ocean = mix(vec3(0.0, 0.005, 0.018), vec3(0.0, 0.028, 0.07), waterDepth);
    float currentA = sin(p.x * 3.4 + p.y * 5.8 + uTime * 0.19);
    float currentB = sin(p.x * 7.2 - p.y * 3.1 - uTime * 0.13);
    float caustic = pow(max(0.0, currentA * currentB), 18.0);
    ocean += vec3(0.0, 0.18, 0.28) * caustic * (0.025 + uHigh * 0.05);
    ocean += rainbow(starSeed + uTime * 0.01) * stars * (0.035 + uHigh * 0.18);
    ocean += vec3(0.0, 0.05, 0.11) * uBass * 0.08;

    col = mix(col, ocean, smoothstep(0.0, 1.0, uSceneMix));
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

const fishVertex = `
  precision highp float;
  attribute vec3 aOffset;
  attribute float aRing;
  attribute float aScale;
  attribute float aPhase;
  attribute float aSpecies;
  attribute float aMotion;
  attribute float aVelocity;
  attribute float aPopulation;
  varying vec2 vUv;
  varying float vSpecies;
  varying float vDepth;
  varying float vFocus;
  varying float vLife;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSegments;
  uniform float uKick;
  uniform float uBass;
  uniform float uSpeed;
  uniform float uFishSize;
  uniform float uDepth;
  uniform float uDive;
  uniform float uMode;
  uniform float uSelectedSpecies;
  uniform float uSwimFocus;
  uniform float uSwarmFrom;
  uniform float uSwarmTo;
  uniform float uSwarmMix;
  uniform float uSceneMix;
  uniform float uMandalaPopulation;

  float foldSeed(float value) {
    return abs(fract(value * 0.5) * 2.0 - 1.0);
  }

  vec2 swarmPosition(
    float swarm,
    float ringNorm,
    float angleSeed,
    float radiusJitter,
    float seed,
    float phase,
    float wedge,
    float time,
    float speed,
    float normalRadius,
    float diveRadius,
    float dive
  ) {
    float radius = normalRadius;
    float angle = wedge * mix(0.055, 0.455, angleSeed);

    if (swarm < 0.5) {
      radius = mix(normalRadius, diveRadius, dive);
      float spiralSeed = foldSeed(angleSeed + ringNorm * 0.72 + time * speed * 0.035);
      angle = wedge * mix(0.045, 0.46, spiralSeed);
    } else if (swarm < 1.5) {
      float layerRadius = mix(0.1, 1.06, pow(ringNorm, 0.92));
      float sphere = 0.91 + 0.085 * sin(phase + time * speed * 0.7 + ringNorm * 4.0);
      radius = mix(layerRadius * sphere + radiusJitter * 0.35, diveRadius, dive * 0.82);
      float vortexWave = sin(phase * 8.0 + time * speed * 0.82 + ringNorm * 8.0);
      angle = wedge * clamp(0.25 + vortexWave * 0.205, 0.035, 0.465);
    } else if (swarm < 2.5) {
      float band = fract(seed + ringNorm * 0.19);
      radius = mix(0.08, 1.5, band);
      radius += radiusJitter * 0.7;
      float waveFlow = sin(radius * 8.0 - time * speed * 1.35 + phase * 5.0);
      angle = wedge * clamp(0.25 + waveFlow * 0.2, 0.035, 0.465);
      radius = mix(radius, diveRadius, dive * 0.48);
    } else {
      float burst = fract(seed + time * speed * 0.115);
      radius = mix(0.025, 1.56, pow(burst, 0.78));
      float bloomSeed = foldSeed(angleSeed + phase * 0.08);
      angle = wedge * mix(0.035, 0.47, bloomSeed);
      radius = mix(radius, diveRadius, dive * 0.34);
    }

    return vec2(cos(angle), sin(angle)) * radius;
  }

  float freeSwimDirection(float seed, float angleSeed) {
    return fract(seed * 17.31 + angleSeed * 3.7) > 0.5 ? 1.0 : -1.0;
  }

  float freeSwimProgress(float time, float speed, float seed, float angleSeed) {
    return fract(seed + angleSeed * 0.11 + time * (0.016 + speed * 0.072));
  }

  vec2 freeSwimPosition(
    float style,
    float motion,
    float ringNorm,
    float angleSeed,
    float seed,
    float phase,
    float time,
    float speed,
    float aspect
  ) {
    float direction = freeSwimDirection(seed, angleSeed);
    float progress = freeSwimProgress(time, speed, seed, angleSeed);
    float directedProgress = direction > 0.0 ? progress : 1.0 - progress;
    float x = mix(-aspect - 0.28, aspect + 0.28, directedProgress);
    float lane = fract(ringNorm * 0.73 + angleSeed * 0.47 + seed * 0.61);
    float y = mix(-0.82, 0.82, lane);
    float school = 1.0 - step(0.5, abs(motion - 0.0));
    float glide = 1.0 - step(0.5, abs(motion - 1.0));
    float wave = 1.0 - step(0.5, abs(motion - 2.0));
    float floating = 1.0 - step(0.5, abs(motion - 3.0));
    float swayRate = school * 1.18 + glide * 0.56 + wave * 0.84 + floating * 0.4;
    float swayAmount = school * 0.026 + glide * 0.01 + wave * 0.064 + floating * 0.082;
    float bodyDrift = sin(
      time * (0.62 + speed * 0.52) * swayRate + phase + x * 1.15
    ) * swayAmount;
    bodyDrift += floating * sin(time * 0.26 + phase * 1.3) * 0.04;

    if (style < 0.5) {
      // CRUISE: relaxed, layered lanes with small unsynchronised deviations.
      y += bodyDrift;
      y += sin(time * 0.31 + seed * 15.0 + ringNorm * 2.0) * 0.022;
    } else if (style < 1.5) {
      // CURRENT: the whole school bends through two broad ocean currents.
      float currentBand = lane < 0.5 ? -0.34 : 0.34;
      y = currentBand
        + (lane - step(0.5, lane)) * 0.46
        + sin(x * 1.05 - time * 0.42 + currentBand * 3.0) * 0.22
        + bodyDrift * 0.8;
    } else if (style < 2.5) {
      // CROSS: opposing schools cross on gentle diagonals.
      float diagonal = (directedProgress - 0.5) * direction;
      y = mix(-0.7, 0.7, lane) + diagonal * (lane < 0.5 ? 0.48 : -0.48);
      y += sin(time * 0.48 + phase + x * 0.72) * 0.055;
    } else {
      // DRIFT: loose depth layers meander with a slower, wider motion.
      x += sin(time * 0.24 + phase + lane * 5.0) * 0.12;
      y = mix(-0.68, 0.68, lane);
      y += sin(time * 0.34 + phase * 1.7 + x * 0.58) * 0.15;
      y += sin(time * 0.17 + seed * 12.0) * 0.055;
    }
    return vec2(x, y);
  }

  void main() {
    vUv = uv;
    vSpecies = aSpecies;

    float ringNorm = aRing / 5.0;
    float modeSpeed = uMode < 0.5 ? 0.62 : (uMode < 1.5 ? 0.88 : 1.24);
    float ringPace = 0.86 + aRing * 0.055;
    float alignedVelocity = mix(aVelocity, ringPace, 0.16);
    float travelPace = aMotion < 0.5
      ? 1.16
      : (aMotion < 1.5 ? 1.02 : (aMotion < 2.5 ? 0.76 : 0.58));
    float motionSpeed = uSpeed * modeSpeed * alignedVelocity * travelPace;
    motionSpeed *= mix(1.0, 2.1, uSceneMix * uDive);
    float kickLead = uKick * (0.035 + alignedVelocity * 0.028);
    float motionTime = uTime + kickLead;
    float headingWindow = 0.11;
    float previousTime = motionTime - headingWindow;

    float diveTravel = motionTime * (0.035 + uSpeed * 0.045) * modeSpeed * alignedVelocity;
    float divePhase = fract(ringNorm + aOffset.z * 0.045 - diveTravel);
    float previousDiveTravel = previousTime
      * (0.035 + uSpeed * 0.045)
      * modeSpeed
      * alignedVelocity;
    float previousDivePhase = fract(ringNorm + aOffset.z * 0.045 - previousDiveTravel);

    float normalRadius = mix(0.12, 1.22, pow(ringNorm, 0.88)) + aOffset.y;
    float diveRadius = mix(0.045, 1.5, pow(divePhase, mix(0.72, 1.05, uDepth)));
    float previousDiveRadius = mix(
      0.045,
      1.5,
      pow(previousDivePhase, mix(0.72, 1.05, uDepth))
    );
    float wedge = 6.28318530718 / uSegments;
    float school = 1.0 - step(0.5, abs(aMotion - 0.0));
    float glide = 1.0 - step(0.5, abs(aMotion - 1.0));
    float wave = 1.0 - step(0.5, abs(aMotion - 2.0));
    float floating = 1.0 - step(0.5, abs(aMotion - 3.0));

    float sceneEase = smoothstep(0.0, 1.0, uSceneMix);
    float swarmEase = smoothstep(0.0, 1.0, uSwarmMix);
    vec2 mandalaCenter = vec2(0.0);
    vec2 mandalaPrevious = vec2(0.0);
    float mandalaDepth = 0.35;
    float mandalaLife = 1.0;

    if (sceneEase < 0.999) {
      vec2 fromPolar = swarmPosition(
        uSwarmFrom,
        ringNorm,
        aOffset.x,
        aOffset.y,
        aOffset.z,
        aPhase,
        wedge,
        motionTime,
        motionSpeed,
        normalRadius,
        diveRadius,
        uDive
      );
      vec2 toPolar = swarmPosition(
        uSwarmTo,
        ringNorm,
        aOffset.x,
        aOffset.y,
        aOffset.z,
        aPhase,
        wedge,
        motionTime,
        motionSpeed,
        normalRadius,
        diveRadius,
        uDive
      );
      vec2 fromPrevious = swarmPosition(
        uSwarmFrom,
        ringNorm,
        aOffset.x,
        aOffset.y,
        aOffset.z,
        aPhase,
        wedge,
        previousTime,
        motionSpeed,
        normalRadius,
        previousDiveRadius,
        uDive
      );
      vec2 toPrevious = swarmPosition(
        uSwarmTo,
        ringNorm,
        aOffset.x,
        aOffset.y,
        aOffset.z,
        aPhase,
        wedge,
        previousTime,
        motionSpeed,
        normalRadius,
        previousDiveRadius,
        uDive
      );
      mandalaCenter = mix(fromPolar, toPolar, swarmEase);
      mandalaPrevious = mix(fromPrevious, toPrevious, swarmEase);

      float radialWobble = sin(
        motionTime * (1.1 + alignedVelocity * 0.72)
        + aPhase
        + aRing * 0.63
      ) * 0.026;
      float previousWobble = sin(
        previousTime * (1.1 + alignedVelocity * 0.72)
        + aPhase
        + aRing * 0.63
      ) * 0.026;
      mandalaCenter += normalize(mandalaCenter + vec2(0.00001)) * radialWobble;
      mandalaPrevious += normalize(mandalaPrevious + vec2(0.00001)) * previousWobble;

      float mandalaRadius = length(mandalaCenter);
      mandalaRadius *= 1.0 + uBass * (0.012 + ringNorm * 0.018);
      mandalaCenter = normalize(mandalaCenter + vec2(0.00001)) * mandalaRadius;
      mandalaDepth = clamp(mandalaRadius / 1.5, 0.0, 1.0);
      float bloomFrom = step(2.5, uSwarmFrom);
      float bloomTo = step(2.5, uSwarmTo);
      float bloomAmount = mix(bloomFrom, bloomTo, uSwarmMix);
      mandalaLife = mix(
        1.0,
        1.0 - smoothstep(0.82, 1.0, mandalaDepth),
        bloomAmount
      );
      float vortexFrom = 1.0 - step(0.5, abs(uSwarmFrom - 1.0));
      float vortexTo = 1.0 - step(0.5, abs(uSwarmTo - 1.0));
      float vortexAmount = mix(vortexFrom, vortexTo, uSwarmMix);
      float vortexEdgeFade = 1.0 - smoothstep(0.96, 1.12, mandalaRadius);
      mandalaLife *= mix(1.0, vortexEdgeFade, vortexAmount);
    }

    vec2 freeFrom = freeSwimPosition(
      uSwarmFrom,
      aMotion,
      ringNorm,
      aOffset.x,
      aOffset.z,
      aPhase,
      motionTime,
      motionSpeed,
      uAspect
    );
    vec2 freeTo = freeSwimPosition(
      uSwarmTo,
      aMotion,
      ringNorm,
      aOffset.x,
      aOffset.z,
      aPhase,
      motionTime,
      motionSpeed,
      uAspect
    );
    vec2 freeFromPrevious = freeSwimPosition(
      uSwarmFrom,
      aMotion,
      ringNorm,
      aOffset.x,
      aOffset.z,
      aPhase,
      previousTime,
      motionSpeed,
      uAspect
    );
    vec2 freeToPrevious = freeSwimPosition(
      uSwarmTo,
      aMotion,
      ringNorm,
      aOffset.x,
      aOffset.z,
      aPhase,
      previousTime,
      motionSpeed,
      uAspect
    );
    vec2 freeCenter = mix(freeFrom, freeTo, swarmEase);
    vec2 freePrevious = mix(freeFromPrevious, freeToPrevious, swarmEase);
    float freeDirection = freeSwimDirection(aOffset.z, aOffset.x);
    if (abs(freeCenter.x - freePrevious.x) > uAspect) {
      freePrevious = freeCenter - vec2(freeDirection * 0.02, 0.0);
    }

    vec2 centerPolar = mix(mandalaCenter, freeCenter, sceneEase);
    vec2 previousPolar = mix(mandalaPrevious, freePrevious, sceneEase);
    vec2 velocity = centerPolar - previousPolar;
    if (sceneEase > 0.5 && abs(velocity.x) > uAspect * 0.5) {
      velocity = vec2(freeDirection * 0.02, 0.0);
    }
    vec2 velocityDirection = normalize(velocity + vec2(0.00001, 0.0));
    centerPolar += velocityDirection * uKick * (0.018 + ringNorm * 0.016);

    float freeDepth = mix(
      0.22,
      0.9,
      fract(aOffset.z * 5.71 + aOffset.x * 2.39 + aRing * 0.17)
    );
    vDepth = mix(mandalaDepth, freeDepth, sceneEase);
    float freeProgress = freeSwimProgress(
      motionTime,
      motionSpeed,
      aOffset.z,
      aOffset.x
    );
    float freeLife = smoothstep(0.0, 0.055, freeProgress)
      * (1.0 - smoothstep(0.945, 1.0, freeProgress));
    float populationVisible = 1.0 - smoothstep(
      uMandalaPopulation - 0.004,
      uMandalaPopulation + 0.004,
      aPopulation
    );
    vLife = mix(mandalaLife, freeLife, sceneEase)
      * mix(populationVisible, 1.0, sceneEase);
    vec2 centerClip = vec2(centerPolar.x / uAspect, centerPolar.y);

    float speciesFocus = 1.0 - step(0.4, abs(aSpecies - uSelectedSpecies));
    float motionFocus = 1.0 - step(0.4, abs(aMotion - uSwimFocus));
    vFocus = max(speciesFocus, motionFocus * 0.72);

    float mandalaPerspective = mix(0.22, 1.78, pow(mandalaDepth, 1.22));
    float freePerspective = mix(0.52, 1.08, freeDepth);
    float perspective = mix(mandalaPerspective, freePerspective, sceneEase);
    float bodyScale = aScale * perspective * (0.72 + vFocus * 0.52);
    bodyScale *= 1.0 + uKick * (0.04 + school * 0.07);

    vec2 local = position.xy;
    float tailWeight = pow(clamp(1.0 - uv.x, 0.0, 1.0), 1.65);
    float tailAmplitude =
      0.014
      + school * 0.033
      + glide * 0.004
      + wave * 0.09
      + floating * 0.02;
    float tailRate =
      school * 1.25
      + glide * 0.55
      + wave * 0.86
      + floating * 0.42;
    float swimWave = sin(
      motionTime * (5.2 + uSpeed * 4.8) * alignedVelocity * tailRate
      + aPhase
      - uv.x * (7.0 + wave * 3.5)
    );
    local.y += swimWave * tailWeight * tailAmplitude;
    local.x *= 1.0 + uKick * (0.08 + school * 0.12);

    float orientation = atan(velocityDirection.y, velocityDirection.x);

    float fishWidth = 0.192 * uFishSize * bodyScale * mix(1.0, 0.58, sceneEase);
    vec2 localPolar = vec2(local.x * fishWidth, local.y * fishWidth / 0.89);
    mat2 rotateFish = mat2(
      cos(orientation), -sin(orientation),
      sin(orientation), cos(orientation)
    );
    localPolar = rotateFish * localPolar;

    vec2 clipPos = centerClip + vec2(localPolar.x / uAspect, localPolar.y);
    gl_Position = vec4(clipPos, vDepth * 0.75, 1.0);
  }
`;

const fishFragment = `
  precision highp float;
  varying vec2 vUv;
  varying float vSpecies;
  varying float vDepth;
  varying float vFocus;
  varying float vLife;
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
    vec2 atlasUv = vec2(
      (vUv.x + column) / 4.0,
      (vUv.y + (1.0 - row)) / 2.0
    );
    vec4 texel = texture2D(uAtlas, atlasUv);
    if (texel.a < 0.035) discard;

    vec3 color = texel.rgb;
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(color - 0.025, 0.0);
    color = mix(vec3(lum), color, 1.04 + uDrive * 0.38);

    if (uColorPreset > 1.5 && uColorPreset < 2.5) {
      color = hueShift(color, sin(uTime * 0.5 + vSpecies) * 0.38);
    }
    if (uColorPreset > 2.5) {
      color *= vec3(0.62, 0.78, 1.02);
    }
    if (uMode > 1.5) {
      color = hueShift(color, sin(uTime * 0.13 + vSpecies) * 0.16);
    }

    color += color * uHigh * smoothstep(0.58, 0.95, lum) * 0.42;
    float focusAlpha = mix(0.52, 0.94, vFocus);
    float depthFade = smoothstep(0.03, 0.2, vDepth);
    float alpha = texel.a * focusAlpha * depthFade * vLife;
    color *= 0.82 + vFocus * 0.22;

    gl_FragColor = vec4(max(color, 0.0), alpha);
  }
`;

const KaleidoShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
    uSegments: { value: 6 },
    uDive: { value: 0 },
    uDrive: { value: 0.72 },
    uColorPreset: { value: 1 },
    uMode: { value: 0 },
    uKick: { value: 0 },
    uSceneMix: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: fullscreenVertex,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    uniform float uSegments;
    uniform float uDive;
    uniform float uDrive;
    uniform float uColorPreset;
    uniform float uMode;
    uniform float uKick;
    uniform float uSceneMix;
    uniform vec2 uResolution;

    vec3 hueShift(vec3 color, float angle) {
      const vec3 k = vec3(0.577350269);
      float c = cos(angle);
      return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
    }

    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      p.x *= uAspect;
      float radius = length(p);
      float angle = atan(p.y, p.x);

      float layer = clamp(floor(radius / 0.245), 0.0, 5.0);
      float layerNorm = layer / 5.0;
      float direction = mod(layer, 2.0) < 1.0 ? 1.0 : -1.0;
      float differential = mix(0.26, 0.045, layerNorm);
      float mandalaAmount = 1.0 - smoothstep(0.0, 1.0, uSceneMix);
      angle += direction * uTime * differential * (0.28 + uMode * 0.16) * mandalaAmount;
      angle += direction * uDive * (1.0 - layerNorm)
        * (0.42 + 0.18 * sin(uTime * 0.7))
        * mandalaAmount;

      float wedge = 6.28318530718 / uSegments;
      angle = mod(angle + wedge * 0.5, wedge) - wedge * 0.5;
      angle = abs(angle);

      vec2 sourcePolar = radius * vec2(cos(angle), sin(angle));
      vec2 kaleidoUv = vec2(sourcePolar.x / uAspect, sourcePolar.y) * 0.5 + 0.5;
      vec2 sourceUv = mix(kaleidoUv, vUv, smoothstep(0.0, 1.0, uSceneMix));
      vec3 color = texture2D(tDiffuse, sourceUv).rgb;

      vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
      vec3 glow = vec3(0.0);
      vec2 bloomStep = pixel * (2.5 + uDrive * 2.0);
      vec3 sampleA = texture2D(tDiffuse, sourceUv + vec2(bloomStep.x, 0.0)).rgb;
      vec3 sampleB = texture2D(tDiffuse, sourceUv - vec2(bloomStep.x, 0.0)).rgb;
      vec3 sampleC = texture2D(tDiffuse, sourceUv + vec2(0.0, bloomStep.y)).rgb;
      vec3 sampleD = texture2D(tDiffuse, sourceUv - vec2(0.0, bloomStep.y)).rgb;
      vec3 sampleE = texture2D(tDiffuse, sourceUv + bloomStep).rgb;
      vec3 sampleF = texture2D(tDiffuse, sourceUv - bloomStep).rgb;
      vec3 sampleG = texture2D(tDiffuse, sourceUv + vec2(bloomStep.x, -bloomStep.y)).rgb;
      vec3 sampleH = texture2D(tDiffuse, sourceUv + vec2(-bloomStep.x, bloomStep.y)).rgb;
      float threshold = 0.68;
      glow += sampleA * smoothstep(threshold, 0.96, dot(sampleA, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleB * smoothstep(threshold, 0.96, dot(sampleB, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleC * smoothstep(threshold, 0.96, dot(sampleC, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleD * smoothstep(threshold, 0.96, dot(sampleD, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleE * smoothstep(threshold, 0.96, dot(sampleE, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleF * smoothstep(threshold, 0.96, dot(sampleF, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleG * smoothstep(threshold, 0.96, dot(sampleG, vec3(0.2126, 0.7152, 0.0722)));
      glow += sampleH * smoothstep(threshold, 0.96, dot(sampleH, vec3(0.2126, 0.7152, 0.0722)));
      color += glow * (0.085 + uDrive * 0.055);

      float ringHue = layer * (0.24 + uDrive * 0.22) * mandalaAmount;
      float waterHue = (vUv.y - 0.5) * 0.34 * uSceneMix;
      color = hueShift(color, ringHue + waterHue + uMode * 0.15);

      float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float contrast = 1.08 + uDrive * (uColorPreset > 0.5 && uColorPreset < 1.5 ? 0.82 : 0.48);
      color = max((color - vec3(0.025)) * contrast, 0.0);
      float gradedLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(gradedLum), color, 1.02 + uDrive * 0.58);

      if (uColorPreset > 1.5 && uColorPreset < 2.5) {
        color = hueShift(color, sin(layer * 1.7 + uTime * 0.32) * 0.46);
      }
      if (uColorPreset > 2.5) {
        color *= vec3(0.48, 0.68, 0.96);
      }

      color *= 1.0 + uKick * smoothstep(0.35, 0.9, lum) * 0.46;
      float blackGate = smoothstep(0.008, 0.065, max(max(color.r, color.g), color.b));
      color *= blackGate;
      float mandalaVignette = smoothstep(1.72, 0.02, radius);
      float waterVignette = smoothstep(2.12, 1.62, radius);
      color *= mix(mandalaVignette, waterVignette, uSceneMix);

      gl_FragColor = vec4(max(color, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function FishCanvas({ audio, onFps }: FishCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(audio);
  const onFpsRef = useRef(onFps);

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
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "fish-canvas";
    renderer.domElement.setAttribute("aria-label", "Live FishVJ visual output");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const initialSnapshot = engine.getRenderSnapshot();
    const sharedUniforms = {
      uTime: { value: 0 },
      uAspect: { value: initialSnapshot.uAspect },
      uSegments: { value: initialSnapshot.uSegments },
      uKick: { value: 0 },
      uBass: { value: 0 },
      uHigh: { value: 0 },
      uDive: { value: initialSnapshot.uDive },
      uMode: { value: initialSnapshot.uMode },
      uDrive: { value: initialSnapshot.uDrive },
      uColorPreset: { value: initialSnapshot.uColorPreset },
      uSceneMix: { value: initialSnapshot.uSceneMix },
    };

    const backgroundGeometry = new THREE.PlaneGeometry(2, 2);
    const backgroundMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
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

    const offsets = new Float32Array(MAX_SOURCE_FISH * 3);
    const rings = new Float32Array(MAX_SOURCE_FISH);
    const scales = new Float32Array(MAX_SOURCE_FISH);
    const phases = new Float32Array(MAX_SOURCE_FISH);
    const species = new Float32Array(MAX_SOURCE_FISH);
    const motions = new Float32Array(MAX_SOURCE_FISH);
    const velocities = new Float32Array(MAX_SOURCE_FISH);
    const populations = new Float32Array(MAX_SOURCE_FISH);
    // deck v0: scale/motion are read from the deck (app/engine/deck.ts); every
    // other per-species value stays internal (FISHVJ_DESIGN_V2.md §7.1).
    const speciesScales = deck.speciesScales;
    const speciesMotions = deck.speciesMotions;

    const random = createSeededRandom(engine.getState().seed);
    for (let index = 0; index < MAX_SOURCE_FISH; index += 1) {
      const speciesIndex = index % 8;
      const ringIndex = index % RING_COUNT;
      const motif = Math.floor(index / RING_COUNT) % 5;
      offsets[index * 3] = (motif + 0.5) / 5;
      offsets[index * 3 + 1] = (random() - 0.5) * (0.012 + ringIndex * 0.012);
      offsets[index * 3 + 2] = random();
      rings[index] = ringIndex;
      scales[index] =
        speciesScales[speciesIndex] * (0.72 + random() * 0.5);
      phases[index] = random() * Math.PI * 2;
      species[index] = speciesIndex;
      motions[index] = speciesMotions[speciesIndex];
      velocities[index] = 0.7 + random() * 0.6;
      populations[index] = index / (MAX_SOURCE_FISH - 1);
    }

    fishGeometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    fishGeometry.setAttribute("aRing", new THREE.InstancedBufferAttribute(rings, 1));
    fishGeometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scales, 1));
    fishGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    fishGeometry.setAttribute("aSpecies", new THREE.InstancedBufferAttribute(species, 1));
    fishGeometry.setAttribute("aMotion", new THREE.InstancedBufferAttribute(motions, 1));
    fishGeometry.setAttribute("aVelocity", new THREE.InstancedBufferAttribute(velocities, 1));
    fishGeometry.setAttribute(
      "aPopulation",
      new THREE.InstancedBufferAttribute(populations, 1),
    );

    let atlasLoaded = false;
    const texture = new THREE.TextureLoader().load("/seeds/fish-atlas-v1.png", () => {
      atlasLoaded = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const fishUniforms = {
      ...sharedUniforms,
      uAtlas: { value: texture },
      uSpeed: { value: initialSnapshot.uSpeed },
      uFishSize: { value: initialSnapshot.uFishSize },
      uDepth: { value: initialSnapshot.uDepth },
      uSelectedSpecies: { value: initialSnapshot.uSelectedSpecies },
      uSwimFocus: { value: initialSnapshot.uSwimFocus },
      uSwarmFrom: { value: initialSnapshot.uSwarmFrom },
      uSwarmTo: { value: initialSnapshot.uSwarmTo },
      uSwarmMix: { value: initialSnapshot.uSwarmMix },
      uMandalaPopulation: { value: initialSnapshot.uMandalaPopulation },
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

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const postScene = new THREE.Scene();
    const postCamera = new THREE.Camera();
    const postGeometry = new THREE.PlaneGeometry(2, 2);
    const postUniforms = {
      ...THREE.UniformsUtils.clone(KaleidoShader.uniforms),
      tDiffuse: { value: renderTarget.texture },
    };
    const postMaterial = new THREE.ShaderMaterial({
      uniforms: postUniforms,
      vertexShader: KaleidoShader.vertexShader,
      fragmentShader: KaleidoShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const postMesh = new THREE.Mesh(postGeometry, postMaterial);
    postScene.add(postMesh);

    let width = 1;
    let height = 1;
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(bounds.width));
      height = Math.max(1, Math.floor(bounds.height));
      renderer.setSize(width, height, false);
      renderTarget.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const clock = new FixedStepClock();
    let lastFrame: number | null = null;
    let fpsAccumulator = 0;
    let fpsFrames = 0;

    const applySnapshot = (snapshot: Readonly<RenderSnapshot>) => {
      sharedUniforms.uTime.value = snapshot.uTime;
      sharedUniforms.uAspect.value = snapshot.uAspect;
      sharedUniforms.uSegments.value = snapshot.uSegments;
      sharedUniforms.uKick.value = snapshot.uKick;
      sharedUniforms.uBass.value = snapshot.uBass;
      sharedUniforms.uHigh.value = snapshot.uHigh;
      sharedUniforms.uDive.value = snapshot.uDive;
      sharedUniforms.uMode.value = snapshot.uMode;
      sharedUniforms.uDrive.value = snapshot.uDrive;
      sharedUniforms.uColorPreset.value = snapshot.uColorPreset;
      sharedUniforms.uSceneMix.value = snapshot.uSceneMix;

      fishUniforms.uSpeed.value = snapshot.uSpeed;
      fishUniforms.uFishSize.value = snapshot.uFishSize;
      fishUniforms.uDepth.value = snapshot.uDepth;
      fishUniforms.uSelectedSpecies.value = snapshot.uSelectedSpecies;
      fishUniforms.uSwimFocus.value = snapshot.uSwimFocus;
      fishUniforms.uSwarmFrom.value = snapshot.uSwarmFrom;
      fishUniforms.uSwarmTo.value = snapshot.uSwarmTo;
      fishUniforms.uSwarmMix.value = snapshot.uSwarmMix;
      fishUniforms.uMandalaPopulation.value = snapshot.uMandalaPopulation;
      fishGeometry.instanceCount = snapshot.instanceCount;

      postUniforms.uTime.value = snapshot.uTime;
      postUniforms.uAspect.value = snapshot.uAspect;
      postUniforms.uSegments.value = snapshot.uSegments;
      postUniforms.uDive.value = snapshot.uDive;
      postUniforms.uDrive.value = snapshot.uDrive;
      postUniforms.uColorPreset.value = snapshot.uColorPreset;
      postUniforms.uMode.value = snapshot.uMode;
      postUniforms.uKick.value = snapshot.uKick;
      postUniforms.uSceneMix.value = snapshot.uSceneMix;
      postUniforms.uResolution.value.set(...snapshot.uResolution);
      renderer.toneMappingExposure = snapshot.toneMappingExposure;
    };

    const drawFrame = () => {
      const snapshot = engine.getRenderSnapshot({ width, height });
      applySnapshot(snapshot);

      renderer.setRenderTarget(renderTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(postScene, postCamera);
    };

    const render = (now: DOMHighResTimeStamp) => {
      const deltaMs = lastFrame === null ? 0 : Math.max(0.1, now - lastFrame);
      lastFrame = now;
      fpsAccumulator += deltaMs;
      fpsFrames += 1;
      if (fpsAccumulator >= 650) {
        onFpsRef.current(Math.round((fpsFrames * 1000) / fpsAccumulator));
        fpsAccumulator = 0;
        fpsFrames = 0;
      }

      clock.accumulate(now);
      const tickCount = clock.takeTicks(5);
      for (let index = 0; index < tickCount; index += 1) {
        // Audio producer: quantize the analyser bands to 15Hz (every 4 ticks)
        // and inject them; the engine owns the smoothing and slew limiting.
        if (engine.getState().tick % AUDIO_TICK_INTERVAL === 0) {
          const levels = audioRef.current;
          engine.dispatch({
            v: 1,
            producerId: "audio",
            type: "beat",
            payload: {
              kind: "bands",
              bands: [
                quantizeBand(levels.kick),
                quantizeBand(levels.bass),
                quantizeBand(levels.mid),
                quantizeBand(levels.high),
              ],
            },
          });
        }
        engine.advanceTick();
      }

      if (clock.pendingTicks > 0) {
        animationId = requestAnimationFrame(render);
        return;
      }

      drawFrame();
      animationId = requestAnimationFrame(render);
    };

    let animationId = 0;
    let uninstallCapture: (() => void) | null = null;
    if (isCaptureEnabled()) {
      uninstallCapture = installCaptureBridge({
        isReady: () => atlasLoaded,
        getSize: () => ({ width, height }),
        draw: () => drawFrame(),
      });
    } else {
      animationId = requestAnimationFrame(render);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      uninstallCapture?.();
      resizeObserver.disconnect();
      scene.remove(backgroundMesh, fishMesh);
      backgroundGeometry.dispose();
      backgroundMaterial.dispose();
      baseGeometry.dispose();
      fishGeometry.dispose();
      fishMaterial.dispose();
      texture.dispose();
      postScene.remove(postMesh);
      postGeometry.dispose();
      postMaterial.dispose();
      renderTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="fish-canvas-host" ref={hostRef} />;
}
