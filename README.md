# FishVJ

FishVJ is a browser-based live visual instrument that turns generated fish art
into an audio-reactive, independently animated school for projection and VJ
performance.

The current milestone is a complete interactive seed build: eight generated
fish species, up to 2,000 GPU-animated individuals, four swimming systems,
four color-grading macros, microphone/audio-file analysis, blackout,
fullscreen output, and the `INFINITE DIVE` tunnel cue.

## Controls

- `1` / `2` / `3`: MYSTIC / SENSUAL / EUPHORIC
- `D`: enter or exit INFINITE DIVE
- `B`: blackout
- `F`: fullscreen output
- FISH DECK: select a fish species and its natural movement family
- SCHOOL / GLIDE / WAVE / FLOAT: focus a movement system
- CLEAN / PUNCH / ACID / DEEP: switch live color treatment
- COLOR DRIVE: control contrast, saturation, hue motion, and depth
- FISH COUNT / SPEED / DEPTH: tune the output for the projector machine
- AUDIO INPUT: use the deterministic 138 BPM demo pulse, a microphone, or an
  audio file

When using a microphone, FishVJ requests raw input with echo cancellation,
noise suppression, and automatic gain control disabled. An iPhone that appears
as a normal macOS input device can be selected after microphone permission is
granted.

## Visual implementation

- Three.js `InstancedBufferGeometry`
- one shared 4×2 transparent fish atlas
- per-instance position, depth, scale, phase, species, movement, speed, and
  direction
- 12×2 subdivided fish planes with GPU tail/body deformation
- 30–100 Hz kick, 100–250 Hz bass, 250 Hz–2 kHz mid, and 2–12 kHz high-band
  analysis
- radial tunnel shader, beat pulse, color macros, and a bounded INFINITE DIVE
  transition
- safe initial load of 800 fish; tested at 2,000 fish plus INFINITE DIVE at
  60 FPS in the local 1080-class preview

The generated finished artwork is an art-direction target, not a flattened
animation source. Runtime output is rebuilt from independent transparent fish,
depth, motion, light, and tunnel layers so every readable fish remains a live
object.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown by the development server. Microphone access requires
localhost or HTTPS and a user gesture.

Validate the production build:

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

## Project notes

- Product and interaction decisions: `docs/SPEC.md`
- Rendering and audio decisions: `docs/TECH.md`
- Accepted/rejected review items: `docs/REVIEW.md`
- Current implementation checklist: `docs/GOAL.md`
- Generated concept master: `public/design/fishvj-operator-master-v1.png`
- Generated transparent fish atlas: `public/seeds/fish-atlas-v1.png`

Codex session ID: `019f73aa-b334-7b51-b8db-b5855aca5583`

Codex was used to review the interaction contract, generate the visual
direction and fish assets, implement the WebGL/audio system, and validate the
live controls and performance.
