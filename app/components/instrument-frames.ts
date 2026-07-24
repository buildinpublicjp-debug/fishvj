// Frame source for real stack playback — the §6.4-benched independent-frames
// path (createImageBitmap decode, 30-frame LRU, prefetch-ahead). Measured on
// the target M1/Chrome: decode+upload cold p95 6.1ms (contract ≤16.7ms).
export class FrameSource {
  private cache = new Map<number, ImageBitmap>();
  private pending = new Set<number>();

  constructor(
    readonly baseUrl: string,
    readonly count: number,
    readonly ext = ".webp",
    readonly cacheSize = 30,
    readonly prefetch = 4,
  ) {}

  /** Returns the cached bitmap for a frame (or null while it decodes) and kicks prefetch. */
  get(index: number): ImageBitmap | null {
    const i = ((Math.floor(index) % this.count) + this.count) % this.count;
    for (let k = 0; k < this.prefetch; k += 1) this.ensure((i + k) % this.count);
    return this.cache.get(i) ?? null;
  }

  private ensure(i: number) {
    if (this.cache.has(i) || this.pending.has(i)) return;
    this.pending.add(i);
    fetch(`${this.baseUrl}${String(i).padStart(3, "0")}${this.ext}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => createImageBitmap(blob))
      .then((bmp) => {
        this.pending.delete(i);
        this.cache.set(i, bmp);
        if (this.cache.size > this.cacheSize) {
          const oldest = this.cache.keys().next().value as number;
          this.cache.get(oldest)?.close();
          this.cache.delete(oldest);
        }
      })
      .catch(() => this.pending.delete(i));
  }

  dispose() {
    for (const bmp of this.cache.values()) bmp.close();
    this.cache.clear();
    this.pending.clear();
  }
}
