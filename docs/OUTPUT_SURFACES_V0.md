# FishVJ Output Surfaces Contract v0

> status: frozen / topology hard / X review P0=0 / physical multi-projector implementation out of v0
>
> initial proof: camera `1台` + projector `1台`（contract / unverified）

## 1. 定義

Output surfaceは動画fileでも独立sceneでもない。同じWorldRuntimeを同じsimulation tickで見る
calibrated viewportである。preview/programは演者向けの信号系、surfaceはprogramの空間分割であり、
両者を混同しない。

```ts
interface OutputSurfaceProfileV0 {
  v: 0;
  id: string;
  name: string;
  logicalWorld: { widthQ16: number; heightQ16: number };
  surfaces: OutputSurface[];
  portals: SurfacePortal[];
  cameras: CameraBinding[];
  contentHash: `sha256:${string}`;
}

interface OutputSurface {
  id: string;
  role: "program" | "offscreen-fixture";
  logicalRectQ16: { x: number; y: number; width: number; height: number };
  pixelViewport: { width: number; height: number };
  calibrationHash: `sha256:${string}`;
  renderOrder: number;
}

interface SurfacePortal {
  id: string;
  fromSurface: string;
  fromEdge: "left" | "right" | "top" | "bottom";
  fromRangeQ16: [number, number];
  toSurface: string;
  toEdge: "left" | "right" | "top" | "bottom";
  toRangeQ16: [number, number];
  direction: "one-way" | "two-way";
}

interface CameraBinding {
  id: string;
  surfaceId: string;
  calibrationHash: `sha256:${string}`;
  role: "cv-residual";
}
```

## 2. canonical limits

| item | v0 contract |
|---|---:|
| physical program surfaces | `1` |
| logical/offscreen surfaces | `1..4`（unverified on target） |
| portals | `0..8`（unverified on target） |
| cameras | `0..1` |
| program viewport | `1920×1080`, DPR `1` |
| world internal resolution | `960×540` |
| calibration | surfaceごとに4点homography hash |
| simulation clock | 全surface共通`60Hz` fixed tick |

`role:"program"`が2件以上あるprofileはv0 physical loaderがrejectする。複数program surfaceはschemaで
表現できるが、解錠milestoneまではoffscreen acceptance以外で成功扱いにしない。

## 3. topology validation

1. surface/camera/portal IDは各配列で一意。
2. logical rectangleは正の面積を持ち、signed Q16.16範囲内。
3. portalのfrom/to surfaceが存在し、rangeは`0..65536`かつstart≤end。
4. 同一source edge上でportal rangeが重ならない。
5. `two-way`はvalidatorが逆向きedgeをcanonicalに生成し、manifestへ重複記述しない。
6. program surfaceのcalibration hashが解決できないprofileは開始拒否。
7. camera bindingは1 surfaceだけを参照し、frozen S3 calibrationと同じcanvas clean-outputを使う。

content hashは自身のhash fieldを除いたcanonical JSONと全calibration profile hashを固定順で
連結したbyte列のSHA-256（contract）である。

## 4. render model

各tickでWorldRuntimeを**一度だけ**進め、その同じRenderSnapshotをsurface ID昇順でviewport別に
render targetへ描く（hard）。surfaceごとにsimulation、PRNG、BeatState、SpaceState、
`performance.now()`を持たない。

program output pipeline:

```text
World/Stack source snapshot
  → deck EQ / opacity
  → A/B premultiplied linear mix
  → master post
  → surface viewport crop
  → surface calibration warp
  → physical program output
```

previewはpre-channel-faderのdeck映像を演者画面へ出し、surface calibrationやportal分割を
programから逆流させない。frozen S3のcamera subtraction用historyは**calibration warp後の最終canvas**を
参照する。calibrationModeではDOM overlayを無効化する。

## 5. entity transfer

### 5.1 ownership

各world entityは常に`ownerSurfaceId`を1つだけ持つ（hard）。logical world positionは連続だが、
render listはowner surfaceだけへ入れる。portal crossingの同一tickで2面へ複製しない。

### 5.2 tick rule

tick `n`のbehavior更新後にentityがportal from edgeを越えた場合:

1. crossing positionをQ16でedge rangeへ射影する。
2. from/to rangeの比でdestination edge positionへ写す。
3. destination内側へ`65536 Q16 = 1 logical pixel`（contract）進めて位置をcanonicalizeする。
4. entity ID、velocity、age、group、PRNG stateを維持する。
5. tick `n`のtransfer queueへ積み、entity ID順でownerをto surfaceへ変更する。
6. tick `n`のRenderSnapshotはdestinationだけへentityを出す。

同tickに複数portalを越える速度はv0で禁止し、最大移動量を最小surface辺長の`1/4`以下
（contract）へclampする。portal chainは次tick以降に進める。

### 5.3 cross-system influence

移動先worldに同じcapabilityがある場合だけtyped interactionを継続する。source側のverbを
destinationの似た名前へ文字列推測で変換しない。binding不一致は移動自体を止めず、そのinteractionを
no-opとしてdiagnosticへ記録する。

## 6. camera/SpaceState routing

v0のcameraは1つのphysical program surfaceだけを見る。

- 30Hz residual mask: bindingされたsurfaceのrenderer-only fast layerへだけ配送。
- 5Hz semantic SpaceState: frozen payloadを変更せず、session profile内の唯一のCameraBindingから
  surfaceを決定し、そのsurface内の8×8 logical gridへ作用。
- cameraのないoffscreen surface: grid zero、energy zero、silRatio zero（contract）。
- surfaceを跨いでcamera maskを複製しない。
- BLACKOUT中はfrozen S3どおりSpaceState eventを生成しない。

multi-camera fusion、個人ID tracking、camera間handoffはv0外である。

## 7. replay/hash

session manifestにOutputSurface profile hashと各calibration hashを保存する。replay hashへ次を追加する。

- profile hash。
- surface ID順のlogical rectangles。
- portal canonical graph。
- entity owner surface。
- pending transfer queue。
- canonical CameraBinding（SpacePayload自体へsurface IDを追加しない）。

physical window position、display EDID、OS compositor timestamp、projector latencyはsemantic hashへ
入れない。異なるsurface profileでのreplay開始は拒否する。

## 8. acceptance

### single physical surface

- 1920×1080、DPR 1のprogram canvasが1面だけ出る（contract）。
- previewとprogramは同じsimulation tickを参照する。
- calibration profile hash不一致で出力開始を拒否する。
- camera停止時もpure VJ/DJ出力が継続する。

### simulated two-surface fixture

- A/B各`480×540` offscreen target（contract）をlogical `960×540`に隣接させる。
- `200 entities`（contract）のうち指定entityがright portalを越えたtickでAから消えBへ一度だけ現れる。
- `120 seconds`（contract）のlive/replayで30 tickごとのworld hashが完全一致。
- 各tickの`count(A)+count(B)=200`（contract）で、重複ID `0`、欠落ID `0`。
- physical projectorを2台接続した証明とは表記しない。

## 9. Escalation

- **E-O01 — 2面physicalが必要**: Window Management permission、2 display fullscreen、frame skew、
  projector latencyを実測する独立milestoneを起票する。
- **E-O02 — frame skew**: 同一process内のrender順で許容値を超える場合、surfaceを別processへ分けず、
  GPU fence/timestampを先に測る。distributed syncはv0へ追加しない。
- **E-O03 — portalで高速entityが飛ぶ**: v0 speed clampを維持し、continuous collision/複数portal traversalは
  new runtime versionへ送る。
- **E-O04 — 1 cameraで複数面を見たい**: cameraごとのhomography、occlusion、surface attributionの
  fixtureが揃うまでsemantic maskを複製しない。
