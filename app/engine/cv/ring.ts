// Low-resolution final-post history ring — FISHVJ_DESIGN_V2.md §10.2.
//
// A 512×288 RGBA8, 12-frame ring of downsampled final-post output. The camera's
// measured lag selects the matching history slot for absdiff. Real lag
// measurement is hardware-gated (§10.5); this is the buffer + slot logic.
import type { RgbaImage } from "./space";

export const RING_WIDTH = 512;
export const RING_HEIGHT = 288;
export const RING_FRAMES = 12;
export const RING_FRAME_BYTES = RING_WIDTH * RING_HEIGHT * 4; // 589,824

export class HistoryRing {
  private frames: (RgbaImage | null)[] = Array(RING_FRAMES).fill(null);
  private ticks: number[] = Array(RING_FRAMES).fill(-1);
  private head = 0;

  get byteLength() {
    return RING_FRAME_BYTES * RING_FRAMES;
  }

  /** Push the current final-post frame (already downsampled to 512×288). */
  push(frame: RgbaImage, tick: number) {
    if (frame.width !== RING_WIDTH || frame.height !== RING_HEIGHT) {
      throw new RangeError("history frame must be 512×288");
    }
    this.frames[this.head] = frame;
    this.ticks[this.head] = tick;
    this.head = (this.head + 1) % RING_FRAMES;
  }

  /**
   * Returns the frame `lagFrames` behind the most recent push, or null if the
   * lag exceeds the ring (caller escalates E-03 rather than starting CV).
   */
  slotForLag(lagFrames: number): { frame: RgbaImage; tick: number } | null {
    if (!Number.isInteger(lagFrames) || lagFrames < 0 || lagFrames >= RING_FRAMES) return null;
    const index = (this.head - 1 - lagFrames + RING_FRAMES * 2) % RING_FRAMES;
    const frame = this.frames[index];
    if (!frame) return null;
    return { frame, tick: this.ticks[index] };
  }
}
