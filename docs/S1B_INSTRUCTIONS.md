# FishVJ S1b — CC指示文（committed golden / SSIM gate / deck v0）

## 役割
このrepoのdriver。使命は1つ: `2275308` + T0-A を基準点とする **committed golden と SSIM regression gate** を張り、
main HEAD が pre-SSOT 視覚から退行していないことを機械判定し、deck v0（scale/motion 外部化）まで通してPR可能にする。
設計判断はしない。判断が要る事態は `BOARD.md` に書いて停止する。

## なぜS1bが要るか
S1a で証明したのは「同一入力の2-runが一致する」ところまで。**基準commitに対する視覚退行の網はまだ無い**。
`FISHVJ_DESIGN_V2.md` §7.2「見た目完全不変」の主張は、本S1bの golden gate 通過後に**初めて**行える。
S1aのcapture harness（`app/engine/capture.ts` + `capture/`）はそのまま再利用する。

## コンテキスト
- main HEAD = `7c8a059`（S1a merged）。SSOT移行・fixed 60Hz tick・seeded PRNG・capture harness は投入済み。
- 基準commit = `2275308`（`refine fish motion profiles`、移行前コード、`Math.random`）。
- capture harness は `?capture=1` flag-gate、`capture/manifest.json` は v2 §9.2 網羅で既にcommit済み。
- semantic hash（`capture/lib/hash.mjs`）は §5.2 の **S1部分集合**。S1bはpixel golden側を足す作業で、hash側の拡張はS2。

## branch地図
- `2275308` → `3214735`(docs) → `bdd1480`(SSOT) → `6dca7be`(swarm) → `7c8a059`(verify/S1a) = main
- 作業branch: `agent/fishvj-s1b-golden`（本指示文はそのbranchで実行）
- 検証機に基準worktree `~/dev/fishvj-base`（`2275308` checkout済・依存install済）が残っている。再利用可。

## 確定済みの前提（S1a driverが検証済み・再確認不要）
基準commit `2275308` の `FishCanvas.tsx` L808–816 の `Math.random()` 5箇所と、main HEAD の seeded 版（`FishCanvas.tsx` の fish init ループ）は **draw消費順が完全一致**している。

| # | 用途 | 2275308 | main HEAD |
|---|---|---|---|
| 1 | radius offset (y jitter) | `offsets[i*3+1]` (Math.random) | `random()` |
| 2 | seed (z) | `offsets[i*3+2]` (Math.random) | `random()` |
| 3 | scale分散 | `scales[i]` (Math.random) | `random()` |
| 4 | phase | `phases[i]` (Math.random) | `random()` |
| 5 | velocity | `velocities[i]` (Math.random) | `random()` |

魚1体あたり5 draw、順序同一、ループ構造同一、他の属性（motif/ringIndex/speciesIndex/populations）は両側とも決定論で不変。
**したがって T0-A patch は「5つの `Math.random()` を単一 mulberry32（seed `0x46495348`）stream の `random()` へ 1:1 置換」だけで足りる。** 並べ替えは発生しない。
この表と main の `app/engine/prng.ts` を突き合わせて相違が出た場合のみ、停止して `BOARD.md` に差分を書く。

## 手順

### 1. golden側worktree（`2275308` + T0-A）
1. `~/dev/fishvj-base`（`2275308`）に最小T0-Aを当てる。内容は上表の1:1置換のみ:
   - `app/engine/prng.ts` 相当の `createSeededRandom`（mulberry32・seed `0x46495348`）を移植し、5箇所を `random()` へ置換。
   - v2 §2.1 の残り（fixed 60Hz tick 化、render中 wall-clock 除去、audio 全band 0）は、**golden採取に必要な範囲だけ**当てる。goldenは main と同じ capture harness（fixed-tick + `?capture=1`）で撮るため、基準側にも capture bridge 相当を移植する（`app/engine/capture.ts` と `capture/run-capture.mjs` を基準worktreeへコピーで可）。
   - T0-A以外の視覚変更・リファクタを混ぜない（`FISHVJ_UI_VISUAL_CONTRACT.md` §6）。
2. 置換後、基準worktreeで `npm run build` が通ることを確認。

### 2. golden採取（基準）と current採取（main HEAD）
- 同一Mac・同一Chromium・同一GPU・headed・1920×1080・DPR1・audio 0 で、`capture/manifest.json` を両worktreeへ流す。
- headless不可（GPU経路が変わる）。S1aと同一起動フラグを使う。
- 出力: 基準側 golden frame群 + hash trace、main側 current frame群 + hash trace。

### 3. 判定ゲート（v2 §9.3）
- **寸法**: 全PNGが 1920×1080。
- **hash**: 基準 vs main の semantic hash trace（S1部分集合）が **全件完全一致**。一致しなければ reducer/frame 抽出が意味論を変えている → 停止。
- **SSIM**: 対応frame毎 ≥ 0.990、平均 ≥ 0.995。（S1aの同一tree 0.999 とは別基準。基準↔main の cross-tree 比較なので v2 §9.3 の 0.995/0.990 を用いる。）
- **CI 5 gate**: lint / `tsc --noEmit --incremental false` / test:engine / build / SSR test 全green。
- 閾値未達 → §停止条件へ。**通すためにコードを"直さ"ない。**

### 4. golden artifact のcommit（v2 §9.1 レイアウト）
- v2 §9.1 は `tests/visual/golden/<scenario>-tick-<n>.png` の commit を規定する。ただしフル解像度 78 frame ≈ 100MB 級になる。
- **repoサイズがcommit前後で+50MBを超える見込みなら、full-res golden をそのまま積まず停止して `BOARD.md` に選択肢（縮小golden / perceptual hash + contact sheet / git-lfs）を書き、zDOG判断を仰ぐ。** これは保存ポリシーの判断でありdriverの独断で決めない。
- 併せて `expected-hashes.json`（hash trace）、`compare.mjs`（機械判定）、per-frame SSIM表、要約を `docs/S1B_VERIFY.md` に残す。

### 5. deck v0 外部化（v2 §7）
- rendererがJSONから読む挙動値は **scale と motion の2つだけ**（`FishCanvas.tsx` の `speciesScales` / `speciesMotions`）。他を外部化しない（§7.1）。
- `app/engine/deck.ts` に loader / validator / content hash を実装。deck IDは manifest（v2 §6.2 例では `gyogen-v0`）。
- **抽出前後で hash と SSIM gate を再度通す**（v2 §11.1）。値が動いたら外部化が視覚を変えている → 停止。

### 6. BOARD更新 + PR
- `BOARD.md` を「S1b完了・現driver・次キュー=S2」へ更新。
- PR draft を作成、本文は `docs/S1B_VERIFY.md` から起草。merge判断はzDOG。
- **golden gate通過をもって、初めて `FISHVJ_DESIGN_V2.md` §7.2「見た目完全不変」を主張できる。** VERIFY にその一文を明記。

## 受入ゲート（v2 §13 S1 DoD の残件）
- Deck: v0 が scale/motion だけを外部化。
- Visual: hash完全一致・平均SSIM ≥ 0.995・各frame ≥ 0.990。
- CI: lint / typecheck / build / SSR test 全green。

## 停止条件
- **draw順/PRNG消費順の不一致が解消不能** → 該当箇所・両側の順序・仮説を `BOARD.md` に書いて停止。
- **SSIM閾値割れ** → 該当frame一覧 + 差分画像 + 原因仮説を `BOARD.md` に書いて停止。通すためにコードを直さない。
- **hash trace不一致** → 意味論退行の疑い。停止して差分をBOARDへ。
- **golden commit のrepoサイズ過大** → 停止して保存ポリシーをzDOGに問う（手順4）。
- **frozen 3文書（DESIGN_V2 / INSTRUMENT_V1 / UI_VISUAL_CONTRACT）との矛盾を発見** → 実装せず停止、文書は書き換えない。visual change ticket へ分離。
