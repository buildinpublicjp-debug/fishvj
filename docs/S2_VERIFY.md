# FishVJ S2 — Replay + semantic determinism 検証記録

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-s2-replay`（main `a4741b8` から） |
| 実施日 | 2026-07-23 |
| 対象 | v2 §2.2 (T0-B) / §4 / §5 / §6 / §11.2 |
| machine | Apple M1 / macOS 26.2 / Chrome 150 / Node v22.23.1 |

## 0. 主張

**60秒 session を record → replay して 30tick毎の semantic hash trace が完全一致する。**
音声平滑・slew limiter は固定tick関数で live/replay へ同一適用され、hash に含まれる。録画archiveは byte 予算内。golden 視覚は不変。

## 1. T0-B（v2 §2.2）— 音声平滑の固定tick化

音声平滑を FishCanvas の RAF ローカル計算から engine の `advanceTick` へ移し、EngineState 所有 → 決定論・hash対象・replay再現。

| 項目 | 実装 |
|---|---|
| smoothExp 係数 | `1 - exp(-dt/tau)`、dt=1/60、tau kick 0.075s / bass 0.111s / high 0.093s（`app/engine/frame.ts`） |
| 15Hz 量子化 | audio band を u8 量子化して 4 tick毎に beat/bands で注入（`FishCanvas` audio producer） |
| slew limiter | luma系 uniform へ soft slew: kickLuma 4.0/s、highLuma 2.0/s（per-tick clamp） |
| snapshot | `uKick=kickLuma` / `uBass=smoothBass` / `uHigh=highLuma`（旧 context.audio を廃止） |
| producer | S2 で `audio`・`replay` を有効化（`validate.ts`） |

EngineState に beat/audio 14 field 追加（bpm/beatPhase/confidence/flux/energy/raw×4/smooth×3/kickLuma/highLuma）。

## 2. Replay format v1（v2 §6）

| file | 役割 |
|---|---|
| `app/engine/replay/format.ts` | dictionary（producers/types/params）、量子化scale、budget定数、manifest型 |
| `app/engine/replay/binary.ts` | CRC32 + 24Bヘッダ chunk。audio 4B/sample、space 66B/sample。CRC不一致・truncation で throw |
| `app/engine/replay/record.ts` | control tuple（dict index・source tick差分・wall-clock t非保存）+ audio binary track + byte予算強制 |
| `app/engine/replay/playback.ts` | archive parse → source-tick schedule 復元 → `driveSession` で再生。producer は "replay" 再刻印、t は新規 |

- control tuple: `[deltaSourceTick, producerIndex, typeIndex, payloadCode, ...quantizedValues]`。値は §5.3 hash scale（norm 65535 / milli 1000）で量子化 → replay値が record値と同一 hash に落ちる。
- 可変長文字列を control へ書かない（§6.4）。
- 予算超過は throw（session invalid、silent drop なし、§6.4）。

## 3. Semantic hash（v2 §5）— 完全版

`app/engine/hash.ts`: §5.3 canonical encoding（enum u8 / bool u8 / normalized round×65535 / field毎scale / 固定順 / 64-bit FNV-1a）で §5.2 の**現存全field**（session/clock + show/visual + transition + **beat/audio**）を符号化。30 tick毎に trace。space state（§5.2 space）は S3 で未実装のため不在。

> golden gate は従来通り S1-subset encoder（`capture/lib/hash.mjs`）を使う。golden baseline（capture-bus）に beat field が無いため、cross-tree 比較の安定性を保つ。full encoder は S2 の record→replay（両側 main+S2）専用。

## 4. 受入結果

| 判定 | 実測 | 合否 |
|---|---|---|
| 60s record→replay hash trace 完全一致 | 121/121（0..3600 tick、30tick毎） | ✅ |
| byte 予算（実測） | control 142B / audio 5,068B / **total 5,210B**（cap total 60,000 / control 28,000） | ✅ |
| CRC破損検出 | payload 1byte 反転 → `CRC mismatch` throw | ✅ |
| truncation検出 | chunk 末尾切り → `truncated` throw | ✅ |
| budget超過 → session invalid | 1秒窓に control 過密 → finalize throw | ✅ |
| golden 視覚不変（audio 0） | hash 131/131 一致、mean SSIM 0.999999 / min 0.999998、全frame 1920×1080 | ✅ |
| SSR markup sha256 | `aba5461d…` 不変 | ✅ |
| CI 5 gate（test:engine **15/15**） | lint / tsc / test:engine / build / SSR 全 exit 0 | ✅ |

テスト: `tests/replay.test.ts`（4本）を `test:engine` に統合。

再現:

```bash
npm run test:engine          # 15/15（engine 11 + replay 4）
# golden re-gate（golden worktree :3001 / current :3000）
node capture/run-capture.mjs --run current --url http://127.0.0.1:3000 --port 9338
node capture/compare-runs.mjs --a golden --b current --gate golden --out capture/golden/golden-gate
```

## 5. 実装中に見つけた bug（修正済み）

`driveSession` の `onEvent?.(store.dispatch(...))` が、onEvent 未指定（replay側）のとき **optional-call の短絡評価で dispatch 引数ごと評価されず**、replay がイベントを一切適用しないまま advanceTick していた。record（onEvent有）とだけ挙動が割れ、hash 全不一致で発覚。`const e = store.dispatch(...); if (onEvent) onEvent(e);` に分離して解消。

## 6. 範囲外（後続）

- **space state / space.bin**（§5.2 space・§6.3 66B/sample・§10）: S3。binary track の 66B/space レイアウトは実装済み（recorder は S2 で space を produce しない）。
- **verb producer / gesture rate**（§4.6）: 未使用。recorder は verb 未対応（到達時 throw）。
- **beat/clock の bpm anchor 由来 phase 導出**（§4.6 後段）: S2 は clock event をそのまま格納・再生するところまで。
