# FishVJ S1b — golden gate verification record

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-s1b-golden` |
| baseline | `2275308` + T0-A patch（`capture/golden/t0a-baseline-2275308.patch`） |
| current | main `7c8a059`（S1a SSOT migration） |
| 実施日 | 2026-07-23 |
| machine | Apple M1 / macOS 26.2 |
| browser | Chrome/150.0.7871.181（headed） |
| GPU | ANGLE Metal Renderer: Apple M1 |
| viewport | 1920 × 1080 / DPR 1 / audio 全band 0 |
| seed | `0x46495348` / 60Hz固定tick |

## 0. このrecordが主張すること

**main HEAD（S1a の SSOT 移行）は、pre-SSOT の視覚から退行していない。**
これを (a) コード等価の直接証明 と (b) 契約通りの captured golden + SSIM/hash gate の2本で示す。

**まだ主張しないこと**: `FISHVJ_DESIGN_V2.md` §7.2「見た目完全不変」。§7.2 は deck v0（scale/motion 外部化）が視覚を変えないことの主張であり、deck v0 は本recordの範囲外（`docs/S1B_INSTRUCTIONS.md` 手順5、未着手）。本golden harnessはそのまま deck v0 の再gateに使える。

## 1. コード等価の直接証明（2275308 vs main）

golden gate の芯。SSIM以前に、視覚に効くコードが等価であることをソース差分で示す。

| 対象 | 結果 |
|---|---|
| GLSL シェーダ 5本（background / fishVertex / fishFragment / Kaleido post / fullscreen vertex） | **byte-identical** |
| `app/globals.css` / `app/page.tsx` / `app/layout.tsx` | 差分ゼロ |
| fish placement（PRNG 5 draw/魚） | 同一 mulberry32（seed `0x46495348`）・**同一消費順**（radius offset → seed → scale → phase → velocity） |
| 遷移数式（60fps時） | base render-loop と main `frame.ts` が一致: scene `deltaMs/360`＝`SCENE_ALPHA`、dive `/760`＝`DIVE_ALPHA`、swarm `1500ms`＝`90 tick` |
| mandalaCount / freeSwimCount / instanceCount / toneMappingExposure 式 | 同一 |

したがって main と base+T0-A は構成上、同一シェーダに同一uniform値を与える。SSIM差は GPU 非決定性のみが原因になるはず。

## 2. Golden baseline の構築

`2275308` に最小 T0-A を当てたものを golden とする（patch: `capture/golden/t0a-baseline-2275308.patch`）:

- fish-init の `Math.random()` 5箇所を mulberry32（seed `0x46495348`）単一streamへ 1:1 置換（消費順不変）。
- base専用 `app/capture-bus.ts` を追加。base の render-loop 遷移数式を**固定tickへ転記**し、event順序だけ T0-A 決定化として main の dispatch-before-advance に合わせる。`?capture=1` のときだけ `window.__fishvjCapture` を生やし、main と同一の capture harness / manifest をそのまま流せる。
- flag無しでは通常RAF・通常挙動（golden worktree限定の変更で、mainには入れない）。

### 発見した唯一の fidelity 差（修正済み）

初回 run で hash trace が1 fieldだけ不一致だった。原因は `swarmTransitionStartTick` の初期値（bus `-90` vs main `0`）。pixel は両者 `swarmMix=1` で同一だが hash が割れた。
main の `advanceEngineTick` にある「observedSwarm不変 かつ 前swarmMix≥1 → mix を1に固定」ガードを bus に転記し、初期値を `0` に合わせて解消。以後 hash trace 完全一致。
（この差が pixel でなく hash に出たこと自体が、hash gate が pixel より鋭敏に意味論退行を捕らえる例。）

## 3. Golden gate 判定（v2 §9.1 契約 / §9.3 機械判定）

`node capture/compare-runs.mjs --a golden --b current --gate golden`

| 判定項目 | 閾値 | 実測 | 合否 |
|---|---|---|---|
| semantic hash trace | 全件一致 | 131 / 131 一致 | ✅ |
| raw sample（field値、キー順非依存） | — | 全field一致 | ✅ |
| frame寸法 | 全 1920×1080 | 78/78 | ✅ |
| 平均SSIM | ≥ 0.995 | **0.999998** | ✅ |
| 各frame SSIM | ≥ 0.990 | 最小 **0.999997** | ✅ |
| byte完全一致frame | — | 32 / 78 | — |

**gate PASS。** 非byte一致pixelは fish deck sprite thumbnail 領域に限局・最大1–2 LSB（S1a 2-run と同じ GPU 非決定性）。WebGL canvas 内は run 間で差なし。

CI 5 gate（lint / `tsc --noEmit --incremental false` / test:engine 8-8 / build / SSR test）は s1b tree で全 exit 0。

再現:

```bash
# golden worktree（2275308 + patch）→ :3001、current（main）→ :3000 で起動
node capture/run-capture.mjs --run golden  --url http://127.0.0.1:3001 --port 9337
node capture/run-capture.mjs --run current --url http://127.0.0.1:3000 --port 9338
node capture/compare-runs.mjs --a golden --b current --gate golden   # exit 0 = pass
```

## 4. Golden storage（policy: metadata in repo / full-res in Release）

repo に commit する metadata:

| path | 内容 |
|---|---|
| `capture/golden/t0a-baseline-2275308.patch` | baseline再構築用パッチ（3 files, 418 insertions） |
| `capture/golden/environment.json` | browser/OS/GPU/機体/seed/canvas 等の環境記録 |
| `capture/golden/golden.frames.sha256`, `current.frames.sha256` | 各78 PNG の sha256 |
| `capture/golden/golden-gate.json`, `golden-gate.md` | gate verdict + per-frame SSIM 表 |
| `capture/traces/golden.trace.json`, `current.trace.json` | hash trace |
| `capture/golden/contact-sheet-golden.png` | 縮小 contact sheet 1枚 |
| `capture/golden/release-asset.sha256` | Release tarball の sha256 |

full-res（78×2 PNG + traces + samples）は **commitせず** GitHub Release へ:

- tag `golden-t0a-2275308-chrome150`
- asset `golden-t0a-2275308-chrome150.tar.gz`（sha256 は `capture/golden/release-asset.sha256`）
- 縮小/pHash単独/git-lfs は不採用（縮小＝契約解像度SSIM無効化 / pHash＝診断不能 / lfs＝tarball取得agentにpointerのみ）。

golden は環境固定資産。browser/GPU 更新起因の不一致は **golden失効→再基準化** のescalationとして扱い、コード退行と混同しない（`environment.json` に browser version を記録）。

## 5. 残件

- **deck v0（手順5）**: `speciesScales`/`speciesMotions` を deck JSON（v2 §7.1 shape）へ外部化 + validator + content hash。抽出前後で本golden gate + CI 5 gate + hash trace を再通過させる。通過して**はじめて §7.2「見た目完全不変」を主張できる**。
- 本record時点の主張は §0 の通り「SSOT移行が視覚を変えていない」まで。
