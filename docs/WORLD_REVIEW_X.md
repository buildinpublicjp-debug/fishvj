# FishVJ World Design — X Review

> review date: 2026-07-21
>
> scope: WORLD_SOURCE_V0 / PERFORMANCE_MAP_V0 / OUTPUT_SURFACES_V0 / WORLD_PROOFS_V0 / INSTRUMENT_V2
>
> method: single adversarial pass
>
> result: X-W01〜X-W08 adopted and patched / active P0=0 / active P1=0
>
> follow-up: 2026-07-22の独立再監査は[WORLD_REVIEW_F](./WORLD_REVIEW_F.md)を正とする

## X-W01

- 対象: `OUTPUT_SURFACES_V0 §6–7` / frozen `FISHVJ_DESIGN_V2 §4.3`
- 攻撃要旨: surface routingのためfrozen `SpacePayload`へ暗黙にsurface IDを追加している。
- 壊れる具体シナリオ: S3 recorderが66B固定sampleを復元してもsurfaceを得られず、新schemaへ
  fieldを足せば66B/5Hzとhash契約を破る。同じreplayが旧/new decoderで別stateになる。
- 根拠: frozen payloadは`grid[64]+energy+silRatio`だけ。v0はcamera 1台である。
- 優先度: P0
- 裁定: adopted。payloadは不変とし、sessionの唯一のCameraBindingからsurfaceを決定する。

## X-W02

- 対象: `WORLD_SOURCE_V0 §4` / `PERFORMANCE_MAP_V0 §6.3`
- 攻撃要旨: world loadとactive map選択を1 eventで行うと書く一方、load payloadにmap hashがない。
- 壊れる具体シナリオ: 同じworld hashでも端末ごとの既定mapが異なり、load直後のsemantic hashと
  次padのeventがlive/replayで分岐する。
- 根拠: 1 gesture=1 event、mapはsourceから分離という両契約があるため、暗黙lookupは使えない。
- 優先度: P0
- 裁定: adopted。`world/load`へ`performanceMapHash`を追加し、両hashをatomic commitする。

## X-W03

- 対象: `WORLD_SOURCE_V0 §5.1` / Instrument v1 `5B/base-param record`
- 攻撃要旨: world paramはparameter IDだけでなくdeck/target scope/target IDを持つため、既存5B tupleへ
  そのまま格納できない。u16量子化もliveとreplayで非対称だった。
- 壊れる具体シナリオ: 同名`density`をworld全体とflower groupへ同時に使うsessionでdictionary codeが
  衝突し、replayが別targetを書き換える。record時だけu16へ丸めると最初のhashから不一致になる。
- 根拠: recordは`tick/order/code/value`の5Bだけで可変文字列を持てない。
- 優先度: P0
- 裁定: adopted。dictionary keyを`deck+parameter+scope+target`へ固定し、liveでもu16往復後の
  canonical Q16だけをdispatchする。

## X-W04

- 対象: `WORLD_SOURCE_V0 §2.1–2.3`
- 攻撃要旨: system typeとcapacityだけでは粒子、boids、lifecycle、graphの挙動が決まらず、
  content hashが同じでもruntime既定値の変更で世界が変わる。
- 壊れる具体シナリオ: `boids`のneighbor radiusを実装更新で変えると、過去world/replayが同じ
  manifest hashのまま別軌道になる。
- 根拠: deterministic contractは全semantic inputのcanonical化を要求する。
- 優先度: P0
- 裁定: adopted。allowlist kernel versionと全Q16/tick config、graph edgesをmanifestへ固定した。

## X-W05

- 対象: `WORLD_SOURCE_V0 §2/§3.2` / Instrument v1 `§4/§7.4`
- 攻撃要旨: WorldRuntimeの出力color space/alpha/formatがなく、共通EQとpremultiplied A/B mixerへ
  接続できない。
- 壊れる具体シナリオ: straight-alpha sRGB worldをlinear premultiplied前提のEQへ入れ、flat EQでも
  edgeが暗くなり、原画一致テストを失敗する。
- 根拠: Instrument v1はlinear RGB・premultiplied alphaをhard契約にしている。
- 優先度: P0
- 裁定: adopted。World outputを`960×540 linear-sRGB premultiplied RGBA8`へ固定した。

## X-W06

- 対象: `WORLD_SOURCE_V0 §2.1/§4` / `PERFORMANCE_MAP_V0 §6.1`
- 攻撃要旨: DJ-compatibleかどうかを参照する記述はあるが、timeline/loopのschemaがない。
- 壊れる具体シナリオ: endless flower worldへCUE/jogを適用したときinitial tick、duration、loopが端末実装に
  委ねられ、同じgestureがno-op/seek/resetへ分岐する。
- 根拠: Instrument transportはbounded playhead、cue、loopの整数規約を前提にする。
- 優先度: P0
- 裁定: adopted。`continuous/djCompatible:false`とbounded timelineのdiscriminated unionを追加した。

## X-W07

- 対象: `WORLD_SOURCE_V0 §2.2–2.3`
- 攻撃要旨: asset総量をplatform gateへ委ねるだけで数値上限とdecoded算術がない。
- 壊れる具体シナリオ: encoded PNGは小さいがdecoded RGBA + CPU/GPU copyで数GBになり、validator通過後に
  tabがkillされてpure VJ fallbackも失う。
- 根拠: targetはM1/16GBだがGPU/CPU共有memoryのworld pathは未計測。
- 優先度: P1
- 裁定: adopted。encoded `256,000,000B`、decoded CPU+GPU `512,000,000B`を仮contractとして置き、
  format別算術をvalidatorへ追加した。

## X-W08

- 対象: `WORLD_PROOFS_V0 §1`
- 攻撃要旨: p95値だけではwarm-up、sample数、CPU/GPU、present intervalが未定義で、
  平均fpsを出せば合格できる。
- 壊れる具体シナリオ: shader compileを除外/混入したrunや、CPU submitだけ速くGPUが詰まるrunが
  同じ「60fps」として記録される。
- 根拠: 現行repoの2,000魚60fpsは表示値で、WorldRuntime/CV込みのp95実測ではない。
- 優先度: P1
- 裁定: adopted。10秒warm-up + 60秒/3,600 tick、CPU update+submit p95 `≤16.7ms`、present p95
  `≤20.0ms`かつ`>33.4ms ≤1%`、可能ならdisjoint GPU timerを別artifactにする。

## Patch audit

| gate | result |
|---|---|
| frozen envelope / SpacePayload diff | `0` |
| new implicit wall-clock/random input | `0` |
| replay budget additive allocation | `0`（既存枠を共有） |
| unresolved source/map/surface hash | `0` |
| unresolved World output format | `0` |
| active P0 | `0` |
| active P1 | `0` |

P2の文言・美術・将来UI改善は本reviewで起票しない。次の再審は実装spike、bench失敗、または
frozen契約を覆す新証拠が出た場合だけ行う。
