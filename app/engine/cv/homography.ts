// 4-point homography — FISHVJ_DESIGN_V2.md §10.4.
//
// Solves the projector-UV → camera-UV homography from four corner
// correspondences (DLT: 8 linear equations, h33 = 1) and applies it. Pure math;
// the calibration click UI and real camera are hardware-gated.
export type Point = { x: number; y: number };
export type Homography = number[]; // [h0..h8], row-major 3x3, h8 = 1

/** Gaussian elimination with partial pivoting for an n×n system A·x = b. */
function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) throw new RangeError("homography system is singular");
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= f * m[col][c];
    }
  }
  // Gauss-Jordan complete: each row is [pivot·x_i | value].
  return m.map((row, i) => row[n] / row[i]);
}

/** src → dst, both length-4 corner lists in the same order. */
export function solveHomography(src: Point[], dst: Point[]): Homography {
  if (src.length !== 4 || dst.length !== 4) throw new RangeError("homography needs 4 correspondences");
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const h = solveLinear(a, b);
  return [...h, 1];
}

export function applyHomography(h: Homography, p: Point): Point {
  const denom = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / denom,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / denom,
  };
}
