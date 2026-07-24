# FishVJ BOARD

**このfileが状態の入口である。** 再開する者は旧goal・旧handoffの続きを実行せず、まずここから intake すること。

| 項目 | 値 |
|---|---|
| 更新 | 2026-07-23 |
| 現driver | Claude Code (このMac) |
| 対象branch | main HEAD `7c8a059` (S1a merged) / 次作業 `agent/fishvj-s1b-golden` |
| 凍結文書 | `docs/FISHVJ_DESIGN_V2.md` / `docs/FISHVJ_INSTRUMENT_V1.md` (branch `agent/fishvj-instrument-v1`) / `docs/design/FISHVJ_UI_VISUAL_CONTRACT.md` — **変更絶対禁止** |

## 1. 現状態

**S1a は merge 済み（PR #7、rebase → main `7c8a059`）。次は S1b。**

- SSOT移行 + capture harness + S1a検証は main に乗った（`3214735`→`bdd1480`→`6dca7be`→`7c8a059`）。
- 手動A/B は zDOG が 9 行フル目視で承認（同じ楽器・per-fish配置はseed差で不一致=設計通り）。
- 検証結果は `docs/S1A_VERIFY.md`。
- **次作業のCC指示文は `docs/S1B_INSTRUCTIONS.md`。** S1bの最難関（T0-A patchのPRNG消費順一致）は突き合わせ表を同文書に埋めて解決済み。
- 実装agent (Sol) は利用枠切れで 7/29 まで停止。

## 2. S1a 完了項目 (2026-07-22 検証 / 2026-07-23 merge)

| gate | 結果 |
|---|---|
| CI 5 gate (lint / tsc / test:engine 8-8 / build / SSR test) | 全 exit 0 |
| SSR markup SHA-256 pre/post | 一致 (`aba5461d…`、stripped 11,522 B) |
| 決定論 2-run: semantic hash trace | 131/131 完全一致 |
| 決定論 2-run: raw sample JSON | byte一致 |
| 決定論 2-run: 同tick pixel | 78 frame 全て 1920×1080、平均SSIM 0.999999 / 最小 0.999998 (閾値 0.999) |
| 手動A/B | **zDOG承認済** (`capture/ab-sheet-base-vs-s1a.png`、9行フル目視) |

付随して作成したもの: flag-gate (`?capture=1`) された in-app capture bridge、`capture/manifest.json`
(v2 §9.2 網羅)、依存ゼロの CDP / PNG / SSIM / hash harness、contact sheet、A/B sheet。

## 3. S1b — 完了・PASS（2026-07-23）

指示文 `docs/S1B_INSTRUCTIONS.md` / 検証 `docs/S1B_VERIFY.md`。

**main HEAD（SSOT移行 + deck v0）は pre-SSOT 視覚から退行していないことを機械判定済み。§7.2「見た目完全不変」成立。**

| gate | 結果 |
|---|---|
| コード等価証明 | シェーダ5/5 byte一致・CSS 0差・遷移数式60fps一致・placement同一seed/順 |
| golden gate（SSOT移行後） | hash 131/131一致、mean SSIM 0.999998 / min 0.999997 |
| golden gate（deck v0後） | hash 131/131一致、mean SSIM 0.999999 / min 0.999998 |
| CI 5 gate（test:engine 11-11） | 全 exit 0 |

- golden baseline = `2275308` + T0-A（patch `capture/golden/t0a-baseline-2275308.patch`）。base専用 `app/capture-bus.ts` で base の遷移数式を固定tick化、`?capture=1` gate。**mainには入れない**。
- 発見した唯一の fidelity 差（`swarmTransitionStartTick` 初期値）は bus 側で修正、pixelでなくhashが捕捉。
- deck v0: `app/engine/deck.ts` + `decks/gyogen-v0.json`（scale/motionのみ外部化・validator・sha256 content hash）。FishCanvas は `deck.speciesScales`/`Motions` を読む。値は旧literal同一。
- storage（judgment 1）: metadata を repo `capture/golden/`、golden pinned frames は GitHub Release `golden-t0a-2275308-chrome150`（golden-only tar.gz 99MB、sha256 記録）。golden は環境固定資産（browser/GPU更新→再基準化）。current は main から再生成可。
- 基準worktree `~/dev/fishvj-base`（patch適用済）は S2以降の再gate用に残置。
- PR #8（golden gate + deck v0）。merge判断は zDOG。

## 4. 既知の差異・注記

- **PR本文の SSR markup 値**: PR は 11,492 bytes、本Macでの測定は 11,522 bytes (30 B差)。
  pre/post が同一strip規則で一致していることが gate なので判定は変わらない。絶対値をgate化するなら S1b で strip規則を固定する。
- **`fishvj-s1a-pr.md` はこのMac上に存在しなかった**。PR本文は `docs/S1A_VERIFY.md` から起草し、
  引き継ぎ差分で指定された Scope boundary の線引きをそのまま維持した。
- **semantic hash は §5.2 の S1部分集合**。beat/audio、space、verb、deck ID、atlas content hash は未実装 (S2/S3)。
  完全版 encoder は S2 の `Hash` task。
- **capture harness の性格**: S1a の決定論2-runを回すための最小版であり、
  `2275308` + T0-A を基準点とする committed golden ではない。S1b がそれを作る。

## 5. 次キュー

1. ~~**S1b**~~ — **完了**（§3）。golden/SSIM gate + deck v0、§7.2 成立。PR #8 merged。
2. ~~**S2**~~ — **完了**（検証 `docs/S2_VERIFY.md`、PR #9）。T0-B + replay record/playback/binary + §5.2完全版hash。60s record→replay hash 121/121一致、archive 5,210B、golden不変、CI 15/15。
3. **楽器実装（次）** — `FISHVJ_INSTRUMENT_V1.md` §9 の Sprint表を上から。deck v0 は engine S1b で実装済み扱い。FLX4実機依存（F-B系）は BLOCKED(hardware) で skip。Web MIDI adapter は実機なしで進む範囲（mapping table + 仮想MIDI unit test）。
4. **S3 ソフト側のみ** — v2 §10。内蔵webcamで開発、実機受入（レイテンシ等）は BLOCKED(hardware: projector)。契約受入は主張せず「ソフト完成・実機受入待ち」で止める。

## 7. パイプライン進行（2026-07-23/24 完走指示）— **SOFTWARE COMPLETE**

frozen 2文書（v2 / INSTRUMENT_V1）の実装スコープを、機材待ち以外**全部閉じた**。sprint毎に gated PR、各 sprint で CI 5 gate + golden 再gate 通過。

| sprint | 内容 | PR | 検証 |
|---|---|---|---|
| S1a | SSOT / 決定論 | #7 merged | S1A_VERIFY |
| S1b | golden gate + deck v0（§7.2 成立） | #8 merged | S1B_VERIFY |
| S2 | replay + T0-B + §5.2完全版hash | #9 | S2_VERIFY |
| S4 | stack / transport / mixer / composite | #10 | S4_VERIFY |
| S5 | spatial EQ / Web MIDI / FLX4 / mode | #11 | S5_VERIFY |
| S6 | quantized launch / source IF / instrument.bin | #12 | S6_VERIFY |
| S3 | CV v0 ソフト（homography/absdiff/8×8/ring） | #13 | S3_VERIFY |
| 楽器UI v0 | 演奏surface `/instrument`（deck A/B・mixer・EQ・crossfader・DJ/VJ・VJ launch・keyboard fallback） | #14 | INSTRUMENT_UI_VERIFY |

- CI: **test:engine 58/58**（+ instrument-ui 5）、lint/tsc/build/SSR 全 exit 0。
- golden: 全 sprint + 楽器UI で fish 視覚不変（console route 無変更、hash 131/131、mean SSIM ≥0.999999）。npm 依存追加ゼロ。
- 楽器UI: `/instrument` 新route、console route(`/`)は1行も変更なし。surface全景 `docs/design/instrument/instrument-surface-v0.png`。§7.1 switch invariance / §7.4 composite / §8.3-7 drift0 を自動テスト。

### 残: hardware-gated 一覧（実機 sprint で解錠）
- ~~S4: WebCodecs access bench~~ — **解錠済 (2026-07-24)**。対象機=このM1+Chrome で §6.4 実測: 独立フレーム decode+upload cold p95 **6.1ms**（契約16.7ms）、warm 0.8ms、reverse 5.8ms → **独立フレーム経路で確定**。indexed stream(webm+video seek)は seek p95 187ms で不採用。結果 `capture/bench-access.json`。**実フレーム再生を /instrument に配線済み**（魚エンジン産120枚が deck A で実再生、60fps維持）。
- **S4残**: dual-output multi-display permission（§7.4）。
- **S5**: FLX4 F-B01〜11（keepalive 必要性 F-B03 / SysEx / LED / 実機 I/O・jitter F-B04）。`sysex:false`・keepalive 無しが正の既定。
- **S6**: live camera 実収録、hosted provider 実接続（fixture 代替済）、background removal 実推論。
- **S3**: 実 camera（`requestVideoFrameCallback`）、projector、lag 実測、4点 calib UI、§10.6 minimum acceptance 全項目。
- frozen 契約の hardware acceptance（FLX4 / projector / camera）は実機到達まで**表明しない**。

## 6. 7/29 再開者 (Sol) への注意

- **S1a〜S6 + S3ソフトは完了・PR 済み（#7〜#13）。** 旧goalの続きを実行しないこと。状態は本 file から intake。
- 未 merge PR は #9〜#13（S2以降）。merge 順は zDOG。
- 次に実機がある時の入口は上記「hardware-gated 一覧」。各 VERIFY の §hardware-gated が詳細。
- sandbox 内に S1a時代の SSIM 判定結果が残っていれば S1b 追認資料として本fileへ添付（S1a 合否は上書きしない）。
