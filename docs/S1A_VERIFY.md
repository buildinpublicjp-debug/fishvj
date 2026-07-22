# FishVJ S1a — verification record

| 項目 | 値 |
|---|---|
| 対象branch | `agent/fishvj-s1a-ssot` |
| 検証tree | `20ee2c4` + 本commitのcapture harness |
| 基準commit | `2275308` (`refine fish motion profiles`) |
| 実施日 | 2026-07-22 |
| machine | Apple M1 / macOS 26.2 |
| browser | Chrome/150.0.7871.181 (headed) |
| runtime | Node v22.23.1 / TypeScript 5.9.3 |
| viewport | 1920 × 1080 CSS px, DPR 1 |
| canvas | 1356 × 761 (console layout内) |
| seed | `0x46495348` |
| sim clock | 60 Hz固定tick |
| audio | 全band 0固定 |

## 0. このrecordが主張する範囲

S1a merge gateは次の4件である。

1. CI 5 gate
2. SSR markup SHA-256の pre/post 一致
3. 決定論2-run (semantic hash trace完全一致 + 同tick pixel SSIM)
4. 手動A/B (zDOG目視)

**主張しないこと**: `2275308` + T0-A を基準点とする committed golden と、それに対する SSIM regression gate。
これは S1b の作業であり、本recordの数値は「S1a HEAD同士の2 runが一致する」ことしか示さない。
「見た目完全不変」(`FISHVJ_DESIGN_V2.md` §7.2) の主張は S1b gate通過後に初めて行う。

## 1. CI 5 gate — green

| # | command | exit |
|---|---|---:|
| 1 | `npm run lint` | 0 |
| 2 | `npx tsc --noEmit --incremental false` | 0 |
| 3 | `npm run test:engine` (8 tests / 8 pass / 0 fail) | 0 |
| 4 | `npm run build` | 0 |
| 5 | `node --test tests/rendered-html.test.mjs` (1 pass) | 0 |

`npm test` (build + SSR test) も exit 0。
gate 1–3 は 2026-07-22 に外部環境でも green を確認済みで、本記録はこのMac上での再実行である。
gate 4–5 (build / SSR) は外部環境ではフォントCDNのegress制約で未判定だったため、判定はこの実行が初となる。

## 2. SSR markup SHA-256 — pre/post 一致

`capture/ssr-markup.mjs` が built worker の `/` をSSRし、`<script>…</script>` と `<link …>` を除去した markup を SHA-256 する。
bundle hash の変化で DOM 契約の退行が隠れないようにするための除去である。

| tree | raw bytes | stripped bytes | SHA-256 |
|---|---:|---:|---|
| `2275308` (pre) | 17,510 | 11,522 | `aba5461d25238b94be2851918d6ccbfd4b60f2d38ad66152f15f5832aac09c0d` |
| S1a HEAD (post) | 17,510 | 11,522 | `aba5461d25238b94be2851918d6ccbfd4b60f2d38ad66152f15f5832aac09c0d` |

一致。SSOT移行と capture harness 追加のどちらもSSR DOMを変えていない。

再現:

```bash
node capture/ssr-markup.mjs <path>/dist/server/index.js
```

> **差異の注記**: PR本文は同じ手順の値を 11,492 bytes と記載している。本Macでの測定値は 11,522 bytes で、30 byte の差がある。
> pre/post を同一のstrip規則で測っている限りこのgateの判定 (pre == post) は変わらないため、差はstrip規則または生成環境の差として記録するに留める。
> 絶対値をgateにする場合は S1b で strip規則を固定すること。

## 3. 決定論 2-run

`capture/manifest.json` は `FISHVJ_DESIGN_V2.md` §9.2 の網羅要件から生成した単一timelineである
(initial / mode 3 / scene 2 / macro 4 / swarm・style 4 / species 8 / movement type 4 /
fishCount・fishSize・speed・depth・colorDrive の min・max・default / DIVE enter・exit /
BLACKOUT on・off / RESET、および scene と swarm の遷移 start・中間・終了 tick)。

| 項目 | 値 |
|---|---|
| manifest | 63 events / 78 captures / 3,900 ticks (65.0 s @60Hz) |
| hash sample | 30 tickごと、131 entry |
| hash trace 一致 | **完全一致** (`run-1` vs `run-2`、131/131) |
| raw sample JSON 一致 | **byte一致** (量子化前のfloatも同値) |
| frame寸法 | 78/78 が 1920 × 1080 |
| 平均SSIM | **0.999999** (閾値 0.999) |
| 最小frame SSIM | **0.999998** |
| 最小window SSIM | 0.996685 |
| byte完全一致frame | 34 / 78 |
| 最大channel差 | 2 / 255 |
| 最大差分pixel数 | 2,933 / 2,073,600 (0.14%) |

非一致pixelは全frameで fish deck のsprite thumbnail領域 (x 13–209, y 121–448) に限局し、最大差は 1–2 LSB である。
WebGL canvas 内には差が出ていない。GPU起因の非byte一致を許容する gate 定義の範囲内。

再現:

```bash
npm run build && npm run start          # 別shellで起動
node capture/run-capture.mjs --run run-1
node capture/run-capture.mjs --run run-2
node capture/compare-runs.mjs --a run-1 --b run-2   # exit 0 = pass
```

## 4. 手動A/B — zDOG判定待ち

`capture/ab-sheet-base-vs-s1a.png` に 9 行の対比 (左: `2275308`、右: S1a HEAD) を出力した。
行順: default / mode EUPHORIC / macro ACID / swarm BLOOM / species RIBBON / scene FREE_SWIM /
DIVE (MANDALA) / BLACKOUT / RESET。

T0-A前の基準commitは `Math.random()` で個体配置を決めるため、pixel比較は `FISHVJ_DESIGN_V2.md` §9.1 により
合格条件にしない。本sheetは色調・密度・尾変形・post effectの性格を人間が見るためのreferenceである。
**判定は zDOG。違和感は `BOARD.md` へ記録すること。**

## 5. Capture harness

| file | 役割 |
|---|---|
| `app/engine/capture.ts` | flag-gateされたin-app bridge。`?capture=1` のときだけ `window.__fishvjCapture` を生やす |
| `capture/build-manifest.mjs` | §9.2網羅要件から `capture/manifest.json` を生成 |
| `capture/run-capture.mjs` | headed Chrome (CDP) で1 runを採取 |
| `capture/compare-runs.mjs` | hash trace / raw sample / per-frame SSIM を比較 |
| `capture/contact-sheet.mjs` | 縮小contact sheetを生成 |
| `capture/ab-shots.mjs`, `capture/ab-sheet.mjs` | 手動A/B用 |
| `capture/lib/{cdp,png,ssim,hash,ab-states}.mjs` | 依存ゼロのCDP client / PNG codec / SSIM / canonical hash |

### flag-gateの確認

`?capture=1` を付けない既定loadで:

- `typeof window.__fishvjCapture === "undefined"`
- RAF loopが通常通り動作 (0.9秒間隔の2 screenshotが相違、SSIM 0.7546)
- FPS表示が更新される

既定挙動・見た目に分岐は出ていない (`docs/design/FISHVJ_UI_VISUAL_CONTRACT.md` §5–6 遵守)。

### capture時のfixture

- viewport 1920 × 1080 / DPR 1 を `Emulation.setDeviceMetricsOverride` で固定
- `prefers-reduced-motion: reduce` をemulateし、CSS animation/transitionを既存の同media query経由で潰す
  (`FISHVJ_UI_VISUAL_CONTRACT.md` §7.1 手順5)
- demo pulseを停止し 4 band を 0 固定 (`?capture=1` 時のみ `FishVJConsole` がdemo RAFを起動しない)
- headless不可。GPU経路が変わるため headed Chrome で統一

### semantic hashの範囲

`capture/lib/hash.mjs` は `FISHVJ_DESIGN_V2.md` §5.3 の canonical encoding 規則
(enum = 固定table u8 / bool = u8 / normalized float = `round(v * 65535)` / 固定field順 / 64-bit FNV-1a) に従うが、
入力は §5.2 のうち **S1で存在するfieldだけ** である。beat/audio state、space state、verb state、
deck ID、atlas content hash は EngineState にまだ無く (S2 / S3)、本traceに含まれない。
§5.2 完全版の encoder は S2 の作業。

## 6. Artifact

| path | 状態 |
|---|---|
| `capture/manifest.json` | commit済 |
| `capture/traces/run-1.trace.json`, `run-2.trace.json` | commit済 (131 entry × 2) |
| `capture/ssim-report.json`, `capture/ssim-report.md` | commit済 |
| `capture/contact-sheet-run-1.png` | commit済 (1890 × 1342、78 frame) |
| `capture/ab-sheet-base-vs-s1a.png` | commit済 (972 × 2470、9 行) |
| `capture/frames/run-1/`, `capture/frames/run-2/` | **未commit** (`.gitignore`)。1920 × 1080 PNG × 78 × 2 |
| `capture/runs/*.samples.json` | **未commit** (`.gitignore`)。raw state/snapshot全量 |
| `capture/ab/{base,s1a}/` | **未commit** (`.gitignore`)。A/B原寸PNG × 9 × 2 |

未commitのartifactは検証機 `/Users/og3939397/dev/fishvj/capture/` 配下にある。
再取得は §3 のコマンドで可能。

## 7. Per-frame SSIM (run-1 vs run-2)

| tick | label | size | SSIM (run-1 vs run-2) | byte-identical |
|---:|---|---|---:|---|
| 0 | initial | 1920×1080 | 1.000000 | yes |
| 30 | default-settled | 1920×1080 | 1.000000 | yes |
| 62 | mode-SENSUAL-enter | 1920×1080 | 1.000000 | yes |
| 90 | mode-SENSUAL-settled | 1920×1080 | 1.000000 | yes |
| 122 | mode-EUPHORIC-enter | 1920×1080 | 1.000000 | yes |
| 150 | mode-EUPHORIC-settled | 1920×1080 | 1.000000 | yes |
| 182 | mode-MYSTIC-enter | 1920×1080 | 1.000000 | yes |
| 210 | mode-MYSTIC-settled | 1920×1080 | 1.000000 | yes |
| 240 | macro-CLEAN | 1920×1080 | 1.000000 | yes |
| 270 | macro-ACID | 1920×1080 | 1.000000 | yes |
| 300 | macro-DEEP | 1920×1080 | 1.000000 | yes |
| 330 | macro-PUNCH | 1920×1080 | 1.000000 | yes |
| 361 | swarm-VORTEX-transition-start | 1920×1080 | 1.000000 | yes |
| 405 | swarm-VORTEX-transition-mid | 1920×1080 | 1.000000 | yes |
| 450 | swarm-VORTEX-transition-end | 1920×1080 | 1.000000 | yes |
| 481 | swarm-WAVE-transition-start | 1920×1080 | 1.000000 | yes |
| 525 | swarm-WAVE-transition-mid | 1920×1080 | 1.000000 | yes |
| 570 | swarm-WAVE-transition-end | 1920×1080 | 1.000000 | yes |
| 601 | swarm-BLOOM-transition-start | 1920×1080 | 1.000000 | yes |
| 645 | swarm-BLOOM-transition-mid | 1920×1080 | 1.000000 | yes |
| 690 | swarm-BLOOM-transition-end | 1920×1080 | 1.000000 | yes |
| 721 | swarm-SPIRAL-transition-start | 1920×1080 | 1.000000 | yes |
| 765 | swarm-SPIRAL-transition-mid | 1920×1080 | 1.000000 | yes |
| 810 | swarm-SPIRAL-transition-end | 1920×1080 | 1.000000 | yes |
| 830 | species-0 | 1920×1080 | 1.000000 | yes |
| 850 | species-1 | 1920×1080 | 1.000000 | yes |
| 870 | species-2 | 1920×1080 | 1.000000 | yes |
| 890 | species-3 | 1920×1080 | 1.000000 | yes |
| 910 | species-4 | 1920×1080 | 1.000000 | yes |
| 930 | species-5 | 1920×1080 | 1.000000 | yes |
| 950 | species-6 | 1920×1080 | 0.999998 | no (2408 px, max Δ2) |
| 970 | species-7 | 1920×1080 | 0.999998 | no (2933 px, max Δ2) |
| 990 | species-0-restore | 1920×1080 | 0.999999 | no (1854 px, max Δ2) |
| 1010 | swim-GLIDE | 1920×1080 | 0.999999 | no (1854 px, max Δ2) |
| 1030 | swim-WAVE | 1920×1080 | 0.999998 | no (2487 px, max Δ2) |
| 1050 | swim-FLOAT | 1920×1080 | 0.999998 | no (2196 px, max Δ2) |
| 1070 | swim-SCHOOL | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1100 | fishCount-100 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1130 | fishCount-2000 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1160 | fishCount-800 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1190 | fishSize-0.5 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1220 | fishSize-3 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1250 | fishSize-1.5 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1280 | speed-0.2 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1310 | speed-1.6 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1340 | speed-0.68 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1370 | depth-0.15 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1400 | depth-1 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1430 | depth-0.74 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1460 | colorDrive-0 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1490 | colorDrive-1 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1520 | colorDrive-0.72 | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1551 | scene-FREE_SWIM-transition-start | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1580 | scene-FREE_SWIM-transition-mid | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1670 | scene-FREE_SWIM-transition-late | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1790 | scene-FREE_SWIM-settled | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 1910 | free-style-VORTEX | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2030 | free-style-WAVE | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2150 | free-style-BLOOM | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2270 | free-style-SPIRAL | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2301 | free-dive-enter-start | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2345 | free-dive-enter-mid | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2480 | free-dive-enter-settled | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2511 | free-dive-exit-start | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2690 | free-dive-exit-settled | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2721 | scene-MANDALA-transition-start | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2750 | scene-MANDALA-transition-mid | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2930 | scene-MANDALA-settled | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 2961 | mandala-dive-enter-start | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 3005 | mandala-dive-enter-mid | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 3140 | mandala-dive-enter-settled | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 3350 | mandala-dive-exit-settled | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 3390 | blackout-on | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 3430 | blackout-off | 1920×1080 | 0.999998 | no (2140 px, max Δ2) |
| 3610 | pre-reset-drifted | 1920×1080 | 1.000000 | yes |
| 3641 | reset-start | 1920×1080 | 1.000000 | yes |
| 3670 | reset-mid | 1920×1080 | 1.000000 | yes |
| 3880 | reset-settled | 1920×1080 | 1.000000 | yes |
