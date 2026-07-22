# FishVJ World Operator UI Visual Contract v2

> status: frozen / R-045〜R-047 patched / owner approved / implementation not started
>
> canonical image: [`fishvj-world-operator-master-v2.png`](./fishvj-world-operator-master-v2.png)
>
> image SHA-256: `bb5df5b8f0d2b844e18320d82b08764ce6f37e630d690e70b305043703f73006`
>
> reference viewport: `1920×1080`, DPR `1`

## 1. 位置づけ

本画像はWorldSourceを演奏する**演者向けoperator console**の人間側正典である。実装前のため、画像そのものを
DOM pixel diffのgoldenにはしない。レイアウト、情報階層、controlの有無、ラベル、配色、視覚的な有効/無効の
区別をnormativeとし、実装後に同viewportで採取するgoldenが機械判定を引き継ぐ。

現行FishVJ console、Performance Map editor、source browser全画面、surface topology/calibration画面は
別screen contractである。本画像はそれらを置換・凍結しない。

旧`fishvj-world-operator-master-v1.png`は監査履歴として保持するが、normativeではない。

## 2. 凍結する画面構造

1. 中央の`PROGRAM`を最大の視覚領域にする。
2. 左右に`PREVIEW A / PREVIEW B`を分離し、各sourceへ`WORLD` badgeとworld名を表示する。
3. 上部に`DJ / VJ`の2 grammar switchを置く。第3 modeを追加しない。
4. 左右端に各deckの固定空間周波数EQを置く。bandは`LOW · SHAPE / MID · STRUCTURE / HI · DETAIL`の
   3本で、zero pointを明示する。
5. channel opacityと中央A/B crossfaderは共通mixerとして両sourceで有効にする。`MIXER LOCKED`は
   Performance Mapから上書きできないことを示す。
6. `TARGET SCOPE`はv0で`WORLD / SYSTEM / GROUP`だけを表示する。`ENTITY`をoperator既定UIへ出さない。
7. verb padは8 slot固定で、表示順を`IMPULSE / REPEL / ATTRACT / SPAWN / SCATTER / ADVANCE /
   PROPAGATE / TRANSFER`とする。1 pressは1 EngineEventだけを生成する。
8. program上の`AUDIENCE DENSITY 8×8 FIELD`は記録対象のsemantic SpaceStateを示す。個人追跡UIにしない。
9. lifecycle stripとpropagation traceはworld stateのglanceable indicatorであり、装飾chartにしない。

## 3. source種別とtransportのhard表示契約

### bounded world

`RIVER DELTA / BOUNDED WORLD`側だけが`PLAY / CUE / HOT CUE`、cue points、orbital world-time controlを持つ。
orbital controlには`STATE SEEK · BASELINE(p)`を表示し、seekが
[WORLD_SOURCE_V0 §3.5](../WORLD_SOURCE_V0.md#35-bounded-transport-semantics)のcanonical resimulationで
あることを隠さない。

loopはmanifestの`loopStartTick..loopEndTickExclusive`から導出する固定範囲で、ring内に
`MANIFEST LOOP / 0–240 TICKS`形式でread-only表示する。`0–240`は正典画像内のfixture値であり、runtimeでは
loaded manifest値へ置換する。演者が4/8拍などの長さを選ぶbeat-loop controlとactive `LOOP` buttonを
表示してはならない。

world速度は`TIME SCALE 0.50–2.00×`で表示し、BPMとして表示しない。BPMはBeatStateの情報であって
WorldSource固有transport値ではない。

### continuous world

`BLOOM FIELD / CONTINUOUS WORLD`側は`CONTINUOUS · VJ ONLY`、`AUTO-RUN · 1.00×`、
`NO SEEK · NO CUE · NO LOOP`を明示する。activeなjog ring、cue point、CUE、LOOP、BPM、SYNCを
表示してはならない。common mixerのEQとopacityはsource種別に関係なく有効のまま維持する。

## 4. ビジュアル契約

- chassis: light mineral gray / warm off-white。
- typography: charcoal、凝縮sans、暗所で一瞥できるcontrast。
- Deck A: electric cyan。Deck B: vivid coral。live/selection: acid lime。
- UIは博物館の計測器とlive instrumentの中間とし、既存FishVJのblack-neon console、魚card grid、
  mandala controls、scanline chromeのreskinにしない。
- skeuomorphic vinyl、waveformだけのdeck比喩、floating hologram、過剰なneonを使わない。
- PROGRAM内のworld artwork、entity配置、field値、propagation波形は動的でありpixel-normativeではない。
  UI chrome、control数、ラベル、順序、enabled/disabled意味はnormativeである。

## 5. 許可される変更

- runtime値、world名、target ID、preview/program内容の更新。
- accessibility上必要なfocus ring、keyboard state、tooltip。既存hierarchyを変更しないこと。
- 実装後golden取得時のfont rasterization差。配置・control意味・配色を独自変更しないこと。
- calibrationModeでのoverlay非表示。既定operator consoleの変更ではない。

## 6. 禁止事項

- continuous worldへactive DJ transportを追加する。
- time scaleをBPMとして表示する。
- bounded worldへperformer-selectable beat loop、`4/8`長表示、active `LOOP` buttonを追加する。
- fixed mixerをPerformance Map編集対象に見せる。
- target未選択時に暗黙で別scopeへfallbackする表示。
- 1 padを複数eventへ見せるsplit mapping。
- 現行FishVJと同じ画面へ寄せるためのfish card、mandala、旧chromeの再導入。
- 画像とschemaが矛盾した場合に画像を優先する。矛盾は`E-V206`へ積み、schemaを正とする。

## 7. 実装後の合格条件

1. `1920×1080`, DPR `1`でcanonical構造を再現したgoldenを採取する。
2. bounded deckに`PLAY / CUE / HOT CUE`が各1件あり、active `LOOP` buttonと`4/8`表記が各0件である。
3. UI内の文字列に`BPM`が`0件`、continuous deck内のactive seek/cue/loop controlが`0件`である。
4. EQ 3 band×2 deck、opacity 2本、crossfader 1本、verb pad 8枚、target scope 3種をDOMで数える。
5. grammar switch前後のRenderSnapshotとPROGRAM pixel diffが`0`である。
6. common mixerはbounded/continuous両sourceで操作可能である。
7. bounded ringのmanifest loop範囲がloaded manifestの`loopStartTick..loopEndTickExclusive`と一致し、
   operator操作で変化しない。
