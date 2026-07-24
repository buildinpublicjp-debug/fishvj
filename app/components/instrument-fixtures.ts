// Loadable stacks for the instrument surface v0: the bundled GYOGEN stack plus
// a fixture, each a valid StackManifestV0 with a real content hash. Real video
// frame assets are WebCodecs-gated; these carry the manifest + loop the surface
// needs to exercise transport / mixer / composite.
import { stackContentHash, type StackManifestV0 } from "../engine/instrument/stack";

function makeStack(id: string, name: string, count: number): StackManifestV0 {
  const s: StackManifestV0 = {
    v: 0,
    id,
    name,
    sourceKind: "playback",
    contentHash: "sha256:pending",
    frame: {
      width: 960, height: 540, fps: 30, count, maxPayloadBytes: 62208000,
      accessKind: "independent-frames",
      assetPath: `stacks/${id}/frames.bin`, assetHash: `sha256:${id}-f`, byteLength: count * 960 * 540,
    },
    depth: { width: 960, height: 540, format: "r8-unorm", assetPath: `stacks/${id}/depth.bin`, assetHash: `sha256:${id}-d`, byteLength: 518400 },
    alpha: { width: 960, height: 540, format: "r8-unorm", assetPath: `stacks/${id}/alpha.bin`, assetHash: `sha256:${id}-a`, byteLength: 518400 },
    prep: {
      simHz: 60, frameStepTicks: 2, durationTicks: count * 2, phaseAxis: "beat",
      loop: { startTick: 0, endTickExclusive: count * 2, mode: "wrap" },
      parallax: { enabled: false, maxDisplacementPx: 0, edgeDilatePx: 0 },
      provenance: { licenseStatus: "cleared", author: "GYOGEN" },
    },
    access: { gopFrames: 1, cacheFrames: 30, reverseFrames: 15, decodeP95Ms: "unverified", memoryCeilingBytes: 134217728 },
  };
  s.contentHash = stackContentHash(s);
  return s;
}

export const STACKS: StackManifestV0[] = [
  makeStack("gyogen-v0", "GYOGEN", 120),
  makeStack("fixture-drift", "DRIFT", 90),
];

// Media backing for stacks that have real frame assets (the §6.4-benched
// independent-frames path). Stacks without an entry fall back to the
// procedural pattern. GYOGEN's frames are rendered from the fish engine itself.
export const STACK_MEDIA = new Map<string, { base: string; count: number }>([
  [STACKS[0].contentHash, { base: "/bench/frame-", count: 120 }],
]);

export const loadedStackArg = (stack: StackManifestV0) => ({
  stackHash: stack.contentHash,
  stack: { durationTicks: stack.prep.durationTicks, loop: stack.prep.loop },
});
