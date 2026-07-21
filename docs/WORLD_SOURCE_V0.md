# FishVJ WorldSource Contract v0

> status: frozen / X-W01〜X-W08 + F-W01〜F-W07 patched / active P0=0 / active P1=0 / implementation not started
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
        initialTick: number;
        durationTicks: number;
        loopStartTick: number;
        loopEndTickExclusive: number;
        seekModel: "canonical-resim-v0";
        authoredInputTrackHash?: `sha256:${string}`;
      };
  seed: { algorithm: "pcg32-v1"; valueU64: `0x${string}` };
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
  role: "sprite" | "alpha" | "depth" | "palette" | "field" | "input-track";
  url: string;
  sha256: `sha256:${string}`;
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
      initialCount: number;
      config: { dragQ16: Q16; fieldGainQ16: Q16; trailTicks: number };
    }
  | {
      id: string;
      type: "boids";
      kernel: "boids-v0";
      groupId: string;
      capacity: number;
      initialCount: number;
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
      initialCount: number;
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
      topology:
        | { kind: "ring-bidirectional-v0" }
        | { kind: "edges-v0"; edges: Array<[fromU16: number, toU16: number]> };
      config: { hopTicks: number; merge: "first-arrival-v0" };
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
  entryNodeU16?: number; // graph.propagateだけ。0..nodeCount-1
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
| bounded timeline | `1..3,600 ticks`（contract / unverified on target） |
| physical surfaces | v0は`1`（contract） |
| logical/offscreen surfaces | 最大`4`（contract / unverified on target） |

string IDはUTF-8 `1..32B`（contract）、同一配列内で一意とする。decoded estimateは
RGBA8なら`width×height×4`、R8なら`width×height`、mipmapを持つ場合は全levelを合算し、
CPU copyとGPU copyを別々に足す（contract）。未知formatはload拒否する。

canonical JSONは[RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)
（JCS）のUTF-8出力（contract）である。Unicode normalizationを追加せず、duplicate keyと
I-JSON外の値をrejectする。manifestの`contentHash`は、自身の`contentHash` fieldを除いたJCS byte列に、
asset IDのUTF-8 byte辞書順で並べた各asset SHA-256 raw `32B`を連結したbyte列のSHA-256
（contract）である。hash文字列表現はlowercase hex `sha256:` + `64文字`に固定する。

### 2.3 validation

loaderは次の順でfail closedに検証する（hard）。

1. schema、version、limits、ID一意性。
2. URL解決後の全asset byte lengthとSHA-256。
3. group→system、system→groupの相互参照、binding→group/system、parameter参照の完全性。
   `entryNodeU16`は`graph.propagate`だけに許可し、参照graphのnode範囲内でなければならない。
4. system capacity合計が`maxEntities`以下、各`0 ≤ initialCount ≤ capacity`、graph node/edgeと
   field cellが上限以下。`edges-v0`の
   node indexは`0..nodeCount-1`で、同一有向edgeの重複を許さない。ring topologyは
   `(i→(i+1) mod N, i→(i-1+N) mod N)`の順でcanonical edgeを生成する。
5. encoded bytesとdecoded CPU+GPU estimateが§2.2上限以下。
6. bounded timelineが`0 ≤ loopStartTick ≤ initialTick < loopEndTickExclusive ≤ durationTicks ≤ 3,600`
   を満たすこと。`authoredInputTrackHash`があれば同じSHA-256を持つ`role:"input-track"` assetが
   ちょうど1件あり、無ければそのroleも0件であること。continuous timelineにbounded fieldを混在させない。
7. runtimeがallowlistにないsystem type、kernel、capability、parameter scopeを含まないこと。
8. surface要求を現在のOutputSurface profileが満たすこと。
9. canonical再計算したworld content hashがmanifest値と一致すること。

`fixture://` URLはrepo固定proofだけで使えるtest-only schemeで、production deck/worldはrejectする。
fixture generator ID、byte生成規則、期待SHA-256がproof fileに固定されている場合だけ解決する。

任意JavaScript、GLSL文字列、外部network fetch命令、eval可能なexpressionをmanifestへ入れない。
v0の挙動はallowlist済みsystemとcapabilityの組合せだけで作る（hard）。

## 3. deterministic WorldRuntime

### 3.1 入出力

各simulation tickでruntimeが読むものは次だけである。

- validated WorldManifestとasset bytes。
- `sessionSeedU64`。v0ではmanifest `seed.valueU64`そのもので、session overrideを禁止する。
- canonical EngineEvent列。
- frozen BeatStateをv2規約で量子化したcanonical integer列。
- 記録対象のSpaceState（8×8 grid + energy + silRatio、最大`5Hz`）。
- OutputSurface topologyのcanonical snapshot。

`performance.now()`、RAF delta、GPU readback値、配列走査順に依存する`Math.random()`、
locale、network到着順をsimulationへ入れない（hard）。

### 3.2 number model

- entity position、velocity、age、field force、parameterはsigned Q16.16 integer（hard）。
- 加減算・乗算の中間はsigned 64-bit、除算は数学的floor（hard）。
- seed文字列は`^0x[0-9a-f]{16}$`（contract）で、16進u64として読む。`pcg32-v1`は
  PCG-XSH-RR 64/32、multiplier `6364136223846793005`、modulo `2^64`へ固定する。
  systemごとに`streamSelectorU64=BE64(SHA-256(UTF8(systemId))[0..7])`、
  `inc=((streamSelectorU64<<1)|1) mod 2^64`とする。初期化は`state=0 → 1 step →
  state=(state+sessionSeedU64) mod 2^64 → 1 step`（hard）。substreamの`state/inc/drawCounter`
  をhashへ入れる。1 stepは旧stateを`old`として
  `state=(old×6364136223846793005+inc) mod 2^64`、
  `xorshifted=(((old>>18) xor old)>>27) & 0xffffffff`、`rot=old>>59`、
  出力u32=`(xorshifted>>rot)|(xorshifted<<((-rot)&31))`へ固定する。
- entity identityは`(systemIndexU8, spawnCounterU32)`（hard）。`systemIndexU8`はmanifestの
  `systems`配列index、counterはsystem内spawn順で0から増やし、再利用しない。counter overflowは
  session errorとする。文字列system IDは診断表示にだけ使う。
- entity順序は`systemIndexU8`数値昇順、同値なら`spawnCounterU32`数値昇順（hard）。hash byte列は
  `systemIndex u8 + spawnCounter u32 little-endian`とし、neighbor、collision、transfer commit、
  hash走査で同じ順序を使う。GPU iterationの順は意味stateへ戻さない。
- WorldRuntimeからmixerへ渡すframeは`960×540`、linear-sRGB、premultiplied RGBA8
  （contract）である。別color/alpha形式はload時にrejectする。
- `field2d-v0`の各cell decayは、入力適用後の値`v`へworld stepごとに
  `vNext=floor(v×decayQ16/65536)`を適用する（hard）。negative値にも§3.2の数学的floorを使う。
  `decayQ16`は`0..65535`、`diffusionQ16`と`inputGainQ16`は`0..65536`に限定する。

### 3.3 engine tick / world step order

1. engine tick `n`のeventをcanonical orderで適用する。
2. Beat/Spaceの当該engine tick sampleをlatest canonical inputとしてlatchする。
3. §3.5のQ32.32 accumulatorから当該engine tickに進めるworld step数`k`を得る。
4. `k`回、lifecycle、field、behavior、collisionをmanifest system順で1 fixed world step進める。
   同一engine tickで複数stepなら同じlatched Beat/Spaceを使う。
5. 各world step末尾でsurface transferをcanonical entity順にcommitする。
6. RenderSnapshotを導出する。
7. `engineTick mod 30 = 0`でworld hashを採取する（frozen interval）。

### 3.4 fast interaction boundary

30Hz residual maskはpresentation-only（hard）である。shader上の局所warp、輝度、trail偏向には使えるが、
entity position、spawn/death、lifecycle、propagation、surface ownerを更新してはならない。
そのlayerはsemantic hash対象外で、replay visual時は既定OFFとする。

fast maskで意味stateを変えるexperimental sessionは開始時に`replayable:false`を記録し、
「決定論replay対応」と表示しない（hard）。

### 3.5 bounded transport semantics

bounded worldのreference stateを`Baseline(p)`とする。これはmanifest初期stateをworld tick `0`へ置き、
`p`まで`1/60`秒相当のfixed world stepを順に適用した結果である。入力はcontent-addressedな
`authoredInputTrackHash`と一致する`role:"input-track"` assetのcanonical event/Beat/Spaceだけを使う。
hash fieldが無い場合はworld eventなし、Beat/Space全zeroとする。hashだけ、またはassetだけが存在する
manifestはload拒否する。live audience/performer入力は`Baseline(p)`へ含めない（hard）。

- 通常forward再生は現在stateを固定world stepで進め、live入力を反映する。
- CUE/hot cue/jog、direction=reverseの各whole step、loop wrapはtarget `p`の`Baseline(p)`を
  tick 0から再simulateしてcommitする。verified checkpointから再開してもよいが、結果はtick 0からの
  referenceとbyte一致しなければならない（internal optimization）。
- seek/rebuild時、seek前のlive入力によるworld mutationを破棄する。recorded transport eventは同じ
  rebuildを起こすためlive/replayで一致する。
- CUE targetは`initialTick`。hot cue targetは既存TransportPayloadのtick。Jogの
  `deltaQ16Frames`は`deltaQ16WorldTicks=deltaQ16Frames×2`（30 frame/s→60 world ticks/s）へ写し、
  `targetTick=floorDiv(worldPlayheadTick×65536+deltaQ16WorldTicks,65536)`でtargetを求める。
  範囲外targetは`loopStartTick + floorMod(targetTick-loopStartTick,
  loopEndTickExclusive-loopStartTick)`でloop区間へwrapし、clampしない。
- forwardで`loopEndTickExclusive`へ達したら`loopStartTick`、reverseで`loopStartTick`未満へ出たら
  `loopEndTickExclusive-1`をrebuildする。wrap回数`cycleIndexU32`を増やす。

Tempo/rateはInstrument v1の8-tick ramp適用後Q16.16 `currentRateQ16`を使う。engine tickごとに
`tickAccumQ32_32 += (u64(currentRateQ16) << 16)`、`k=tickAccumQ32_32 >> 32`、
`tickAccumQ32_32 &= 0xffffffff`（contract）とする。rate `0.5..2.0`では`k=0..2`。
CUE/load/hot cue/jogはaccumulatorを0へ戻し、CUE/loadだけcycle indexも0へ戻す。loop wrapとdirection変更は
抽出後のaccumulator remainderを維持する。`engineTick/worldPlayheadTick/tickAccumQ32_32/
cycleIndexU32/direction/currentRateQ16`をhashへ入れる。continuous worldもforward rateに同じ式を使うが、
cue/jog/reverseをrejectする。

### 3.6 propagation merge

`originEventId=(sourceTickU32, orderInTickU8)`（hard）とし、live bus `seq`をorigin IDへ使わない。
`orderInTickU8`はrecorderが同一source tickのcanonical bus orderを`0`から採番し、replayは保存値を使う。
同一source tickで`256`件目へ到達するsessionはrate gate違反としてevent適用前にrejectする。
invokeはevent適用時点の`worldPlayheadTick`をentry nodeの`arrivalWorldTick`とする。
queueは`(arrivalWorldTick, originSourceTick, originOrderInTick, nodeU16)`昇順で処理する。同じnodeへ
同じworld tickに複数waveが到着した場合、最小originEventIdだけを適用し、他は`collision-no-op`
diagnosticへ記録する（`first-arrival-v0`）。nodeはoriginごとのvisited bitを持ち、同一originで
2回activateしない。別tickの別originは再activateできる。queue、visited、winner origin IDをhashへ入れる。

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
`load/eject/invoke`は全sparse controlと合わせて任意のrolling `60秒`で最大`60 events`
（平均`1 event/s`）、任意のrolling `1秒`で最大`8 events`（burst）
（frozen shared cap）。1物理gestureからはWorldPayloadを`1件`だけ出す。

`entity` targetはstable entity IDが明示された場合だけ有効で、FLX4既定mapには使わない。
payload上のcanonical表現は`e:<systemIndexU8のlowercase hex 2桁>:<spawnCounterU32のlowercase hex 8桁>`
（例`e:00:0000002a`）とし、数値tupleへdecodeしてから§3.2の順序を使う（hard）。
schema上解決不能なtarget、capability不一致、範囲外Q16はbus前validatorがrejectする。validator通過後、
reducer適用tickですでに死亡・不在となったentity targetは`no-op + diagnostic`とし、world state/hashへ
副作用を持たない（hard）。別entity、group、worldへfallbackしない。

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

#### world dictionary binary layout

optional `world.dict`を次の固定layoutで保存する（hard、all integers little-endian）。

| record | layout | bytes |
|---|---|---:|
| header | magic `FJWD` 4B / version u8 / paramCount u8 / hashCount u8 / flags=0 u8 / payloadBytes u32 / payloadCRC32 u32 | `16B` |
| param entry | code u8 / deck u8 (`0=A,1=B`) / scope u8 (`0=world,1=system,2=group`) / paramLen u8 / targetLen u8 / reserved=0 u8 / minQ16 i32 / maxQ16 i32 / param UTF-8 / target UTF-8 | `14B + P + T` |
| hash entry | kind u8 (`0=world,1=map,2=surface,3=calibration`) / slot u8 / SHA-256 raw bytes | `34B` |

param entryはcode昇順、hash entryは`(kind,slot)`昇順。world scopeのtargetLenは`0`。P/Tは各`0..32B`、
entry countはactive map/sessionで実際に参照する組だけ、最大`64`（Performance Map limit）とする。
parameterIdは`1..32B`、system/group targetIdは`1..32B`、world targetだけ`0B`でなければrejectする。
param tupleは`deck数値 → parameterId UTF-8 byte辞書順 → scope数値 → targetId UTF-8 byte辞書順`でsortし、
code `0..N-1`を順に割り当てる。hash slotはworld/mapで`0=A, 1=B`、surfaceは`0`、calibrationは
OutputSurface profileのsurface配列indexとする。payloadCRC32はheader後の全entry bytesを対象とする
CRC-32/ISO-HDLC。hashをhex文字列で格納しない。

metadata budgetの判定式は
`UTF8(JCS(manifest.json)).byteLength + world.dict.byteLength ≤ 2,000B`（contract）である。
既存lane/base-param dictionaryはmanifest JCS bytesへ含まれる。最長param entryは
`14+32+32=78B`。16 entries + v0最大9 hashes（world/map各2、surface 1、calibration 4）+ headerなら
`78×16 + 34×9 + 16 = 1,570B`（measured arithmetic）で、残り`430B`をmanifestが使える。
実際のmanifest込みで超える場合は同じsessionを全writerがrecord開始前にrejectする。

### 5.2 world hash入力

30 tickごとのbase hashへ、次をfixed field orderで追加する（hard）。

1. world content hash、runtime version、`sessionSeedU64 (= manifest.seed.valueU64)`。
2. deck slot、load state、parameter dictionaryとcurrent Q16 values。
3. 各PRNG substreamのstate/counter。
4. canonical entity順の全semantic field（position、velocity、age、phase、group、owner surface）。
5. field2dのcanonical Q16 cell列。
6. propagation graphのnode phase、queue、origin event ID。
7. spawn counters、entity/group/system counts。
8. surface topology hashとpending transfer queue。
9. bounded timelineのinitial/duration/loop、engine/world tick、Q32.32 accumulator、cycle、direction、
   playhead、active performance map hash。

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
