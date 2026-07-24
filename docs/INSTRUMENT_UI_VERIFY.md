# FishVJ 楽器UI v0 — 検証記録

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-instrument-ui`（S3 #13 の上に stack） |
| 実施日 | 2026-07-24 |
| 対象 | INSTRUMENT_V1 §5.3 / §6 / §7 / §8 |
| route | **新設 `/instrument`**。既存 console route `/` は無変更 |
| surface全景 | `docs/design/instrument/instrument-surface-v0.png`（1920×1080） |

## 0. 最重要制約 — golden を壊していない

- 既存 console（`/`、単一キャンバス）は **1行も変更していない**。`app/page.tsx` / `FishVJConsole` / `FishCanvas` / `frame.ts` / `globals.css` 不変。
- 楽器 surface は新 route `/instrument` に新設。CSS は `app/instrument/instrument.css`（scoped）で globals.css を汚さない。
- **golden 再gate（console route）: hash 131/131 一致、mean SSIM 0.999999 / min 0.999998、PASS。** 既存 capture harness は console route 上で恒久 green。

## 1. 実装スコープ（INSTRUMENT_V1 準拠）

| # | 項目 | 実装 |
|---|---|---|
| 1 | program 出力 | external fullscreen window（`window.open` + canvas）。§7.4 合成contract厳守（下記）。手動第2window fallback あり |
| 2 | preview | 選択 deck の pre-channel-fader 映像 + playhead + cue 表示 |
| 3 | deck A/B strip | stack load（GYOGEN 同梱 + fixture）、playhead、hot cue 1-8、rate 0.5..2.0 |
| 4 | mixer（モード不変） | LOW/MID/HI ×2、channel opacity ×2、crossfader。既実装 engine（transport/eq）への配線のみ |
| 5 | grammar switch | DJ/VJ。§7.1 不変条項を UI でも保証（下記 gate a） |
| 6 | VJ mode | quantized launch UI（PLAY=次bar予約、カウントダウン overlay 表示） |
| 7 | keyboard/pointer fallback | §5.3。FLX4 なしで全 gesture 操作可（G/Q/P/Z/M/←→/1-8） |

### §7.4 合成contract
program は linear RGB・premultiplied alpha cross-dissolve。`Cprogram=clamp(wA·oA·CA+wB·oB·CB,0,1)`、wA=1-x、wB=x、未装填 deck=RGB/alpha 0。source-over/additive 不使用。preview pixel は program へ混入しない（preview は独立 compositor、pre-fader 経路）。

- **手動第2window fallback は実装したが §8.1 合格には数えない**（Window Management permission による external fullscreen 成立が §8.1 の条件）。
- deck content は procedural stand-in（playhead 駆動）。**実 video stack 再生は WebCodecs access bench（§6.4）成立が前提で BLOCKED**。EQ 実適用は §4 の CPU reference（S5 で unit 済）を shader で 2-level 近似移植。

## 2. gate 結果

### 既存（不変）
| gate | 結果 |
|---|---|
| golden SSIM（console route） | hash 131/131、mean SSIM 0.999999 / min 0.999998、PASS |
| CI 5 gate | lint / tsc / test:engine **58/58** / build / SSR 全 exit 0 |

### 新規自動テスト（`tests/instrument-ui.test.ts`、5本）
| gate | 内容 | 結果 |
|---|---|---|
| a. §7.1 switch invariance | 同一tickで grammar 切替前後の render params（controlGrammar 除く semantic）が **byte 完全一致** → program/preview pixel diff 0（shader は render params の純関数）。grammar だけ変わる | ✅ |
| b. §7.4 合成式 | composite 入力が premultiplied-linear、未装填 deck=0（`programComposite` の contract 一致は `tests/instrument.test.ts` でも数値検証済） | ✅ |
| c. §8.3-7 drift | program/preview が同一 store・同一 tick を読むため 10分（36,000 tick）走行で tick 差 **0**、決定論 | ✅ |
| （VJ launch） | 次 bar 予約 → targetTick で commit（120BPM で bar=120tick） | ✅ |

さらに store 決定論（同一 event/tick 列 → snapshot 完全一致）を検証。

## 3. §8.1 判定表（software 判定可能な行）

| 項目 | 判定 |
|---|---|
| program/preview 2系統が同一 tick・同一 state を参照 | ✅（単一 store）|
| §7.4 合成式一致 | ✅ |
| grammar switch 不変（pixel diff 0） | ✅ |
| keyboard/pointer で全 gesture 操作可（FLX4 不要） | ✅ |
| external fullscreen（Window Management permission） | **BLOCKED**（実機 permission・display は unverified。手動第2window は数えない）|

### 「落とす」行（実装済み表記しない）
汎用 FX chain / NDI / corner pin / output record / shader 拡張 / AI生成 は UI・README・demo に**一切出していない**。

## 4. BLOCKED 維持（hardware）
- FLX4 実機 bench（F-B01-11、§8.4 の 10往復、S4 task 1 spike）: **BLOCKED(hardware)**。keyboard fallback で全 gesture を代替。
- 実 video stack 再生（WebCodecs §6.4）、external fullscreen の実機 permission、実 projector 表示。

## 5. 視覚 identity
v0 の合格は**機能 contract**。旧 console と同一に見える楽器 surface は不合格の評価反転だが、本 surface は別レイアウト（deck A/B strip + program/preview + mixer/EQ）。視覚 identity の確定は着地後に zDOG のスクショレビューで別途（入力用に §surface全景 の 1920×1080 スクショを添付）。
- 暗所ステージ前提のコントラスト（dark stage palette）、latency-first（RAF は canvas 直描画、React 通知は 20Hz に間引き、重い装飾なし）。
