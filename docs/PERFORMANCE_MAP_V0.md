# FishVJ Performance Map Contract v0

> status: frozen / hard mapping boundary / X review P0=0 / implementation not started
>
> purpose: 物理操作、操作文法、対象scope、source能力を分離する

## 1. 分離原則

| layer | 責務 | 例 |
|---|---|---|
| Controller profile | raw信号をcontrol IDへ正規化 | FLX4 `B0 07/27` → `deckA.eqHigh` |
| Control grammar | gestureの読み方を切替 | DJ / VJ |
| Performance map | control IDを1つの意味eventと具体targetへ写す | pad 1 → group `water`へ`flow.impulse` |
| Source manifest | 実行可能capabilityを宣言 | `flow.impulse`, `entity.scatter` |
| Reducer/runtime | eventを検証し状態へ適用 | world groupへatomic command |

mapはassetやsource manifestへ埋め込まない。sourceは「何ができるか」だけ、mapは「誰が何を
どう触るか」だけを持つ（hard）。

## 2. schema

```ts
interface PerformanceMapV0 {
  v: 0;
  id: string;
  name: string;
  controllerProfile: string;
  grammar: "DJ" | "VJ" | "both";
  compatibleSource: "stack" | "world" | "any";
  bindings: PerformanceBinding[];
  contentHash: `sha256:${string}`;
}

interface PerformanceBinding {
  id: string;
  input: {
    controlId: string;
    gesture: "absolute" | "relative" | "press" | "release";
    modifier?: "shift";
  };
  when: {
    grammar: "DJ" | "VJ" | "both";
    source: "stack" | "world" | "any";
  };
  target:
    | { scope: "deck"; id: "A" | "B" }
    | { scope: "program" }
    | { scope: "world"; deck: "A" | "B" }
    | { scope: "system" | "group" | "entity"; deck: "A" | "B"; id: string }
    | { scope: "surface"; id: string };
  operation:
    | { kind: "fixedMixer"; id: "eqLow" | "eqMid" | "eqHigh" | "opacity" | "crossfader" }
    | { kind: "transport"; id: "play" | "cue" | "jogSeek" | "rate" | "hotCue" }
    | { kind: "show"; eventType: "mode" | "scene" | "macro" | "param" | "oneshot" | "verb" }
    | { kind: "worldParam"; parameterId: string }
    | { kind: "worldInvoke"; verbId: string };
  transform?: {
    inputMin: number;
    inputMax: number;
    outputMinQ16: number;
    outputMaxQ16: number;
    curve: "linear" | "centered" | "signed";
    invert?: boolean;
  };
  quantize: "none" | "tick" | "beat" | "bar";
}
```

### limits

| item | v0 limit |
|---|---:|
| bindings | 最大`64`（contract） |
| UTF-8 ID | `1..32B`（contract） |
| output events per gesture | 常に`1`（frozen contract） |
| absolute/relative canonical rate | aggregate `8Hz`のshared replay cap（frozen contract） |
| operator-facing interpolation | `30–60Hz`（Instrument v1 contract） |

content hashは自身のhash fieldを除くcanonical JSONのSHA-256（contract）である。

## 3. target scope — 全体と個別を曖昧にしない

| scope | 適用範囲 | v0利用 |
|---|---|---|
| `deck` | AまたはBのsource出力 | 必須 |
| `program` | A/B合成後のmaster | fixed mixer以外はv0で禁止 |
| `world` | 指定deckのworld全体 | 必須 |
| `system` | particles/boids/lifecycle等の1 system | 必須 |
| `group` | manifestで名付けたentity集合 | 必須 |
| `entity` | stable entity IDの1体 | 契約のみ。FLX4既定mapでは使わない |
| `surface` | 1 logical output surface | 契約のみ。色・位置の独立操作はbacklog |

targetはgesture時に具体IDへ解決し、そのIDをEngineEvent payloadへ保存する。replay時に
「現在選択中」やmap hashから再解決しない（hard）。これにより選択状態の差で対象が変わらない。

`entity`指定は選択producerがstable IDを供給できる場合だけ有効である。未選択時にworld全体へ
暗黙fallbackすることを禁止する。

## 4. 固定ミキサーと可変mapの境界

次のFLX4 mappingはDJ/VJ、stack/worldを問わず固定し、profileで上書きしない（hard）。

| control | event target | 理由 |
|---|---|---|
| deck A/B EQ LOW/MID/HI | 各deckの空間周波数3帯 | 楽器固有operatorとzero-point契約を維持 |
| channel fader A/B | 各deck opacity | preview/program parity |
| crossfader | program A/B mix | DJ/VJ共通ミキサー契約 |

可変にできるのはpad、Shift pad、追加MIDI control、keyboard/UI gestureである。Tempo、PLAY、CUE、
JogはDJ grammarではparity transportに固定し、VJ grammarでだけsource-compatible mappingを許す。

この境界により「全部に効くか、選んだものだけに効くか」はtarget scopeで選べる一方、
mixingの基礎操作がdeckごとに変質しない。

## 5. map resolution

1. active controller profileがraw入力を`controlId + gesture + modifier`へ正規化する。
2. current `controlGrammar`、loaded source kind、control IDに完全一致するbindingを検索する。
3. 一致が`0件`ならno-opと診断表示、一致が`2件以上`ならmap validation errorとする。
4. target IDとsource capabilityを検証する。
5. transformとquantizeを適用し、具体payloadを持つEngineEventを`1件`dispatchする。

同一gestureからShowState変更とworld verbを同時発行しない。必要ならworld manifest側の
`worldInvoke` 1 eventがreducer内でatomicな複合挙動を実行する。

map切替はInstrument `deck` payloadへ次を追加する（hard）。

```ts
type SetPerformanceMapPayload = {
  action: "setPerformanceMap";
  mapHash: `sha256:${string}`;
  update: "absolute";
};
```

適用時に変化してよいのは`activePerformanceMapHash`だけで、RenderSnapshot bytesとpixelは
不変（contract）。active map hashはsemantic hashへ含めるがrendererへ渡さない。

## 6. 2 grammarとdefault profiles

### 6.1 DJ grammar

Instrument v1のplay/cue/jog/tempo/hotcueを変更しない。WorldSourceでもDJ gestureはdeckの
transportとmixerを操作する。worldがbounded timelineを持たない場合、manifestはDJ-compatibleを
宣言できず、そのworldはVJ grammarだけでload可能とする。

### 6.2 VJ grammar — classic stack

`fishvj-classic-v0`はInstrument v1 §5.3のpad mapをそのまま維持する。
mode/scene/DIVE/BLACKOUT/RESETを各`1 event`で操作する。

### 6.3 VJ grammar — world

`fishvj-world-v0`はpad `1..8`をWorldManifestが宣言する最大`8` verb slotへ順に対応させる
（contract）。slotがないpadはno-opで、別verbへ詰め替えない。pad velocityは使わず、
press `127`だけをtrigger、release `0`はeventなしとする（Instrument v1 contract）。

| VJ control | world既定意味 |
|---|---|
| PLAY | preview worldの次bar launch |
| PAUSE | program deckを次tickで停止 |
| CUE | preview worldをmanifest initial tickへ戻してpause |
| Jog | preview worldのbounded phaseがある場合だけrelative seek |
| Tempo | world time scale `0.5..2.0`（contract） |
| Pad 1–8 | manifest verb slot 1–8のatomic trigger |

WorldSource loadによりactive mapを切り替える場合も、load eventそのものとmap変更を2 eventsへ
分裂しない。`world/load` payloadがworld hashとperformance map hashを同時に運び、reducerが
両方を検証してatomicに選ぶ。replayは結果の
`activePerformanceMapHash`をhashし、map fileの有無に依存して入力を再解釈しない。

## 7. mode switch不変

`deck/setGrammar`は入力解釈だけをDJ↔VJへ切り替える。switch event適用tickでは
world、stack、ShowState、mix、playhead、entity、parameter、surfaceに一切触れない。

VJ modeに入った**後の別gesture**でpadを押せば、そのeventがworldまたはShowStateを変える。
「mode switchで絵が不変」と「VJ padで絵を変える」は時間的に別eventであり矛盾しない。

acceptance:

- switch前後のRenderSnapshot canonical bytesが完全一致（contract）。
- program/preview pixel diff `0`（contract）。
- semantic hashで変化してよいfieldは`controlGrammar`だけ（mapを同時変更しない）。
- switch後最初のpadがactive grammar/mapのeventを正確に`1件`作る。

## 8. validationとreplay

- controller profile、performance map、source manifestの3 hashをsession manifestへ保存する。
- replayはrecorded semantic eventを直接投入し、raw MIDIやperformance mapを再実行しない。
- continuous world paramはbase/world aggregate `8Hz` shared capへ入れる。
- relative値はflush window内で符号付き合算し、last-write-winsしない。
- sparse invokeはsource tick、concrete target、verb IDをJSON trackへ保存する。
- unresolved/unsupported bindingは演奏開始前にrejectし、途中で別scopeへfallbackしない。

## 9. Escalation

- **E-P01 — fixed mixerを可変化したい**: 空間周波数EQ zero-point、A/B合成、replay laneの
  3受入を再定義する別versionを起票する。profileだけで上書きしない。
- **E-P02 — 1 gestureで複数操作が必要**: reducerが理解する1 atomic payloadへ昇格する。
  producerから複数eventを出さない。
- **E-P03 — entity selectionが必要**: stable IDの選択producer、解除、死亡時挙動、replay fixtureが
  揃うまでFLX4 mapへ入れない。
- **E-P04 — 8Hzでfader感が不足**: [WORLD_SOURCE_V0 E-W04](./WORLD_SOURCE_V0.md#7-escalation)を
  発火し、liveだけrateを上げない。
