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

## 3. S1b golden gate — PASS（2026-07-23）

指示文 `docs/S1B_INSTRUCTIONS.md` / 検証 `docs/S1B_VERIFY.md`。

**main HEAD（SSOT移行）は pre-SSOT 視覚から退行していないことを機械判定済み。**

| gate | 結果 |
|---|---|
| コード等価証明 | シェーダ5/5 byte一致・CSS 0差・遷移数式60fps一致・placement同一seed/順 |
| semantic hash trace（golden vs current） | 131/131 完全一致 |
| SSIM（v2 §9.1/§9.3、閾値 0.990/0.995） | mean 0.999998 / min 0.999997、全frame 1920×1080 |
| CI 5 gate | 全 exit 0 |

- golden baseline = `2275308` + T0-A（patch `capture/golden/t0a-baseline-2275308.patch`）。base専用 `app/capture-bus.ts` で base の遷移数式を固定tick化、`?capture=1` gate。**mainには入れない**。
- 発見した唯一の fidelity 差（`swarmTransitionStartTick` 初期値）は bus 側で修正、pixelでなくhashが捕捉。
- storage（judgment 1）: metadata を repo `capture/golden/`、full-res 78×2 は GitHub Release `golden-t0a-2275308-chrome150`（tar.gz、sha256 記録）。golden は環境固定資産（browser/GPU更新→再基準化）。
- 基準worktree `~/dev/fishvj-base`（patch適用済）は再利用のため残置。

### 未決（zDOG判断）
**deck v0（手順5、未着手）**: `speciesScales`/`speciesMotions` を deck JSON へ外部化 + validator。抽出前後で本golden gate + CI を再通過させて初めて §7.2「見た目完全不変」を主張できる。
今回の authorized scope（手順1〜3 + storage + BOARD + PR）に deck v0 は含めていない。**S1bに畳んで続けるか、S2の前後どちらに置くか**を指示待ち。

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

1. **S1b（進行中）** — committed golden / SSIM harness (v2 §9.1準拠、`2275308` + T0-A 基準点の正式構築込み) + deck v0 外部化。
   指示文 `docs/S1B_INSTRUCTIONS.md`。「見た目完全不変」(v2 §7.2) の主張は **S1b gate 通過後に初めて行う**。
2. **S2** — v2 §11.2 (T0-B / Recorder / Playback / Hash / Test)。zDOG は当初 S2 を先にと発話したが、golden gate を先に張るため S1b を先行に確定 (2026-07-23)。
3. **instrument S1b以降** — `FISHVJ_INSTRUMENT_V1.md` §9 の Sprint積算。

## 6. 7/29 再開者 (Sol) への注意

- **S1a は完了・merge済み。** 旧goalの続き (S1a実装の残り) を実行しないこと。
- 状態は本 file から intake する。現在の作業対象は S1b（`docs/S1B_INSTRUCTIONS.md`）。
- sandbox 内に S1a時代の SSIM 判定結果が残っていれば**回収し、S1b の追認資料として本fileへ添付**すること。
  S1a の合否をそれで上書きしない。
