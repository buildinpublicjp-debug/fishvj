# FishVJ UI Visual Contract — image freeze

| 項目 | 値 |
|---|---|
| status | **frozen** |
| 区分 | **hard visual contract** |
| 対象commit | `2275308460f48d4031fa550fafc80e7b2611f900` |
| 基準viewport | `1920 × 1080 CSS px` |
| DPR | `1` |
| browser/GPU | `FISHVJ_DESIGN_V2.md` §9のgolden採取環境と同一 |
| 人間側reference | 2026-07-20の承認メッセージ「FishVJ UI Visual Contract — image freeze」の添付画像 |
| 機械判定の正 | `FISHVJ_DESIGN_V2.md` §9 |

本書は凍結済みの `FISHVJ_DESIGN_V2.md` を改訂しない独立契約であり、同書§7.2「見た目完全不変」を人間が確認するためのreferenceと手順を固定する。添付画像はgolden、state hash、SSIMの代替ではない。

## 1. 権威の順序

視覚判定が競合した場合は次の順に扱う。

1. T0-A後のgolden frame、semantic state hash、SSIM gate
2. 本書の凍結対象・許可変更・禁止事項
3. 添付画像のpixel-normative領域
4. 添付画像の非規範なcanvas表現

機械判定はstate hash全件一致、全frame平均SSIM `>= 0.995`、各frame SSIM `>= 0.990`を要求する。添付画像と `FISHVJ_DESIGN_V2.md` §7.2または§9のスコープが矛盾して見える場合、実装者は画像を独自解釈せず、§8のescalationへ送る。

## 2. 添付画像の規範性

### 2.1 Console全景

default stateのDOM/UI chromeはpixel-normativeである。次を含む。

- topbar、fish deck、output column、control panel、audio barの配置と寸法
- panel、button、range、select、label、shortcut、statusのDOM構成
- 余白、gap、border、角丸、背景、配色、タイポグラフィ、font size、glow
- controlの種類、個数、label、順序、active/disabled表現
- output内のscanlines、output badges、border、glow

### 2.2 Fullscreen出力

fullscreenではWebGL canvas内の魚配置を除き、次のDOM構成と配置がpixel-normativeである。

- `.scanlines`
- `.output-badges`
- `.dive-badge`
- `.blackout-screen`
- `.live-output:fullscreen`の境界と背景

### 2.3 Canvas内

T0-A前の魚の位置、向き、個体ごとの乱数結果は非規範である。色調、密度感、尾変形、泳動、mode/macroの性格、post effectの性格だけを人間側referenceとする。

T0-A後は `FISHVJ_DESIGN_V2.md` §9.1で採取するgolden frame群がcanvas pixel基準を引き継ぐ。以後、添付画像をcanvasのpixel一致判定へ使用しない。

## 3. Default stateの固定値

console全景referenceのdefault stateは次の13視覚stateである。

| State | 固定値 |
|---|---:|
| `scene` | `MANDALA` |
| `mode` | `MYSTIC` |
| `colorPreset` | `PUNCH` |
| `colorDrive` | `0.72` |
| `fishCount` | `800` |
| `fishSize` | `1.5` |
| `speed` | `0.68` |
| `depth` | `0.74` |
| `dive` | `false` |
| `blackout` | `false` |
| `selectedSpecies` | `0` |
| `swimType` | `SCHOOL` |
| `swarm` | `SPIRAL` |

FPS、audio meter、beat orbの瞬時値はcapture直前にfixtureで固定する。audio inputはdemo/mic/fileを停止し、4 bandsを0へ固定する。font loadとatlas loadの完了後にcaptureする。

## 4. 凍結対象

次は変更禁止である。

- layout、余白、component配置
- 配色、typography、font family、font size
- controlの種類、数、label、順序
- `RangeControl` 5本: `COLOR DRIVE`、`FISH COUNT`、`FISH SIZE`、`SPEED`、`DEPTH`
- fish card 8枚とその順序
- scene 2選択、mode 3選択、macro/color 4選択、swarm/style 4選択
- movement type 4選択
- DIVE、EXIT、BLACKOUT、RESET、FULLSCREEN、OUTPUT VIEWの種類と配置
- scanlines、output badges、DIVE badge、BLACKOUTのDOM表現
- border、shadow、glow、animation等の装飾

ラベル文言、選択肢数、配列順、CSS custom property、class名の変更がpixel差分を生まない場合でも、上記DOM契約に触れる変更はvisual change ticketなしでは行わない。

## 5. 許可される変更

S1で許可するのは視覚出力を変えない内部実装だけである。

- setterからEngineEvent `dispatch`への置換
- `useSyncExternalStore`によるEngineStore購読
- renderer adapterと毎frame config snapshotの導入
- `FISHVJ_DESIGN_V2.md` §9.4のCI fix
  - render中の`performance.now()`除去
  - `tDiffuse`型修正
  - Cloudflare binding型修正
- S3の`calibrationMode`中だけoverlayを非表示にする処理

`calibrationMode`は設営専用modeであり、既定表示またはdefault stateを変更しない。modeを抜けた直後に既定overlayが同一DOM、同一CSS、同一配置へ戻ることを要求する。

## 6. 禁止事項

次はS1の作業へ同梱しない。

- 余白、色、contrast、glowの微修正
- componentの並べ替え、統合、分割
- UI libraryの導入
- responsive化またはbreakpoint変更
- icon、glyph、labelの差し替え
- hover、focus、transition、animationの「改善」
- accessibilityまたはcode cleanupを理由にしたDOM wrapper変更
- screenshotに合わせるためのcanvas random配置の手調整
- goldenの更新による差分の追認

必要性を発見した場合は実装せずvisual change ticketへ分離する。

## 7. S1の手動チェック

### 7.1 Capture前提

変更前と変更後を同一Mac、同一Chromium、同一GPUで採取する。

1. viewportを`1920 × 1080`、DPRを`1`へ固定する。
2. browser zoomを100%に固定する。
3. fontとatlasのload完了を待つ。
4. §3のdefault stateとaudio fixtureを投入する。
5. animationを同一capture tickへ固定する。
6. console全景、fullscreen default、fullscreen DIVE、fullscreen BLACKOUTをPNGで保存する。

### 7.2 DOM/UI pixel diff

canvasの乱数差だけを除外し、DOM overlayを除外しない。矩形maskで `.live-output` 全体を除外するとscanlinesとbadgesまで判定対象外になるため禁止する。

手動check用captureでは `.fish-canvas` だけを固定黒へ置換または非表示にし、`.scanlines`、`.output-badges`、`.dive-badge`、`.blackout-screen`は通常通りcompositeする。このcapture専用処理はtest harnessに限定し、productionのdefault表示へ分岐を残さない。

比較条件:

- console全景のUI-only capture: pixel diff `0`
- fullscreen defaultのUI-only capture: pixel diff `0`
- fullscreen DIVEのUI-only capture: pixel diff `0`
- fullscreen BLACKOUTのUI-only capture: pixel diff `0`

anti-aliasing差を許容値で吸収しない。差が出た場合はfont、browser、DPR、animation tickのfixture不一致を先に排除し、それでも残る差はfailとする。

### 7.3 機械gate

DOM/UI pixel diffとは別に `FISHVJ_DESIGN_V2.md` §9を実行する。

1. T0-A patchを基準commitへ適用する。
2. 固定seed、固定60Hz tickでgolden frame群とstate hash traceを採取する。
3. S1後に同一event sequence、同一capture tickで再採取する。
4. state hash全件一致を確認する。
5. SSIM平均`>= 0.995`、各frame`>= 0.990`を確認する。
6. lint、`tsc --noEmit`、build、SSR testを全greenにする。

§7.2と§7.3の両方がgreenのときだけUI visual contract合格とする。

## 8. Escalation

### E-VC-01 — 添付画像binaryのrepo登録

現時点でrepoにある `public/design/fishvj-operator-master-v1.png` は `1672 × 941`、SHA-256 `7bdc3694ec4abfe6f4acc23387eae266fd08daaca6e9bb9aa88e21ec49678685` である。これはR-023由来のoperator master conceptであり、基準viewport `1920 × 1080`のpixel-normative captureとして扱わない。

2026-07-20承認メッセージの添付画像binaryをrepoへexportできる時点で、次を実行する。

1. `docs/design/reference/`へ原寸PNGを無加工で配置する。
2. file名、pixel寸法、SHA-256、default/fullscreen/DIVE/BLACKOUTの対応を本節へ追記する。
3. color conversion、resize、crop、再圧縮を行わない。

binary登録前も本書の凍結範囲と禁止事項は有効である。ただし、添付画像そのものとのpixel照合を完了したとは判定しない。

### E-VC-02 — Referenceとv2の矛盾

添付画像と `FISHVJ_DESIGN_V2.md` §7.2または§9が矛盾して見える場合:

1. 実装を止める範囲を該当componentへ限定する。
2. screenshot座標、DOM selector、期待値、実値をvisual change ticketへ記録する。
3. 画像を根拠にCSS、DOM、goldenを独自変更しない。
4. zDOGの採否までは基準commitの挙動を維持する。

## 9. Freeze rule

本書の変更、添付referenceの差し替え、goldenの更新、pixel thresholdの緩和にはvisual change ticketとzDOGの採否が必要である。内部refactor、CI fix、calibration modeの実装を理由にfreezeを再解釈してはならない。
