# FishVJ WorldSource Contract v0

> status: frozen / hard boundary + internal runtime / X review P0=0 / implementation not started
>
> depends on: [FISHVJ_DESIGN_V2](./FISHVJ_DESIGN_V2.md),
> [FISHVJ_INSTRUMENT_V1](./FISHVJ_INSTRUMENT_V1.md),
> [WORLD_RESEARCH_V1](./WORLD_RESEARCH_V1.md)
>
> proof target: Apple M1 / 16GB + desktop Chromium（contract / unverified）

## 1. 位置づけ

`WorldSource`は、固定長frame列ではなく、entity・field・lifecycle・surface ownershipを
fixed tickで更新して映像を生成するsourceである。`stack`を置換しない。

```ts
type ContentSourceRef =
  | { kind: "stack"; contentHash: `sha256:${string}` }
  | { kind: "world"; contentHash: `sha256:${string}` };
```

- `StackSource`: boundedなframe列。Instrument v1の契約を変更しない（hard）。
- `WorldSource`: deterministic world manifest + content-addressed assets（hard）。
- `WorldRuntime`: sourceをfixed tickで進める内部subsystem。公開の第4 stateではない（internal）。
- DJ/VJ mode: controllerの操作文法。source種別とは直交し、第3 modeを作らない（hard）。

## 2. WorldManifest v0

### 2.1 schema

```ts
type Q16 = number; // signed Q16.16 canonical integer

interface WorldManifestV0 {
  v: 0;
  id: string;
  name: string;
  runtime: "fishvj-world-v0";
  contentHash: `sha256:${string}`;
  logicalSize: { width: 960; height: 540 };
  tickHz: 60;
  output: {
    colorSpace: "linear-srgb";
    alpha: "premultiplied";
    format: "rgba8";
  };
  timeline:
    | { kind: "continuous"; djCompatible: false }
    | {
        kind: "bounded";
        djCompatible: true;
        durationTicks: number;
        loopStartTick: number;
        loopEndTickExclusive: number;
      };
  seed: { algorithm: "pcg32-v1"; valueU64: string };
  limits: {
    maxEntities: number;
    maxSystems: number;
    maxGroups: number;
    maxParameters: number;
    maxAssets: number;
  };
  assets: WorldAssetRef[];
  parameters: WorldParameter[];
  groups: WorldGroup[];
  systems: WorldSystem[];
  bindings: WorldCapabilityBinding[];
  surfaces: {
    minimum: 1;
    maximum: number;
    singleSurfaceFallback: "supported" | "reject";
  };
  provenance: {
    author: string;
    license: string;
    source?: string;
  };
}

interface WorldAssetRef {
  id: string;
  role: "sprite" | "alpha" | "depth" | "palette" | "field";
  url: string;
  sha256: string;
  bytes: number;
}

interface WorldParameter {
  id: string;
  label: string;
  minQ16: Q16;
  maxQ16: Q16;
  defaultQ16: Q16;
  scope: "world" | "system" | "group";
  update: "absolute";
}

type WorldSystem =
  | {
      id: string;
      type: "particles";
      kernel: "flow-particles-v0";
      groupId: string;
      capacity: number;
      config: { dragQ16: Q16; fieldGainQ16: Q16; trailTicks: number };
    }
  | {
      id: string;
      type: "boids";
      kernel: "boids-v0";
      groupId: string;
      capacity: number;
      config: {
        neighborRadiusQ16: Q16;
        separationQ16: Q16;
        alignmentQ16: Q16;
        cohesionQ16: Q16;
        maxSpeedQ16: Q16;
      };
    }
  | {
      id: string;
      type: "lifecycle";
      kernel: "lifecycle-v0";
      groupId: string;
      capacity: number;
      config: {
        phaseTicks: [number, number, number, number, number];
        dwellGainQ16: Q16;
        motionDamageQ16: Q16;
      };
    }
  | {
      id: string;
      type: "field2d";
      kernel: "field2d-v0";
      width: number;
      height: number;
      config: { decayQ16: Q16; diffusionQ16: Q16; inputGainQ16: Q16 };
    }
  | {
      id: string;
      type: "propagationGraph";
      kernel: "propagation-graph-v0";
      nodeCount: number;
      edges: Array<[fromU16: number, toU16: number]>;
      config: { hopTicks: number };
    };

interface WorldGroup {
  id: string;
  systemId: string;
  tags: string[];
}

interface WorldCapabilityBinding {
  capability:
    | "flow.impulse"
    | "entity.repel"
    | "entity.attract"
    | "entity.spawn"
    | "entity.scatter"
    | "lifecycle.advance"
    | "graph.propagate"
    | "surface.transfer";
  target: { scope: "world" | "system" | "group"; id?: string };
  verbId: string;
}
```

### 2.2 canonical limits

| item | v0 limit |
|---|---:|
| logical render size | `960×540`（contract） |
| simulation | `60Hz` fixed tick（frozen contract） |
| total entities | `1..2,048`（contract / unverified on target） |
| systems | `1..8`（contract） |
| groups | `1..16`（contract） |
| parameters | `0..16`（contract） |
| assets | `0..32`（contract） |
| encoded asset bytes | 合計`≤256,000,000B`（contract / target unverified） |
| decoded CPU+GPU estimate | 合計`≤512,000,000B`（contract / target unverified） |
| `field2d` cells | 最大`128×72 = 9,216`（contract / unverified on target） |
| propagation graph nodes | 最大`256`（contract / unverified on target） |
| propagation graph edges | 最大`512`（contract / unverified on target） |
| physical surfaces | v0は`1`（contract） |
| logical/offscreen surfaces | 最大`4`（contract / unverified on target） |

string IDはUTF-8 `1..32B`（contract）、同一配列内で一意とする。decoded estimateは
RGBA8なら`width×height×4`、R8なら`width×height`、mipmapを持つ場合は全levelを合算し、
CPU copyとGPU copyを別々に足す（contract）。未知formatはload拒否する。manifestの`contentHash`は
自身の`contentHash` fieldを除いたcanonical JSONと、参照assetの`sha256`を固定順で連結した
byte列のSHA-256（contract）である。

### 2.3 validation

loaderは次の順でfail closedに検証する（hard）。

1. schema、version、limits、ID一意性。
2. URL解決後の全asset byte lengthとSHA-256。
3. group→system、system→groupの相互参照、binding→group/system、parameter参照の完全性。
4. system capacity合計が`maxEntities`以下、graph node/edgeとfield cellが上限以下。graph edgeの
   node indexは`0..nodeCount-1`で、同一有向edgeの重複を許さない。
5. encoded bytesとdecoded CPU+GPU estimateが§2.2上限以下。
6. timelineのloop範囲が`0 ≤ start < end ≤ durationTicks`を満たすこと。
7. runtimeがallowlistにないsystem type、kernel、capability、parameter scopeを含まないこと。
8. surface要求を現在のOutputSurface profileが満たすこと。
9. canonical再計算したworld content hashがmanifest値と一致すること。

任意JavaScript、GLSL文字列、外部network fetch命令、eval可能なexpressionをmanifestへ入れない。
v0の挙動はallowlist済みsystemとcapabilityの組合せだけで作る（hard）。

## 3. deterministic WorldRuntime

### 3.1 入出力

各simulation tickでruntimeが読むものは次だけである。

- validated WorldManifestとasset bytes。
- session seed。
- canonical EngineEvent列。
- frozen BeatStateをv2規約で量子化したcanonical integer列。
- 記録対象のSpaceState（8×8 grid + energy + silRatio、最大`5Hz`）。
- OutputSurface topologyのcanonical snapshot。

`performance.now()`、RAF delta、GPU readback値、配列走査順に依存する`Math.random()`、
locale、network到着順をsimulationへ入れない（hard）。

### 3.2 number model

- entity position、velocity、age、field force、parameterはsigned Q16.16 integer（hard）。
- 加減算・乗算の中間はsigned 64-bit、除算は数学的floor（hard）。
- PRNGは`pcg32-v1`をmanifestで固定し、system IDのUTF-8 byte列からsubstreamを導出する（hard）。
- entity IDは`systemId + spawnCounterU32`で一意にし、再利用しない（hard）。
- neighbor、collision、hash走査はentity ID昇順。GPU iterationの順は意味stateへ戻さない（hard）。
- WorldRuntimeからmixerへ渡すframeは`960×540`、linear-sRGB、premultiplied RGBA8
  （contract）である。別color/alpha形式はload時にrejectする。

### 3.3 tick order

1. 同source tickのeventをcanonical orderで適用する。
2. Beat/Spaceの当該tick sampleを適用する。
3. lifecycle、field、behavior、collisionをmanifest system順で更新する。
4. surface境界を越えたentity ownershipをentity ID順でcommitする。
5. RenderSnapshotを導出する。
6. `tick mod 30 = 0`でworld hashを採取する（frozen interval）。

### 3.4 fast interaction boundary

30Hz residual maskはpresentation-only（hard）である。shader上の局所warp、輝度、trail偏向には使えるが、
entity position、spawn/death、lifecycle、propagation、surface ownerを更新してはならない。
そのlayerはsemantic hash対象外で、replay visual時は既定OFFとする。

fast maskで意味stateを変えるexperimental sessionは開始時に`replayable:false`を記録し、
「決定論replay対応」と表示しない（hard）。

## 4. EngineEvent増築

frozen envelopeとt/sourceT規約を変更せず、Instrument v1のunionへ次を加える。

```ts
type WorldEventBody = { type: "world"; payload: WorldPayload };

type WorldPayload =
  | {
      action: "load";
      deck: "A" | "B";
      worldHash: `sha256:${string}`;
      performanceMapHash: `sha256:${string}`;
      update: "absolute";
    }
  | {
      action: "eject";
      deck: "A" | "B";
      update: "trigger";
    }
  | {
      action: "setParam";
      deck: "A" | "B";
      parameterId: string;
      target: { scope: "world" | "system" | "group"; id?: string };
      valueQ16: number;
      update: "absolute";
    }
  | {
      action: "invoke";
      deck: "A" | "B";
      verbId: string;
      target: { scope: "world" | "system" | "group" | "entity"; id?: string };
      phase: "start" | "stop" | "trigger";
      strengthQ8?: number;
      update: "atomic";
    };
```

`setParam`は他のbase paramと合わせてaggregate `8 events/s`以下（frozen shared cap）。
`load/eject/invoke`は全sparse controlと合わせて平均`1 event/s`、burst `8 events/s`
（frozen shared cap）。1物理gestureからはWorldPayloadを`1件`だけ出す。

`entity` targetはstable entity IDが明示された場合だけ有効で、FLX4既定mapには使わない。
解決不能target、capability不一致、範囲外Q16はbus前validatorがrejectする。

`world/load`はworld hashとperformance map hashを同時に検証し、deck sourceと
`activePerformanceMapHash`を1 reducer transitionでcommitする（hard）。片方だけを先に
変更しない。bounded timelineだけがInstrument v1のDJ transportを受け付け、continuous timelineは
DJ grammarでのloadをrejectする。

`setParam`はInstrument v1 §6.1と同じ`8-tick` integer rampを使う。hashへ入れる値は各tickの
補間後Q16とramp state `{startQ16,targetQ16,startTick,elapsedTicks,currentQ16}`であり、
event受領直後のraw targetだけではない（hard）。

## 5. replayとhash

### 5.1 archive budgetを増やさない

World sessionも完成archive `≤60,000B/分`（frozen contract）を維持する。

- world manifestとasset本体はarchiveへ入れず、content hashで外部参照する。
- `load/eject/invoke`は既存sparse/beat control JSONの`10,720B/分`枠を**共有**する。
- `setParam`は既存base-paramの`5B/event` recordを使い、全base/world param合計で
  `8Hz = 480 events/分`を**共有**する。
- parameter dictionaryは既存manifest/dictionaries `2,000B/分`枠を共有する。
- したがってInstrument v1のglobal worst `59,720B/分`とmargin `280B/分`
  （calculated）は増えない。各枠を別枠として加算してはならない。
- shared capを超えるmappingはrecord開始前にrejectし、recording側だけsampleを捨てない。

world parameter dictionaryの1 codeは
`{deck, parameterId, targetScope, targetId, minQ16, maxQ16}`の組を表す（hard）。recordのu16 valueは
このdictionary rangeへcanonicalizeし、replay adapterが同じQ16へ戻す。同じparameterでもtargetが
異なれば別codeである。dictionary entryがu8 codeまたはmanifest/dictionaries総量`2,000B`を超える
sessionはrecord開始前にrejectする。target stringを5B recordへ直接埋め込まない。

rangeを`r=maxQ16-minQ16`として、live adapterは
`u16=floor(((valueQ16-minQ16)×65535 + floor(r/2))/r)`、
`canonicalQ16=minQ16+floor((u16×r+32767)/65535)`（contract、signed 64-bit中間）へ変換し、
**canonicalQ16だけ**をeventへ入れる。replayも保存u16から同じ第2式で復元する。これによりrecord後だけ
値が丸まる非決定性を防ぐ。`r≤0`、範囲外値、u16外はrejectする。

### 5.2 world hash入力

30 tickごとのbase hashへ、次をfixed field orderで追加する（hard）。

1. world content hash、runtime version、session seed。
2. deck slot、load state、parameter dictionaryとcurrent Q16 values。
3. 各PRNG substreamのstate/counter。
4. system順、entity ID順の全semantic field（position、velocity、age、phase、group、owner surface）。
5. field2dのcanonical Q16 cell列。
6. propagation graphのnode phase、queue、origin event ID。
7. spawn counters、entity/group/system counts。
8. surface topology hashとpending transfer queue。
9. bounded timelineのduration/loop、playhead、active performance map hash。

Three.js object、GPU texture、post-process float、fast mask、wall-clock `t`は含めない。
同じhash、seed、source tick列、event列、Beat/Space track、surface profileでworld hash traceが
完全一致することを意味的決定論の受入とする。

## 6. source failureとfallback

| failure | hard behavior |
|---|---|
| world/asset hash不一致 | load拒否。現行programを維持 |
| unsupported capability | mapping/profileをload拒否。暗黙変換しない |
| entity/system limit超過 | manifest拒否。runtimeで切り捨てない |
| replay時world asset不在 | replay開始拒否 |
| camera/CV停止 | recorded semantic inputを止め、pure VJ/DJ演奏を継続 |
| 1 surfaceしかないがfallback=supported | canonical surfaceへ全worldを表示 |
| 1 surfaceしかないがfallback=reject | world load拒否 |

## 7. Escalation

- **E-W01 — fixed-pointで表現破綻**: visual proofでQ16.16量子化が明確なbanding/jitterを生む場合、
  hash対象semantic stateはintegerのまま維持し、renderer-only interpolationを追加する。
- **E-W02 — 2,048 entityでtarget機が落ちる**: system別benchを提示し、manifest capを下げる。
  fixed tick、hash、camera fallbackは削らない。
- **E-W03 — world dictionaryで2,000B枠超過**: parameter数またはID長を削る。60,000B契約を
  自動で引き上げない。
- **E-W04 — 8Hz shared param capで演奏不能**: live/replay同率の新binary layoutを別versionで起票し、
  byte算術と60秒fixtureを通すまでrateを上げない。
- **E-W05 — fast maskを意味stateへ使う必要**: sessionを`replayable:false`にするか、mask記録用の
  新replay milestoneを起票する。既存の意味的決定論を偽装しない。
