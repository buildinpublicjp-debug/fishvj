# FishVJ World Auxiliary Screens Visual Contract v1

> status: frozen / R-048〜R-050 patched / owner approved / implementation not started
>
> reference viewport: `1920×1080`, DPR `1`
>
> authority: `WORLD_SOURCE_V0` / `PERFORMANCE_MAP_V0` / `OUTPUT_SURFACES_V0`
>
> Source Browser canonical: [`fishvj-world-source-browser-master-v2.png`](./fishvj-world-source-browser-master-v2.png)
> — SHA-256 `20eb52f2d32b85486b9caf3c5317f548625d907e62ba0f4d640e8164b769d884`
>
> Performance Map canonical: [`fishvj-world-performance-map-master-v3.png`](./fishvj-world-performance-map-master-v3.png)
> — SHA-256 `8816a0f87cf808a81bf756f7e7e9f541616d68d715981a067ff199ca43a68e31`
>
> Surface/Calibration canonical: [`fishvj-world-surface-calibration-master-v1.png`](./fishvj-world-surface-calibration-master-v1.png)
> — SHA-256 `5ab314d105a0cff5146c003de77bb685344413499dc5f2cfb7046aab0cc0901d`

## 1. 位置づけ

本書はWorld operator console以外の演者・制作者向け3画面を画像生成前に拘束する。画像から新しい
source field、binding、transport、surface能力を仕様へ逆輸入しない。schemaと本書が矛盾する場合はschemaを正とし、
画像をfreezeしない。

3画面は[World Operator UI Visual Contract v2](./FISHVJ_WORLD_UI_VISUAL_CONTRACT.md)と同じchassis、配色、
凝縮sans、計測器的な情報階層を共有する。ただしoperator consoleのA/B deck、crossfader、verb pad列を再利用せず、
各画面の主作業が一瞥で異なる構図にする。現行FishVJのblack-neon chromeへ戻さない。

## 2. Source Browser

### 2.1 主語と目的

演者が`stack | world`を検索・検査し、compatibleなPerformance Mapと組にしてDeck AまたはBへloadする画面。
loadは`worldHash + performanceMapHash`を運ぶ既存のatomic `world/load` 1 eventであり、source選択とmap選択を
別操作として確定しない（hard）。

### 2.2 凍結構造

1. headerに`SOURCE BROWSER`、接続controller profile、現在grammarを表示する。
2. 左railに`ALL / STACK / WORLD` filterと`BOUNDED / CONTINUOUS` timeline filterを置く。
3. 中央をsource libraryのcard/list領域とし、各itemへsource kind、timeline、DJ compatibility、validation状態を表示する。
4. 右inspectorに大きなpreview、manifest概要、systems/groups/capabilities、encoded/decoded budget、content hash状態を置く。
5. footerに`TARGET DECK A / B`、compatible Performance Map選択、`LOAD SOURCE + MAP`を置く。
6. continuous worldをDJ grammarで選んだ場合はloadをdisabledにし、`VJ ONLY · DJ TRANSPORT REJECTED`を表示する。
7. validation/hash/capability不一致はload前にfail closedとし、警告を無視するoverrideを置かない。

正典のfixtureはVJ grammar、type `ALL`、timeline/compatibility filter未選択で6 sourceを表示し、
continuousな`BLOOM FIELD`を選択する。`LOAD SOURCE + MAP`はVJ grammarとの互換がgreenであるため有効とする。

### 2.3 禁止

- sourceだけを先にactive deckへ入れ、mapを後から選ばせる表示。
- continuous worldへPLAY/CUE/JOG/HOT CUEを示す表示。
- arbitrary script、shader code、network fetchを許可するauthoring control。
- validation failureを「force load」するcontrol。

## 3. Performance Map Editor

### 3.1 主語と目的

制作者がcontroller profileのcontrol IDを、source capabilityと具体targetへ`1 gesture → 1 event`で配線する画面。
rendererやworld parameterを直接操作するruntime consoleではない。

### 3.2 凍結構造

1. headerに`PERFORMANCE MAP`、map name、controller profile、grammar、compatible source、validation状態を表示する。
2. 左railに入力control一覧を`PAD / SHIFT PAD / EXTRA MIDI / KEYBOARD / UI`で分類する。
3. 中央をbinding lane/tableとし、各rowを`INPUT → GESTURE → TARGET → OPERATION → QUANTIZE`の一方向にする。
4. 右inspectorでtarget scopeを`DECK / PROGRAM / WORLD / SYSTEM / GROUP / ENTITY / SURFACE`から選ぶ。
   `PROGRAM`はfixed mixer以外v0禁止のためlock付きdisabled表示にする。`ENTITY`と`SURFACE`も
   必要producer/milestoneが無い場合、lock付きdisabled表示にする。
5. operationはschemaの`fixedMixer / transport / show / worldParam / worldInvoke`を表示するが、fixed mixer rowは
   `LOCKED · GLOBAL`としてread-onlyにする。
6. binding countを`N / 64`、UTF-8 ID validation、capability compatibility、1-event invariantを常時表示する。
7. save前にcanonical hashを再計算し、validation greenの場合だけ`FREEZE MAP`を有効にする。
8. frozen default `fishvj-world-v0`を直接編集せず、editorは`fishvj-world-v0 (copy)`など別IDのcopyを開く。
   freeze時に新しいmap IDとcontent hashを保存する。

正典は`fishvj-world-v0 (copy)`の8 padを8本の単方向rowで示す。row内のworld/group/system名、verb ID、
quantize値はfixtureであり、別mapのruntime値を拘束しない。row数、fan-out禁止、locked mixer、scopeの
enabled/disabled意味はnormativeである。

### 3.3 禁止

- 1 inputから複数operationへfan-outするnode graph。
- EQ、channel opacity、crossfaderを編集可能に見せるcontrol。
- variable bindingのtargetとして`PROGRAM`を選択可能に見せるcontrol。
- frozen default mapのID/hashを保ったままbindingを書き換える保存動線。
- target未選択時のworld fallback。
- raw MIDIとsemantic eventを同時に記録する設定。
- mode switchとmap switchを同一gestureへ束ねる表示。

## 4. Surface Topology / Calibration

### 4.1 主語と目的

設営者が同一worldのlogical surface、portal、camera binding、physical program surfaceの4点homographyを検査・
校正する画面。別sourceや別simulationをsurfaceごとに再生する画面ではない。

### 4.2 凍結構造

1. headerに`SURFACE TOPOLOGY / CALIBRATION`、profile hash状態、`60HZ SHARED WORLD TICK`を表示する。
2. 左をlogical world canvasとし、`960×540`内へ最大4 surfaceとportal edgeを配置する。
3. v0のphysical program surfaceは常に1件だけactiveにし、追加physical outputはlock付きdisabled表示にする。
4. 中央または右にprogram output previewを置き、4 corner handleと順序`1→2→3→4`を明示する。
5. inspectorにsurface role、logical rect、pixel viewport、render order、calibration hash、camera bindingを表示する。
6. cameraは最大1件で、選択program surfaceへだけbindingする。offscreen surfaceはcamera grid zeroを表示する。
7. `CALIBRATION MODE`ではcanvas clean-outputを示し、`DOM OVERLAYS OFF`を明示する。
8. footerにtopology validationを置き、portal overlap、unresolved hash、2件目program surfaceをfail closedにする。

正典はphysical program `SURFACE A`とoffscreen fixture `SURFACE B`の2面fixtureである。座標、corner値、
preview artworkは非規範だが、Aだけがphysical、Bのcamera gridがzero、両calibration hashがverified、
4点順序、`DOM OVERLAYS OFF`はnormativeである。

### 4.3 禁止

- 2面physical outputをv0でactiveに見せる。
- surfaceごとに独立clock、seed、source、simulationを持つ表示。
- camera maskを全surfaceへ複製するcontrol。
- calibration hash不一致のままprogram出力を開始するoverride。
- portal crossingでentityを両surfaceへ複製する説明。

## 5. 共通の画像受入

1. 各画像は`1920×1080`, DPR `1`の人間側referenceとする。
2. 3画面がoperator consoleと同じA/B deck構図に見えない。
3. schemaに存在しないactive controlを表示しない。
4. UI chromeと静的labelはnormative、preview artworkとruntime値は非規範とする。
5. 変更にはschema差分またはオーナーの再審票が必要で、画像だけを先行更新しない。
