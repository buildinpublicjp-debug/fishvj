# FishVJ S6 — source/parity + quantized launch + instrument.bin 検証記録

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-s6-source-launch`（S5 #11 の上に stack） |
| 実施日 | 2026-07-23 |
| 対象 | INSTRUMENT_V1 §3 (source 4系統/共通IF) / §5.5 (instrument.bin) / §6.3 (quantized launch) / §9.5 |

## 0. 主張と範囲

**quantized launch の bar 数学（BeatState anchor→targetTick）、source 共通IF + 注文着弾 state machine、instrument.bin binary track を実装しテストした。**

- 実装（software、決定論・テスト済）: §6.3 quantized launch（整数 bar 演算）、§3 source IF + generated 注文着弾、§5.5 instrument.bin（13 lane mask + base-param + CRC、round-trip lossless）。
- **BLOCKED（hardware）**: live camera の rolling input 実収録、hosted provider の実接続（→ fixture adapter で代替）、background removal の実素材品質・M1 推論時間（§3.2 unverified）。live source で bounded 区間を外部 asset 化できない session は `replayable:false`（決定論 replay 成功を表明しない、§3.2 通り）。

## 1. quantized launch（§6.3）

`app/engine/instrument/launch.ts` — 全て整数（signed 64-bit）。live/replay 同一 targetTick。

| 項目 | 実装 |
|---|---|
| clock canonicalize | `phaseU16=floor(phase*65535+0.5)`, `phaseQ16=min(65535, floor(phaseU16*65536/65535+0.5))`, `bpmQ16=floor(bpm*65536+0.5)`, `confidenceU16`。phase<1.0 は 65536 へ丸め上げない |
| beat position | `beatQ16(T)=beatAQ16+floorDiv((T-Ta)*bpmQ16A, 60*SIM_HZ)`、unwrapped |
| anchor 更新 | 予測に最も近く下位16bitが `phaseQ16N` になる `beatNQ16`、同距離は正方向 |
| bar 予約 | `targetBeatQ16=4*65536*(floor(beatRQ16/(4*65536))+1)`、`targetTick=Ta+ceilDiv((targetBeatQ16-beatAQ16)*60*SIM_HZ, bpmQ16A)` |
| 低 confidence | `confidenceU16<32768`（float 0.5）なら bar snap せず次 tick |

## 2. source 共通IF（§3）

`app/engine/instrument/source.ts`

- `StackSourceV0` / `StackCandidate` / 5 state（idle/preparing/validating/ready/failed）。program へ pixel を直接書かず、§2.3 validation + hash 確定を通って初めて `ready`（§3.1）。
- generated 注文着弾（§3.3）: 注文→待機→validation→着弾。ready 後に最初の bar 境界へ `reserveLaunch` で予約。provider job 完了時刻を演奏時刻にしない（source tick で予約）。
- license gating: `unverified` は technical load 可・`cleared()` false（公開上映表明不可、§3.3）。
- 失敗の隔離: 生成失敗/license不明/validation失敗は source 単体の失敗で、他 source を止めない（§3.3）。

## 3. instrument.bin track（§5.5、X-04 amendment）

`app/engine/replay/instrument-bin.ts`

- 1 flush tick = 1 sample: `[deltaSourceTick u16, changedLaneMask u16, firstOrderInTick u8, value u16×set bit]`。
- 13 lane 固定順（EQ6/opacity2/tempo2/crossfader1/jog2）。EQ/fader は raw14 を u16、jog は signed i16（replay で `×16384` = deltaQ16Frames）。
- base param record `5B`（tickInChunk/orderInTick/dictionaryCode/canonicalValue）を同 chunk 末尾へ。
- header `interval microseconds=0` を variable-interval sentinel、CRC32。`firstOrderInTick+laneCount-1>255` と余剰非-5B-倍数を reject。
- round-trip lossless を確認。

## 4. 受入結果

| gate | 結果 |
|---|---|
| CI 5 gate（test:engine **46/46** = engine11+replay4+instrument9+s5 11+s6 11） | lint / tsc / test:engine / build / SSR 全 exit 0 |
| golden 再gate（render path 不変） | hash 131/131、mean SSIM 0.999999 / min 0.999998、PASS |

S6 tests（11本）: clock canonicalize、bar snap（120BPM→targetTick 120/240）、低confidence→次tick、anchor phase-lock、generated ready/failed、unverified license、失敗隔離、reserve gating、instrument.bin round-trip/CRC/order-run reject。

## 5. hardware-gated 一覧（S6分）

- **live camera 実収録 / hosted provider 実接続**: 実機・network 必須。fixture/generated adapter は実装済み、実接続は BLOCKED。
- **background removal 実推論**: M1 実測（§3.2 約2.7-2.8s warm、live 30fps 前景分離には使わない）。素材品質 unverified。
- **10分 integration / parity 実演**: §9.5 の 10-minute integration は実 stack 再生（S4 hardware-gated）に依存。決定論の芯（record→replay hash、launch、instrument.bin）は unit で担保。
