# FishVJ S4 — stack / transport / mixer / preview-program 検証記録

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-s4-stack-transport`（main 予定、S2 #9 の上に stack） |
| 実施日 | 2026-07-23 |
| 対象 | INSTRUMENT_V1 §2 (stack) / §6 (transport) / §7 (mixer/preview-program) / §9.3 |
| 依存 | S2（#9）branch から stack。npm 依存追加なし |

## 0. 主張と範囲

**stack v0 の schema/validation/content-hash と、transport/mixer/preview-program の決定論ソフトコアを実装しテストした。**

- 実装（software、決定論・テスト済）: stack manifest v0 + validation + SHA-256 content hash、Q16.16/Q17 固定小数点、transport reducer（playhead/rate/direction/cue/hotcue/jog）、8-tick ramp、mixer（opacity/crossfader/grammar/preview）、program composite（§7.4 式）。
- **BLOCKED（hardware / integration、spec 自身が unverified）**:
  - §6.4 WebCodecs access spike bench（120-frame fixture の 5値 gopFrames/cacheFrames/reverseFrames/decodeP95Ms/memoryCeiling）— 実機 Mac/Chromium の実 decode 計測が必要。`decodeP95Ms` は spec で `unverified`。
  - §7.4 dual-output（program を external fullscreen へ）— multi-display permission が spec で「実機Sprintまで unverified」。
  - WebGL での stack frame 再生・parallax・composite の実描画 — access bench 成立が前提。
- **後続 sprint**: quantized bar launch（§6.3）は §9.5 通り **S6**（BeatState integration）。

## 1. 実装

| file | 役割 |
|---|---|
| `app/engine/instrument/fixed.ts` | Q16.16（encode/decode）、floorDiv/floorMod/ceilDiv（BigInt 64-bit・overflow reject）、8-tick ramp、field 値域（opacity/crossfader/rate/gain） |
| `app/engine/instrument/stack.ts` | StackManifestV0 型、validateStack（§2.3 全 hard 検査）、stackContentHash（§2.4 canonical manifest + asset 昇順 + 各 digest の SHA-256） |
| `app/engine/instrument/transport.ts` | InstrumentState、reduceInstrument（deck/transport event）、advanceInstrumentTick（ramp→playhead→loop）、programComposite（§7.4） |

### 固定小数点（§6.1）
- Q16.16: `encode(x)=floor(x*65536+0.5)`、`1.0=65536`。playhead は `playheadQ17`（signed 64-bit BigInt）で保持、rate 1.0 で 2 ticks/frame。
- 8-tick 整数 ramp: `elapsed=clamp(n-k+1,0,8)`、`floor((start*(8-e)+target*e)/8)`。rate/opacity/crossfader に適用。jog/button/pad は ramp を通さない。
- 64-bit overflow は session error として throw。

### loop（§6.2）
- `wrap`（floorMod で先頭へ）/`hold`（末端 -1 でクランプ）/`pingpong`（反射 + direction 反転）を Q17 単位で実装。
- seek/cue/hotCue は tick を `×65536` で playheadQ17 へ設定。jogSeek は `deltaQ16Frames×2` を加算。

### mixer / composite（§7.4）
- `Cprogram=clamp(wA·oA·CA+wB·oB·CB,0,1)`（wA=1-x, wB=x）、premultiplied linear cross-dissolve。未装填 deck は RGB/α=0。
- DJ/VJ grammar switch は `controlGrammar` だけを変え、他 state と composite は完全不変（§7.1）。

## 2. テスト（tests/instrument.test.ts、9本）

| test | 内容 |
|---|---|
| stack validation accept | well-formed manifest が pass、hash 再計算一致 |
| stack validation reject | count>120 / fps≠30 / depth byte / durationTicks / parallax 値域 を検出 |
| content hash + license | 1 byte 変化で hash 変化、`unverified` license は warning（technical load 可・公開表明不可） |
| 8-tick ramp | k から 8 tick で target 到達、以後 hold、単調 |
| playhead | rate 1.0 で 4 tick=2 frame、決定論（2回同値） |
| loop wrap/hold | wrap は loop 内へ、hold は末端 -1 クランプ |
| cue/hotcue | cue で cueTick へ seek + pause |
| DJ/VJ 不変 | grammar switch 後、A/B/crossfader/preview/tick と composite が byte 一致 |
| composite | premultiplied cross-dissolve、eject deck=0 |

## 3. 受入結果

| gate | 結果 |
|---|---|
| CI 5 gate（test:engine **24/24** = engine 11 + replay 4 + instrument 9） | lint / tsc / test:engine / build / SSR 全 exit 0 |
| golden 再gate（render path 不変） | hash 131/131 一致、mean SSIM 0.999999 / min 0.999998、全 1920×1080、PASS |

S4 は fish 描画経路（FishCanvas/frame/reducer）に触れないため golden は不変。

## 4. hardware-gated 一覧（S4分）

- **access bench（§6.4）**: 120-frame fixture の 5値実測。実機 Mac/Chromium decode 必須。task 1 spike-first gate は本 sprint で回さず、実機 sprint で E-I01 判定。
- **dual-output（§7.4）**: external fullscreen + multi-display permission。実機表示必須。
- 上記が成立するまで stack frame の実 WebGL 再生・parallax は保留（logic/state/composite は実装済み）。
