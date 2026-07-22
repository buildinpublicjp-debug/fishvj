// Grayscale SSIM over uniform 8x8 windows with stride 4.
// C1/C2 use the standard 8-bit constants (K1=0.01, K2=0.03, L=255).
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;
const WINDOW = 8;
const STRIDE = 4;

function luma(image) {
  const out = new Float64Array(image.width * image.height);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    out[i] = 0.2126 * image.data[p] + 0.7152 * image.data[p + 1] + 0.0722 * image.data[p + 2];
  }
  return out;
}

/** @returns {{ssim:number,minWindow:number,identical:boolean,maxChannelDiff:number,diffPixels:number}} */
export function compareImages(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }

  let maxChannelDiff = 0;
  let diffPixels = 0;
  for (let p = 0; p < a.data.length; p += 4) {
    const dr = Math.abs(a.data[p] - b.data[p]);
    const dg = Math.abs(a.data[p + 1] - b.data[p + 1]);
    const db = Math.abs(a.data[p + 2] - b.data[p + 2]);
    const worst = Math.max(dr, dg, db);
    if (worst > 0) {
      diffPixels += 1;
      if (worst > maxChannelDiff) maxChannelDiff = worst;
    }
  }

  const ga = luma(a);
  const gb = luma(b);
  let total = 0;
  let windows = 0;
  let minWindow = 1;

  for (let y = 0; y + WINDOW <= a.height; y += STRIDE) {
    for (let x = 0; x + WINDOW <= a.width; x += STRIDE) {
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      for (let wy = 0; wy < WINDOW; wy += 1) {
        let index = (y + wy) * a.width + x;
        for (let wx = 0; wx < WINDOW; wx += 1, index += 1) {
          const va = ga[index];
          const vb = gb[index];
          sumA += va;
          sumB += vb;
          sumAA += va * va;
          sumBB += vb * vb;
          sumAB += va * vb;
        }
      }
      const n = WINDOW * WINDOW;
      const muA = sumA / n;
      const muB = sumB / n;
      const varA = sumAA / n - muA * muA;
      const varB = sumBB / n - muB * muB;
      const covAB = sumAB / n - muA * muB;
      const value =
        ((2 * muA * muB + C1) * (2 * covAB + C2)) /
        ((muA * muA + muB * muB + C1) * (varA + varB + C2));
      total += value;
      windows += 1;
      if (value < minWindow) minWindow = value;
    }
  }

  return {
    ssim: windows ? total / windows : 1,
    minWindow: windows ? minWindow : 1,
    identical: diffPixels === 0,
    maxChannelDiff,
    diffPixels,
  };
}
