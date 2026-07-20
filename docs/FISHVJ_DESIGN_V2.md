# FishVJ 技術設計書 v2

> 対象: `buildinpublicjp-debug/fishvj`
>
> 基準コミット: `2275308460f48d4031fa550fafc80e7b2611f900`
>
> 作成日: 2026-07-20
>
> status: proposed / implementation not started
>
> 適用範囲: EngineEvent、EngineState、決定論リプレイ、deck v0、S1〜S3、CV v0、検証ゲート

本書はFishVJの実装仕様とスプリント計画の単一の正である。戦略、市場、GYOGEN世界観は扱わない。規定の強さは次の3段階とする。

- **hard**: 実装互換性に関わる規約。変更には実測結果とレビュー票を要する。
- **soft**: best-effort機構。安全準拠や完全一致を表明しない。
- **internal**: v0では外部契約にしない実装詳細。schemaに予約名だけを置く。

## Change log — X-01〜X-10対応表

| X | v2での改稿箇所 | 変更内容 |
|---|---|---|
| X-01 | §3、§11 S1 | React stateへのdispatch追加ではなく、pure reducer + EngineStoreへのSSOT移行として再設計。視覚state 13件、更新サイト34件、RAF可変binding 15件、renderer-facing書換29件を全数分類した。 |
| X-02 | §2、§5、§9、§11 T0/S2 | seeded PRNG、固定tick、フレーム非依存平滑をT0へ配置。ハッシュ対象をEngineState、transition、BeatState、全uniform入力・派生値、BLACKOUTまで完全列挙した。 |
| X-03 | §4 | EngineEventをdiscriminated union化。全payload、param ID、値域、absolute/atomic/trigger、`t`/`sourceT`、replay時刻規約を確定した。 |
| X-04 | §6 | control JSON + space/audio binary trackとして再設計。総量を58,280B/分 (measured arithmetic + contract caps)に再計算した。 |
| X-05 | §7 | deck v0の外部化を`species[].scale`と`species[].motion`だけに限定。atlas配置、8匹固定、4泳動族、mode、macroを`internal`へ移した。 |
| X-06 | §10、§11 S3 | `VideoTexture → final post target → history ring → warp/color/absdiff → 256–512px集約`へ固定。フレーム時刻、遅延実測、DOM overlay停止手順を追加した。 |
| X-07 | §11、§14 | S1≤20h / S2≤15h / S3≤24hへ再積算。上限超過時の仮置き削減を各Sprintへ埋め込んだ。 |
| X-08 | §12 | 削除対象を`drizzle/`と`examples/d1/`だけに限定。`worker/`をactive main entryとして保護した。 |
| X-09 | §9、§13 | T0後golden、固定seed/tick、state hash、SSIM閾値、lint/typecheck/build/SSR testを機械判定ゲートとして定義した。 |
| X-10 | §8、§14 | `flashLimit`をsoft metadataへ降格。S2 best-effort slew limiterと、別milestoneのWCAG 2.2 hard検査を分離した。 |

## 1. 現行実装の測定基準

### 1.1 コード規模

| 対象 | 実測 |
|---|---:|
| `app/components/FishCanvas.tsx` | 1,028 LOC (measured) |
| `app/components/FishVJConsole.tsx` | 650 LOC (measured) |
| `tests/rendered-html.test.mjs` | 37 LOC (measured) |
| 上記合計 | 1,715 LOC (measured) |

### 1.2 状態と書換点

`FishVJConsole.tsx:110–122`にある視覚stateは次の13件 (measured)。

1. `scene`
2. `mode`
3. `colorPreset`
4. `colorDrive`
5. `fishCount`
6. `fishSize`
7. `speed`
8. `depth`
9. `dive`
10. `blackout`
11. `selectedSpecies`
12. `swimType`
13. `swarm`

上記の直接setter callは29件 (measured)、`RangeControl`へsetterを渡す更新点は5件 (measured)、合計更新サイトは34件 (measured)。

`FishCanvas.tsx:739–1025`のeffect内にある可変bindingは15件 (measured)。

| 分類 | binding | v2での扱い |
|---|---|---|
| semantic transition | `currentDive`、`observedSwarm`、`swarmFrom`、`swarmTo`、`swarmTransitionStart`、`currentScene` | S1でEngine frame stateへ移す |
| audio transition | `smoothKick`、`smoothBass`、`smoothHigh` | S2 T0-BでBeat frame stateへ移す |
| renderer runtime | `width`、`height`、`lastFrame`、`fpsAccumulator`、`fpsFrames`、`animationId` | rendererローカルに残す。意味状態ではない |

毎フレームのrenderer-facing書換は、uniform 27件 (measured)、`instanceCount` 1件 (measured)、`toneMappingExposure` 1件 (measured)、合計29件 (measured)。v2ではこれらを状態として持たず、1個の`RenderSnapshot`からrenderer adapterが書き込む。

### 1.3 現行検証結果

同一checkout、warm dependency cacheでの結果:

| Command | 結果 | 時間 |
|---|---|---:|
| `npm run lint` | fail: render中の`performance.now()` 1件 | 2.35s (measured) |
| `npx tsc --noEmit --incremental false` | fail: 4件 | 2.07s (measured) |
| `npm run build` | pass: client 59 modules、production build完了 | 2.57s (measured) |
| `node --test tests/rendered-html.test.mjs` | pass: 1 test | 0.25s (measured) |

typecheckの4件 (measured)は次のとおり。

1. `FishCanvas.tsx:879`: `tDiffuse.value`が`null`へ狭く推論される。
2. `db/index.ts:1`: `cloudflare:workers`の型宣言がない。
3. `worker/index.ts:6`: `Fetcher`の型宣言がない。
4. `worker/index.ts:7`: `D1Database`の型宣言がない。

## 2. T0 — 決定論の前提

T0は独立機能ではなく、S1とS2の先頭に置く前提作業である。

### 2.1 T0-A — S1の先頭

1. `FishCanvas.tsx:808–816`の`Math.random()` 5箇所 (measured)を32-bit seeded PRNGへ置換する。
2. replay manifestへ`seed`を保存する。
3. simulation clockを60Hz固定tickへ分離する。
4. 通常描画ではwall clockをaccumulatorへの入力にだけ使い、EngineStateは整数tickで進める。
5. deterministic modeではwall clockを読まず、test harnessがtickを明示的に進める。
6. React render中の`performance.now()`を廃止する。
7. T0-A適用後の現行レンダーをgolden baselineとして採取する。

PRNGは`mulberry32`相当の固定32-bit演算とし、seedの初期値を`0x46495348`とする。PRNGの呼出順は現行5箇所の順を保つ。seedと呼出順の変更はvisual contract変更として扱う。

固定tick:

```ts
const SIM_HZ = 60;
const TICK_MS = 1000 / SIM_HZ;
```

通常モードで描画が遅れた場合、一描画で進めるcatch-upは最大5 tickとする。それ以上の遅れはtickを捨てず、renderを間引く。決定論はdisplay frame数ではなくsimulation tick列に対して定義する。

### 2.2 T0-B — S2の先頭

1. `smoothKick`、`smoothBass`、`smoothHigh`をRAF回数依存から固定tick依存へ変更する。
2. audio band sampleを15Hzへ量子化し、4 tickごとにBeatStateへ投入する。
3. kick/highから輝度系uniformへ渡す値へsoft slew limiterを追加する。
4. replay時も同じtick関数を通す。

平滑式:

```ts
function smoothExp(current: number, target: number, dtSec: number, tauSec: number) {
  const alpha = 1 - Math.exp(-dtSec / tauSec);
  return current + (target - current) * alpha;
}
```

現行60fps時の係数から導く初期時定数は、kick約0.075s、bass約0.111s、high約0.093s (measured derivation)。見た目調整で変更する場合はgoldenを更新せず、別のvisual change ticketを要求する。

## 3. SSOTアーキテクチャ — hard

### 3.1 ファイル境界

```text
app/
  engine/
    types.ts             # EngineEvent、payload、EngineState
    validate.ts          # runtime range validation
    reducer.ts           # pure reduceEvent
    frame.ts             # pure advanceTick / RenderSnapshot導出
    store.ts             # state、dispatch、subscribe、getSnapshot
    clock.ts             # normal/deterministic clock
    prng.ts              # seeded PRNG
    hash.ts              # canonical state hash
    deck.ts              # deck v0 loader/validator
    replay/
      record.ts
      playback.ts
      binary.ts
```

`reducer.ts`がイベントによる唯一の状態変更点になる。`frame.ts`がtickによるtransition進行の唯一の変更点になる。React component、keyboard handler、MIDI adapter、replay producer、rendererは直接状態を書き換えない。

### 3.2 EngineStore

```ts
interface EngineStore {
  dispatch(input: EngineEventInput): EngineEvent;
  advanceTick(): RenderSnapshot;
  getState(): Readonly<EngineState>;
  getRenderSnapshot(): Readonly<RenderSnapshot>;
  subscribe(listener: () => void): () => void;
}
```

処理順:

1. producerが`EngineEventInput`を1件渡す。
2. busがpayloadをvalidateする。
3. busが現在のwall-clockを`t`へ刻み、`seq`を増やす。
4. reducerがeventを1回だけ適用する。
5. recorderが確定eventを観測する。
6. UI subscriberへ通知する。
7. simulation tickごとに`advanceTick()`がtransitionとBeatStateを進める。
8. rendererは`RenderSnapshot`を1回取得し、全uniformへ適用する。

### 3.3 React側の置換

- 13視覚stateはすべて削除し、`useSyncExternalStore(engine.subscribe, engine.getState)`で読む。
- 34更新サイトは、setterではなく1件のtyped eventをdispatchする。
- `reset`は13 setterを順に呼ばず、`oneshot/reset` 1件をreducerが原子的に適用する。
- 魚カードは`selectedSpecies`と`swimType`を同じ`fishSelection` payloadで更新する。
- `fps`、`audioStatus`、`micDevices`、`isFullscreen`はEngineStateへ入れない。これらは演奏内容ではないUI/runtime状態である。
- `audioLevels`と`bpm`はS2 T0-BでBeatStateへ移す。

### 3.4 FishCanvas側の置換

`configRef`と`audioRef`を意味状態の入力として使わない。RAFは次だけを行う。

```ts
function renderFrame(now: DOMHighResTimeStamp) {
  engineClock.accumulate(now);
  while (engineClock.hasTick()) engine.advanceTick();

  const snapshot = engine.getRenderSnapshot();
  rendererAdapter.apply(snapshot);
  rendererAdapter.render();
  animationId = requestAnimationFrame(renderFrame);
}
```

15可変binding (measured)のうち、semantic/audio 9件はEngine frame stateへ移す。renderer runtime 6件はローカルに残すが、state hash、recording、reducerから参照してはならない。

27 uniform書換 (measured)と`instanceCount`・`toneMappingExposure`はrenderer adapterへ集約する。uniform自体をSSOTにはしない。

## 4. EngineEvent v1 — hard

### 4.1 時刻と封筒

```ts
type ProducerId =
  | "keys"
  | "ui"
  | "midi"
  | "audio"
  | "replay"
  | "cv"
  | "sim"
  | "djlink"
  | "bot";

interface EventEnvelope {
  t: number;          // ms。bus到着時の現在時刻。busだけが設定
  sourceT: number;    // ms。producerでの発生時刻。recordingが保存
  seq: number;        // live session内のbus適用順
  producerId: ProducerId;
  v: 1;
}
```

- live producerは`sourceT`を渡す。省略時はbusが`t`と同じ値を入れる。
- `t`は常にbus投入時の現在値であり、replayでも録画時の値を再利用しない。
- recorderは`sourceT`差分と元のevent順を保存する。wall-clockの`t`はcanonical recordingへ保存しない。
- replayは`recorded.sourceT - firstSourceT`をtickへ変換してscheduleし、bus投入時に新しい`t`と`seq`を得る。
- 同じsource tickのeventはrecording内の元順序で投入する。
- state hashはrelative source tickまたはsimulation tickを使い、`t`を含めない。

### 4.2 Discriminated union

```ts
type EngineEvent = EventEnvelope & EngineEventBody;

type EngineEventBody =
  | { type: "mode"; payload: ModePayload }
  | { type: "scene"; payload: ScenePayload }
  | { type: "macro"; payload: MacroPayload }
  | { type: "param"; payload: ParamPayload }
  | { type: "oneshot"; payload: OneShotPayload }
  | { type: "verb"; payload: VerbPayload }
  | { type: "beat"; payload: BeatPayload }
  | { type: "space"; payload: SpacePayload };

type EngineEventInput = EngineEventBody & {
  producerId: ProducerId;
  sourceT?: number;
  v: 1;
};
```

producerは`EngineEventInput`だけを作り、`t`と`seq`を指定できない。未登録`producerId`、未知のtype、値域外payloadはreducer到達前にrejectする。S1で有効化するproducerは`keys`と`ui`、S2は`audio`と`replay`、S3は`cv`を追加する。その他は型だけ予約する。

### 4.3 Payload定義

```ts
type ModeName = "MYSTIC" | "SENSUAL" | "EUPHORIC";
type SceneMode = "MANDALA" | "FREE_SWIM";
type ColorPreset = "CLEAN" | "PUNCH" | "ACID" | "DEEP";
type SwimType = "SCHOOL" | "GLIDE" | "WAVE" | "FLOAT";
type SwarmType = "SPIRAL" | "VORTEX" | "WAVE" | "BLOOM";

type ModePayload = {
  update: "absolute";
  value: ModeName;
};

type ScenePayload = {
  update: "absolute";
  value: SceneMode;
};

type MacroPayload = {
  update: "absolute";
  value: ColorPreset;
};

type ParamPayload =
  | { id: "colorDrive"; update: "absolute"; value: number }
  | { id: "fishCount"; update: "absolute"; value: number }
  | { id: "fishSize"; update: "absolute"; value: number }
  | { id: "speed"; update: "absolute"; value: number }
  | { id: "depth"; update: "absolute"; value: number }
  | { id: "dive"; update: "absolute"; value: boolean }
  | { id: "blackout"; update: "absolute"; value: boolean }
  | { id: "swimType"; update: "absolute"; value: SwimType }
  | { id: "swarm"; update: "absolute"; value: SwarmType }
  | {
      id: "fishSelection";
      update: "atomic";
      selectedSpecies: number;
      swimType: SwimType;
    };

type OneShotPayload = {
  id: "reset";
  update: "trigger";
};

type VerbPayload = {
  id: string;
  update: "start" | "stop" | "trigger";
  strengthQ8?: number;
};

type BeatPayload =
  | {
      kind: "clock";
      bpm: number;
      phase: number;
      confidence: number;
      flux: number;
      energy: number;
    }
  | {
      kind: "bands";
      bands: [number, number, number, number]; // kick,bass,mid,high
    };

type SpacePayload = {
  grid: Uint8Array; // length=64、row-major 8×8
  energy: number;   // u8
  silRatio: number; // u8
};
```

### 4.4 Param値域

| ID | 更新 | 値域 | UI step |
|---|---|---|---|
| `colorDrive` | absolute | 0.0–1.0 | 0.01 |
| `fishCount` | absolute | integer 100–2,000 | 50 |
| `fishSize` | absolute | 0.5–3.0 | 0.05 |
| `speed` | absolute | 0.2–1.6 | 0.01 |
| `depth` | absolute | 0.15–1.0 | 0.01 |
| `dive` | absolute | boolean | — |
| `blackout` | absolute | boolean | — |
| `swimType` | absolute | 4 enum values | — |
| `swarm` | absolute | 4 enum values | — |
| `fishSelection` | atomic | `selectedSpecies` integer 0–7 + `swimType` | — |

`toggle` payloadは定義しない。現在値を反転するキーやボタンも、producerが現在のsnapshotを読み、反転後のbooleanをabsolute eventとして送る。これによりevent単体の意味が初期状態へ依存しない。

`reset`だけはtriggerであり、reducerが既定EngineStateへ原子的に戻す。fullscreenは記録対象外のUI操作であり、EngineEventへ入れない。

### 4.5 Beat/Space値域

| Field | 値域 |
|---|---|
| `bpm` | 20.0–300.0 |
| `phase` | 0.0以上1.0未満 |
| `confidence` | 0.0–1.0 |
| `flux` | 0.0–1.0 |
| `energy` | 0.0–1.0 |
| `bands[*]` | runtime 0.0–1.0、record時u8へ量子化 |
| `space.grid[*]` | u8 0–255 |
| `space.energy` | u8 0–255 |
| `space.silRatio` | u8 0–255 |

### 4.6 Gestureとrate

1 gestureは1 eventだけを生成する。gestureの定義は次のとおり。

- button、keyboard、pad: 1 activation。
- 魚カード: 1 activationで`fishSelection` 1 event。
- pointer drag、MIDI knob: producer adapterが8Hz以下へ量子化した1 sample。
- RESET: 1 trigger event。

producerが1 gestureから複数eventを派生させることは禁止する。複数stateの同時変更はatomic payloadまたはreducer内の規定動作で表現する。

| Type | runtime上限 | recording |
|---|---:|---:|
| mode/scene/macro/oneshot/verb | 平均1/s、burst 8/s | JSON、同率 |
| param | aggregate 8/s | JSON、同率 |
| beat clock | steady 1Hz、change burst 4/s | 全eventをJSON |
| beat bands | 15Hz | 15Hz binary |
| space fast mask | CV subsystem内30Hz | 記録しない |
| space semantic event | 5Hz | 全eventを5Hz binary |

上限超過時にrecording側だけeventを黙って捨ててはならない。producer adapterでcanonical event生成前にcoalesceする。総量上限をなお超えた場合、recorderはそのsessionを`invalid: budget_exceeded`として停止し、不完全なreplayを成功扱いしない。

beat phaseはclock anchor間をBPMとsource tickから導出する。spaceの30Hz residual maskは速い層でありEngineStateへ入れず、8×8へ集約した5Hz sampleだけを`space` EngineEventとしてbusへ送る。したがってliveのcanonical event列とrecording列は一致し、recording側だけのdownsampleを行わない。

## 5. 意味的決定論と状態ハッシュ — hard

### 5.1 定義

意味的決定論とは、同じdeck hash、seed、初期EngineState、relative source tick列、control event列、audio/space binary sample列を与えたとき、各simulation tickのcanonical semantic stateとRenderSnapshot hashが完全一致することである。

pixel一致はcross-device契約にしない。同一browser、同一GPU、同一viewportでのSSIMはS1 regression gateとして別に使う。

### 5.2 Hash入力の完全リスト

#### Session/clock

- schema version
- deck ID、deck content hash、atlas content hash
- seed
- simulation tick
- relative source tick
- viewport width、height、aspect
- calibration/CV clean-output flag

#### Show/visual state

- `scene`
- `mode`
- `colorPreset`
- `colorDrive`
- `fishCount`
- `fishSize`
- `speed`
- `depth`
- `dive`
- `BLACKOUT`
- `selectedSpecies`
- `swimType`
- `swarm`
- active verb ID、verb phase、strength

#### Transition state

- `sceneMix`
- `currentDive`
- `observedSwarm`
- `swarmFrom`
- `swarmTo`
- `swarmMix`
- `swarmTransitionStartTick`
- one-shot remaining ticks

#### Beat/audio state

- `bpm`
- `beatPhase`
- `confidence`
- `flux`
- `energy`
- raw `kick`、`bass`、`mid`、`high`
- `smoothKick`
- `smoothBass`
- `smoothHigh`
- limited `kickLuma`
- limited `highLuma`

#### Space semantic state

- `space.grid[64]`
- `space.energy`
- `space.silRatio`
- 最後に適用したspace source tick

#### Rendererへ入る値

- `uTime`を生成するtick
- `uAspect`
- `uSegments`
- `uKick`
- `uBass`
- `uHigh`
- `uDive`
- `uMode`
- `uDrive`
- `uColorPreset`
- `uSceneMix`
- `uSpeed`
- `uFishSize`
- `uDepth`
- `uSelectedSpecies`
- `uSwimFocus`
- `uSwarmFrom`
- `uSwarmTo`
- `uSwarmMix`
- `uMandalaPopulation`
- `uResolution`
- `instanceCount`
- `toneMappingExposure`
- derived `mandalaCount`
- derived `freeSwimCount`

`uAtlas`はGPU objectをhashせず、deck IDとatlas content hashで置き換える。`tDiffuse`、Three.js scene/material/texture object、WebGL object ID、RAF ID、FPS meterはhash対象外とする。

### 5.3 Canonical encoding

- enumは固定tableのu8 index。
- booleanはu8 0/1。
- normalized floatは`round(value * 65535)`。
- その他のfloatはfieldごとに定義したscaleでinteger化する。
- tickとcountはunsigned integer。
- object key順へ依存せず、上記リストの固定順にbyte列へ書く。
- hashは64-bit FNV-1a。
- 30 simulation tickごとにhashを出す。60Hz時は0.5秒間隔となる。

hash traceは`[{tick, hash}]`であり、録画と再生で全entry一致を要求する。wall-clockの`t`、live sessionの新しい`seq`は比較しない。

## 6. Replay format v1 — hard

### 6.1 コンテナ

```text
session.fishvj-replay/
  manifest.json
  control.json
  audio.bin
  space.bin
```

配布時は上記を1 archiveへまとめられるが、容量計算は圧縮を前提にしない。

### 6.2 manifest

```jsonc
{
  "v": 1,
  "engine": "fishvj-ref-v1",
  "deckId": "gyogen-v0",
  "deckHash": "sha256:...",
  "atlasHash": "sha256:...",
  "seed": 1179210568,
  "simHz": 60,
  "audioHz": 15,
  "spaceHz": 5,
  "firstSourceT": 0,
  "durationTicks": 3600,
  "producers": ["keys", "ui", "midi", "audio", "replay", "cv", "sim", "djlink", "bot"],
  "types": ["mode", "scene", "macro", "param", "oneshot", "verb", "beat"],
  "params": [
    "colorDrive", "fishCount", "fishSize", "speed", "depth",
    "dive", "blackout", "swimType", "swarm", "fishSelection"
  ]
}
```

`control.json`は長いfield名を各eventへ繰り返さず、manifestのdictionary indexを使うtuple列とする。

```ts
type RecordedControlTuple = [
  deltaSourceTick: number,
  deltaOriginalSeq: number,
  producerIndex: number,
  typeIndex: number,
  payloadCode: number,
  ...quantizedValues: number[],
];
```

JSONであること、event順を復元できること、source tickを復元できることを契約とする。runtimeのwall-clock `t`は保存しない。

### 6.3 Binary chunk

space sample:

```text
grid[64] + energy[1] + silRatio[1] = 66B/sample (measured layout)
```

audio sample:

```text
kick[1] + bass[1] + mid[1] + high[1] = 4B/sample (measured layout)
```

1秒chunkのheaderは24B固定 (measured layout)。

| Field | Bytes |
|---|---:|
| track ID | 1B |
| version | 1B |
| sample count | 2B |
| chunk start sourceT | 8B |
| interval microseconds | 4B |
| payload bytes | 4B |
| CRC32 | 4B |
| total | 24B (measured layout) |

sample間隔はtrackごとに固定であるため、sampleごとのtimestampは持たない。欠損chunkはCRC/sequence errorとしてreplayを失敗させる。

### 6.4 1分あたりの総量

control JSONの28,000B/分 (contract)は次の内訳でwriterが強制する。

| Control allocation | 上限 |
|---|---:|
| param tuple: aggregate 8Hz、1 tuple≤36B | 17,280B/分 (contract) |
| sparse + beat clock: aggregate平均2Hz、1 tuple≤48B | 5,760B/分 (contract) |
| JSON delimiter/index/reserve | 4,960B/分 (contract) |
| control total | 28,000B/分 (contract) |

string IDはmanifest dictionary indexへ置換し、数値はcanonical integerへ量子化する。tupleがfield上限を超えた場合はwriter errorとし、可変長文字列をcontrol trackへ直接書かない。

| Track | 算式 | 1分 |
|---|---|---:|
| space payload | 66B × 5Hz × 60s | 19,800B (measured arithmetic) |
| audio payload | 4B × 15Hz × 60s | 3,600B (measured arithmetic) |
| chunk headers | 24B × 60 chunks × 2 tracks | 2,880B (measured arithmetic) |
| binary subtotal | 上記合計 | 26,280B (measured arithmetic) |
| control JSON cap | recorder hard cap | 28,000B (contract) |
| manifest/dictionaries cap | hard cap | 2,000B (contract) |
| archive/container reserve | 非圧縮想定 | 2,000B (estimated) |
| total maximum | 合計 | 58,280B/分 (calculated) |
| 60,000Bとの差 | — | 1,720B/分 (calculated margin) |

契約は`≤60,000B/分`であり、KiBへ読み替えない。計測単位は完成archiveのbyte lengthとする。

## 7. deck.schema v0 — hard structure / internal behavior / soft safety

### 7.1 v0外部化の境界

v0でrendererがJSONから読む挙動値は次の2つだけ。

1. `species[index].scale`
2. `species[index].motion`

atlas URL/layout、species count、atlas cell順、4泳動族の内部数式、mode、macro、scene/swarm数式は外部化しない。

```jsonc
{
  "v": 0,
  "id": "gyogen-v0",
  "name": "魚曼荼羅",
  "species": [
    { "index": 0, "scale": 0.72, "motion": "SCHOOL" },
    { "index": 1, "scale": 1.10, "motion": "GLIDE" },
    { "index": 2, "scale": 0.92, "motion": "FLOAT" },
    { "index": 3, "scale": 1.14, "motion": "GLIDE" },
    { "index": 4, "scale": 0.82, "motion": "FLOAT" },
    { "index": 5, "scale": 1.20, "motion": "WAVE" },
    { "index": 6, "scale": 0.90, "motion": "FLOAT" },
    { "index": 7, "scale": 0.80, "motion": "SCHOOL" }
  ],
  "flashLimit": {
    "level": "soft",
    "maxFlashHz": 3
  },
  "internal": {
    "atlas": { "status": "internal-v0", "layout": "4x2" },
    "speciesCount": { "status": "internal-v0", "value": 8 },
    "motionFamilies": { "status": "internal-v0", "value": 4 },
    "modes": { "status": "internal-v0" },
    "macros": { "status": "internal-v0" },
    "scenes": { "status": "internal-v0" },
    "swarms": { "status": "internal-v0" }
  },
  "verbs": []
}
```

`species`は長さ8固定、`index`は0から7の昇順固定とする。並べ替え、追加、削除はv0 validation error。atlasの4×2除算は`FishCanvas.tsx:547–555`、UIの400%×200%は`globals.css:192–198`に残る。

### 7.2 「見た目完全不変」の範囲

見た目不変を要求するのは、`speciesScales`と`speciesMotions`の配列literalをdeck v0へ移し、同じ8値を同じindexへ読み戻す変更だけである。

次はv0の不変主張に含めない。

- atlas layout可変化
- species数可変化
- per-species `speed/tailAmp/bobAmp`
- 4泳動族shader定数の外部化
- mode 6/8/12分割、mode speed、mode color処理
- macroのfish/post/CPU exposure統合
- scene/swarm数式の外部化

## 8. Flash safety — soft v0 / separate hard milestone

### 8.1 deck v0

`flashLimit.level = "soft"`はmetadataであり、準拠証明でも強制機構でもない。loaderは値域を検証し、session metadataとUIへ表示できるが、deckの受入を安全認証として扱わない。

### 8.2 S2 best-effort limiter

T0-Bの固定tick平滑後、`uKick`と`uHigh`へ渡す輝度ドライバを次で制限する。

| Driver | rise上限 | fall上限 | clamp |
|---|---:|---:|---:|
| `kickLuma` | 4.0/s | 4.0/s | 0.0–1.0 |
| `highLuma` | 2.0/s | 2.0/s | 0.0–1.0 |

```ts
function slew(current: number, target: number, maxPerSec: number, dtSec: number) {
  const d = maxPerSec * dtSec;
  return Math.max(current - d, Math.min(current + d, target));
}
```

このlimiterは急峻な輝度変化を減らすbest-effort処理であり、flash frequency、発光面積、一般閃光閾値、赤色閃光閾値を測定しない。WCAG 2.2準拠を表明してはならない。

### 8.3 FLASH_HARD_M1

S1〜S3と分離した独立milestoneとして、次をすべて満たすときだけ`level:"hard"`を許す。

1. final post outputから時間連続の輝度frameを取得する。
2. 一般閃光閾値と赤色閃光閾値を実装する。
3. viewportに対する発光面積を評価する。
4. 音源、mode、macro、DIVE、BLACKOUT遷移を含む自動fixtureを実行する。
5. violation時にdeck loadまたは演奏開始をblockする。
6. output analyzer自体のgolden testを持つ。

規範参照: [WCAG 2.2 Success Criterion 2.3.1](https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold)。

## 9. Golden、SSIM、CI — hard acceptance

### 9.1 Golden作成順

1. 基準コミットへT0-Aだけを適用する。
2. seedを`0x46495348`、simulationを60Hz、viewportを1920×1080、DPRを1へ固定する。
3. S1 goldenではdemo/mic/file audioを停止し、4 bandsを0へ固定する。audio reactive goldenはT0-B後のS2で追加する。
4. atlas load完了を待ち、tick 0を定義する。
5. manifestに記述したevent sequenceをsource tickで投入する。
6. 各制御軸のgolden frame群とstate hash traceを保存する。
7. そのgoldenを固定した後にSSOT移行とdeck v0抽出を行う。
8. S1後に同じsequenceで再採取し、自動比較する。

T0-A前は`Math.random()`により同じcommitでも配置が変わるため、T0-A前後のpixel比較を合格条件にしない。T0-Aが新しい再現可能baselineを作る。

artifact配置:

```text
tests/visual/
  scenarios.v1.json
  golden/<scenario>-tick-<n>.png
  expected-hashes.json
  compare.mjs
```

local machine gateは`npm run test:visual`で実行し、失敗時は`artifacts/visual-diff/`へ比較画像を出す。

### 9.2 Golden scenario

最低限、次をmanifest化する。

- initial state
- mode 3種
- scene 2種
- macro 4種
- swarm/style 4種
- fish species 8種
- fishCount min/default/max
- fishSize min/default/max
- speed min/default/max
- depth min/default/max
- DIVE enter/exit
- BLACKOUT on/off
- RESET
- scene/swarm transitionの開始、中間、終了tick

captureはevent直後だけでなくtransition中間tickを含める。golden file名にtickを入れる。

### 9.3 機械判定

1. 30 tickごとのsemantic state hashが全件完全一致。
2. 同一browser/GPUで全golden frameの平均SSIMが0.995以上。
3. 個別frameのSSIMが0.990未満にならない。
4. threshold未達時はdiff imageをartifactへ出す。
5. golden更新はS1の「修正」ではなく、visual change ticketを要する。

完全自動のcross-machine SSIMはbacklogとする。S1では固定した同一Mac/Chromium/GPUで機械実行する。

### 9.4 CI gate

S1 merge条件:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
node --test tests/rendered-html.test.mjs
```

4 commandすべてexit 0を要求する。

現行failの解消:

- `FishVJConsole.tsx:134`: render中の`performance.now()`を削除し、EngineClock初期化時へ移す。
- `FishCanvas.tsx:879`: `tDiffuse`を`THREE.Texture | null`として明示する。
- `db/index.ts`、`worker/index.ts`: `@cloudflare/workers-types`をdev dependencyへ追加し、rootの`cloudflare-env.d.ts`から型を読む。
- `cloudflare-env.d.ts`: `Cloudflare.Env`へ`DB`、`ASSETS`、`IMAGES` bindingをmodule augmentationする。`DB`がない環境を許す場合は`DB?: D1Database`とし、現行`getDb()`のruntime guardを維持する。

SSR testは現行1件 (measured)を維持し、少なくともroot HTML契約が退行していないことを確認する。WebGL regressionはgolden harnessが担当する。

## 10. S3 — SpaceState CV v0

### 10.1 固定経路

```text
getUserMedia video
  → HTMLVideoElement
  → THREE.VideoTexture
  → camera texture
                         ┌→ screen
Fish scene → raw target → final post target
                         └→ 256–512px downsample history ring

camera texture + matching history frame
  → homography warp
  → global RGB gain/bias correction
  → absdiff
  → threshold + 3×3 cleanup
  → 256–512px residual mask
  → 8×8 density grid + energy + silhouette ratio
```

Canvas2Dの1080p `getImageData`経路は実装しない。camera upload以降はGPU内で処理し、CPUへ読むのは8×8 gridとscalarだけとする。

### 10.2 Final post targetと履歴

現行はpost shaderをscreenへ直接描く。S3では:

1. post shaderを`finalPostTarget`へ描く。
2. `finalPostTarget`をscreenへblitする。
3. 同じ結果をRGBA8の低解像度history targetへdownsampleする。
4. camera遅延に対応するhistory slotをabsdiffへ渡す。

初期ringは512×288 RGBA8、12 framesとする。

- 1 frame: 589,824B (measured arithmetic)
- 12 frames: 7,077,888B = 6.75MiB (measured arithmetic)

このringは最終post結果の低解像度履歴であり、1080p HalfFloat targetを12枚保持しない。

### 10.3 Frame timestamp

camera側は`HTMLVideoElement.requestVideoFrameCallback()`で新規frameを検出する。利用する情報:

- callback `now`
- `presentationTime`
- `expectedDisplayTime`
- `mediaTime`
- `presentedFrames`
- 利用可能なUAでは`captureTime`

frame callbackごとに同じcamera frameを二重処理しない。API規範は[`requestVideoFrameCallback` draft](https://wicg.github.io/video-rvfc/)を参照する。

### 10.4 4点校正

1. `calibrationMode=true`へする。
2. scanlines、output badges、DIVE badge、DOM BLACKOUTを非表示にする。
3. EngineStateのBLACKOUTをfalseへ固定する。
4. WebGL final post上に四隅markerとframe IDを描く。
5. camera previewで左上、右上、右下、左下の順に4点をクリックする。
6. 4対応点からprojector UV→camera UVのhomographyを解く。
7. grayscale/color swatchからglobal RGB gain/biasを求める。
8. calibration結果をdevice profileとして保存する。

CV運転中もscanlines/badgeを投影面へ重ねない。`canvas = projected pixels`を維持する。BLACKOUT中はSpaceState生成を停止し、純VJ fallback状態へ戻す。

### 10.5 遅延実測

想定camera遅延は30fpsで2–5 frames、67–167ms (estimated)にprojector/display遅延が加わる。これは受入値ではなくring初期設計値である。

実測:

1. final postへsimulation tickを符号化した小さなbinary frame IDを描く。
2. camera frameからIDをdecodeする。
3. `requestVideoFrameCallback`時刻と、decodeしたoutput tickを記録する。
4. 10秒以上測定し、median、p95、frame jitterを出す。
5. median lagに最も近いhistory slotを選ぶ。
6. lagが12 frame ringを超える場合はCVを開始せず、escalation E-03へ進む。

### 10.6 S3 minimum acceptance

対象機はL1で使うMac、projector、cameraとする。

1. camera trackが30fpsで取得できる。
2. CV passは512px width、p95 33ms以下。超過時は256pxへ固定する。
3. 無遮蔽物、60秒のno-person testでresidual occupancy平均3%以下、p95 8%以下。
4. 既知矩形occluder testでmask IoU 0.60以上。
5. measured lagのp95がring内に収まる。
6. camera/CV停止時にrendererと操作系が無傷で継続する。
7. BLACKOUT中にSpaceState eventを生成しない。

## 11. Sprint計画

工数は§1の1,678 LOC (measured)のTSX変更面、34更新サイト (measured)、15 RAF binding (measured)、29 renderer-facing書換 (measured)、現行CI結果から積算した。LOCは実装前の差分予測でありestimatedとする。

### 11.1 S1 — SSOT + deck v0

上限: 20h。

| Task | 内容 | 工数 | 差分 |
|---|---|---:|---:|
| T0-A | seeded PRNG、60Hz clock、render中wall-clock除去、golden基盤 | 3.0h (estimated) | 90–140 LOC (estimated) |
| Event core | types、validation、bus、store、pure reducer | 4.0h (estimated) | 180–260 LOC (estimated) |
| Console migration | 13 state、34更新サイト、atomic fish/reset | 3.5h (estimated) | 100–170 LOC (estimated) |
| Canvas migration | semantic transition、RenderSnapshot、29 write adapter | 4.0h (estimated) | 140–220 LOC (estimated) |
| deck v0 | scale/motionだけ外部化、validator、content hash | 2.0h (estimated) | 60–100 LOC (estimated) |
| QA/CI/cleanup | golden比較、lint/typecheck/build/test、`drizzle/`と`examples/d1/`掃除 | 3.5h (estimated) | 80–140 LOC (estimated) |
| total | — | 20.0h (estimated) | 650–1,030 LOC (estimated) |

S1 acceptance:

- 13視覚stateがReact local stateに残っていない。
- 34更新サイトがtyped eventを1件だけdispatchする。
- semantic transitionがEngine frame stateからだけ供給される。
- rendererが1個のRenderSnapshotから全29書換を行う。
- deck v0のscale/motion抽出前後でhashとSSIM gateを通る。
- 4 CI commandがgreen。

仮の削減判断:

- 12h経過時点で完了予測が20hを超える場合、最初に`drizzle/`・`examples/d1/`掃除を延期する。
- 次にfuture producerのstub実装を削り、型と登録規約だけ残す。
- reducer、SSOT、T0-A、deck validator、golden/CIは削らない。

### 11.2 S2 — Replay + semantic determinism

上限: 15h。

| Task | 内容 | 工数 | 差分 |
|---|---|---:|---:|
| T0-B | fixed-step audio smoothing、15Hz量子化、soft limiter | 3.0h (estimated) | 80–130 LOC (estimated) |
| Recorder | compact control JSON、audio/space binary、budget enforcement | 4.0h (estimated) | 150–230 LOC (estimated) |
| Playback | sourceT差分schedule、新しい`t`、tick投入 | 3.0h (estimated) | 100–160 LOC (estimated) |
| Hash | canonical encoder、全field、30 tick trace | 3.0h (estimated) | 120–180 LOC (estimated) |
| Test | 60秒録再、trace完全一致、破損/budget error | 2.0h (estimated) | 60–100 LOC (estimated) |
| total | — | 15.0h (estimated) | 510–800 LOC (estimated) |

S2 acceptance:

- 60秒sessionのrecord→replayで全state hashが一致する。
- replay eventの`t`は新しいbus到着時刻である。
- replay scheduleはrecorded source tick差分とevent順だけを使う。
- 完成archiveが60,000B/分以下。
- CRC破損、未知schema、budget超過を成功扱いしない。
- soft limiter後の値がhashに含まれる。

仮の削減判断:

- 9h経過時点で15h超過予測なら、replay player UIを作らずdev harnessだけにする。
- human-readable timeline表示、seek UI、export UIを削る。
- binary track、sourceT schedule、hash trace、60秒試験は削らない。

### 11.3 S3 — CV v0

上限: 24h。

| Task | 内容 | 工数 | 差分 |
|---|---|---:|---:|
| Capture | getUserMedia video、VideoTexture、frame callback、clean-output mode | 3.0h (estimated) | 100–160 LOC (estimated) |
| Final/history targets | post target、screen blit、512px ring | 4.0h (estimated) | 120–180 LOC (estimated) |
| Calibration | 4点UI、homography、profile保存 | 4.0h (estimated) | 150–220 LOC (estimated) |
| CV shader | RGB補正、warp、absdiff、threshold、3×3 cleanup | 5.0h (estimated) | 160–260 LOC (estimated) |
| Aggregation | 256–512px mask、8×8 grid、energy、silRatio | 4.0h (estimated) | 140–220 LOC (estimated) |
| Measurement | encoded frame ID、lag、no-person/occluder試験 | 3.0h (estimated) | 80–130 LOC (estimated) |
| reserve | integration failure用 | 1.0h (estimated) | — |
| total | — | 24.0h (estimated) | 750–1,170 LOC (estimated) |

仮の削減判断:

- CV passのp95が33msを超えた時点で512pxを切り、256px固定とする。
- 色補正はglobal RGB gain/biasまでとし、per-pixel radiometric mapを作らない。
- 4点UI、history alignment、absdiff、8×8 output、fallbackは削らない。

## 12. Template cleanup

削除対象:

- `drizzle/`
- `examples/d1/`

隔離worktreeで両方を削除したproduction buildは、133 modules、3.30sで成功した (measured)。

`build/sites-vite-plugin.ts`は`drizzle/`の存在を確認してからcopyするため、directoryがなくてもbuildを継続する。`examples/d1/`はruntime importされていない。

削除不可:

- `worker/`

`vite.config.ts:15`が`main: "./worker/index.ts"`を指定している。`worker/index.ts`はvinext SSR handlerとimage optimizationのactive entryである。削除するとWranglerがmain file不在でbuildを開始できない。

v2のcleanupは`worker/`、`db/`、`drizzle.config.ts`、Cloudflare/Vite dependenciesへ拡張しない。`db/schema.ts`の`examples/d1`参照コメントだけは削除後に更新する。

## 13. Definition of Done

### S1

- SSOT: reducer/store以外から視覚・transition stateを書き換えない。
- Atomicity: 魚カードとRESETが各1 event。
- Time: eventに`t`と`sourceT`があり、render/hashはwall-clock `t`へ依存しない。
- Deck: v0がscale/motionだけを外部化する。
- Visual: hash完全一致、平均SSIM≥0.995、各frame≥0.990。
- CI: lint、typecheck、build、SSR testが全green。

### S2

- Replay: 60秒のcontrol/audio/space trackをrecord/replayできる。
- Determinism: 30 tickごとのhash traceが完全一致。
- Size: 完成archive≤60,000B/分。
- Safety: fixed-step smoothingとsoft slew limiterが同一関数でlive/replayへ適用される。
- Failure: schema、CRC、budget errorを明示して停止する。

### S3

- CV: WebGL経路だけでwarp/color/absdiffを実行する。
- Alignment: camera frameとfinal post historyを実測lagで合わせる。
- Resolution: 512px、性能不足時256px。
- Output: 8×8 grid + energy + silRatio。
- Isolation: calibration/CV中はDOM overlayを投影しない。
- Fallback: camera/CV失敗時に純VJが継続する。

## 14. Backlog

| Item | S1〜S3で作らない理由 | 解錠条件 |
|---|---|---|
| macro/modeの真の外部化 | shader、post、CPU exposureへ挙動が分散 | deck v0 goldenが安定し、deck v1 ticketでuniform/config境界を設計済み |
| atlas layout/species数の可変化 | shader 4×2、CSS 400%×200%、8匹loopが固定 | dynamic atlas shader、UI CSS variable、asset validationを同一milestoneで実装可能 |
| per-species speed/tailAmp/bobAmp | 現行attributeに存在しない | attribute/data texture方式とGPU budgetを測定済み |
| 完全な音声同期 | S2は15Hz tick alignmentまで | seek、長時間drift、audio file currentTimeとの同期testが定義済み |
| comment lane | replay coreと無関係 | replay v1 parserが凍結し、annotation schema ticketが採択済み |
| SSIM完全自動化 | headless GPU差が未固定 | Chromium/GPU imageをpinしたCI runnerが利用可能 |
| 1080p CV | CPU/GPU帯域とcamera upload riskが高い | 512pxでS3 acceptance達成後、同一機でp95 GPU budgetに50%以上余裕 |
| flowField接続 | 残差品質の前に魚挙動へ接続すると原因分離不能 | 実カメラmaskのno-person/occluder基準を達成 |
| 動画出力 | CV coreの受入に不要 | codec、保存先、fps、音声muxの要件が別ticketで確定 |
| WCAG hard flash enforcement | output analyzerが別規模 | §8.3の6条件を満たすmilestoneが起票済み |

## 15. Escalation

本文の仮置き判断は有効であり、未決open questionではない。実測が前提を破った場合だけ次の代替へ切り替える。

### E-01 — Control JSONが28,000B/分を超える

現行判断: param canonical rateをaggregate 8Hzへ制限し、超過sessionをinvalidとして停止する。

代替案:

1. paramだけをbinary trackへ移す。
2. 総量契約を60,000B/分より大きくする。
3. live stateとreplay stateの完全一致を捨て、recording側でdownsampleする。

採用優先順位は1→2→3。3は意味的決定論を弱めるため最終手段。

### E-02 — S1が20hを超える

現行判断: template cleanup、future producer stubの順に切る。

代替案:

1. S1をS1a=`SSOT+T0-A`、S1b=`deck v0+golden gate`へ分割し、S1bの日付を再設定する。
2. S1上限自体を引き上げる。

採用優先順位は1。S1aだけを完了して「deck外部化・見た目不変完了」と表記してはならない。

### E-03 — Camera lagが12-frame ringを超える

現行判断: CVを開始せず純VJへfallbackする。

代替案:

1. 256px ringだけを24 framesへ増やす。
2. camera format/fps/buffer設定を変更して再測定する。
3. IR照明 + noIR cameraへ切り替える。

### E-04 — S3 residualがno-person基準を超える

現行判断: 512px→256pxへの変更では品質は直らないため、解像度変更で隠さない。

代替案:

1. history frame選択とframe ID decodeを再検証する。
2. global RGB gain/biasとcamera exposure lockを再校正する。
3. projector/camera方式をIRへ切り替える。

## 16. Open questions

なし。本文のrate、閾値、切り順、fallbackはv2の仮置き判断として実装を開始できる状態に固定した。
