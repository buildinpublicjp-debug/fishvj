# FishVJ Instrument Specification v1

> 対象: `buildinpublicjp-debug/fishvj`
>
> 基準コミット: `2275308460f48d4031fa550fafc80e7b2611f900`
>
> 基準日: 2026-07-20
>
> status: frozen / X-01–X-07 adopted / patch audit P0=0 / implementation not started
>
> 適用範囲: S1b以降のstack、source、空間周波数EQ、FLX4、transport、DJ/VJ mode、preview/program、受入基準

本書は、[RESEARCH_V1](./RESEARCH_V1.md)の領域判定と、frozenの
[FISHVJ_DESIGN_V2](./FISHVJ_DESIGN_V2.md)の技術契約を前提にした楽器仕様である。
EngineEvent、SSOT、replay、deck v0、CV v0を置き換えず、その上へ増築する。

規定強度はv2を引き継ぐ。

- **hard**: 互換性、決定論、演奏意味、受入判定に関わる契約。変更には実測とレビュー票を要する。
- **soft**: best-effortの品質・安全機構。準拠証明として扱わない。
- **internal**: 外から依存してはならない実装選択。v0の公開契約にはしない。

数値ラベルは次の意味で使う。

- **measured**: repo、固定source、または明記した算術から得た値。
- **estimated**: 仮定を明記した見積り。
- **contract**: 本書がv0の受入値として置く値。
- **unverified**: 一次資料または対象実機で未確認の値。

---

## 1. コンセプト

FishVJは、DJ modeとVJ modeで操作文法を切り替え、同じミキサーと同じ映像状態を演奏する
**DJ/VJ 2モード映像楽器**である。DJ transport、cue、jog、crossfaderは市場に既在する
parityとして満たし、製品の芯は、DJミキサーのLOW/MID/HIを映像の大形状・中間構造・輪郭へ
直結する**空間周波数EQ**だけに置く。調査対象のDJ-video製品の公式機能では、この対応例を
確認できなかった、という範囲だけを主張する
（[RESEARCH_V1 §2.3](./RESEARCH_V1.md#23-生き残る差別化主張の再スコープ)）。
決定論replayは検証の背骨、stack契約は供給側の境界であり、どちらも製品説明の主語にはしない。

---

## 2. stack契約 — hard structure / internal encoding

### 2.1 定義と境界

stackは、deck slotへ装填するcontent-addressedな演奏素材である。v0のstackは次を一単位とする。

1. bounded frame列
2. 静的depth map
3. 静的alpha map
4. prep metadata
5. 構成物全体のcontent hash

v0のframe列は`960×540`（contract）、`30fps`（contract）、最長`4秒`（contract）、
最大`120 frames`（contract）、frame payload総量`62,208,000B`以下（contract）とする。
`1B/pixel/frame`は圧縮率の実測値ではなく、transcode後のGPU payloadに対する上限モデルである
（contract）。KTX2/Basis、独立画像列、WebCodecs streamのどれを使うかはinternalとし、
§6.4のaccess contractを通った経路だけを採用する。

depthとalphaはそれぞれ`R8 UNORM`の静的map `960×540×1B = 518,400B`
（measured arithmetic）とする。frame payload最大値と合わせたresident payload上限は
`63,244,800B`（measured arithmetic）である。manifest、decoder work buffer、
render targetはこの値に含めず、§6.4のmemory ceilingで別に制限する。

per-frame depth、per-frame alpha、`120 frames`（contract）を超える列、`960×540`
（contract）を超える解像度はv0外とする。

compressed textureとindexed streamが同時に成立しない場合だけ、frame列をRGBA8
`480×270`（contract）へprepしたfallbackを許す。`480×270×4B×120 =
62,208,000B`（measured arithmetic）であり、frame payload上限は変更しない。
displayは`960×540`（contract）へupscaleし、depth/alphaの論理解像度と位相契約は維持する。

### 2.2 stack manifest

以下はschema/型契約であり、loader実装ではない。

```ts
type StackSourceKind = "playback" | "generated" | "collected" | "live";
type PhaseAxis = "time" | "beat" | "manual";
type LoopMode = "wrap" | "pingpong" | "hold";
type FrameAccessKind = "independent-frames" | "indexed-stream";

interface StackManifestV0 {
  v: 0; // contract
  id: string;
  name: string;
  sourceKind: StackSourceKind;
  contentHash: `sha256:${string}`;

  frame: {
    width: 960;               // contract
    height: 540;              // contract
    fps: 30;                  // contract
    count: number;            // integer 1..120, contract
    maxPayloadBytes: 62208000; // contract
    accessKind: FrameAccessKind;
    assetPath: string;
    assetHash: `sha256:${string}`;
  };

  fallbackResolution?: {
    width: 480;               // contract
    height: 270;              // contract
    format: "rgba8";
    upscaleTo: [960, 540];    // contract
    assetPath: string;
    assetHash: `sha256:${string}`;
  };

  depth: {
    width: 960;               // contract
    height: 540;              // contract
    format: "r8-unorm";
    assetPath: string;
    assetHash: `sha256:${string}`;
  };

  alpha: {
    width: 960;               // contract
    height: 540;              // contract
    format: "r8-unorm";
    assetPath: string;
    assetHash: `sha256:${string}`;
  };

  prep: StackPrepMetaV0;
  access: FrameAccessContractV0;
}

interface StackPrepMetaV0 {
  simHz: 60;                  // frozen v2 contract
  frameStepTicks: 2;          // contract: 60Hz / 30fps
  durationTicks: number;      // integer 2..240, contract
  phaseAxis: PhaseAxis;
  loop: {
    startTick: number;
    endTickExclusive: number;
    mode: LoopMode;
  };
  parallax: {
    enabled: boolean;
    maxDisplacementPx: number; // 0..8 at 960px width, contract
    edgeDilatePx: number;      // integer 0..8, contract
  };
  provenance: {
    sourceUri?: string;
    author?: string;
    provider?: string;
    model?: string;
    licenseStatus: "cleared" | "restricted" | "unverified";
  };
}

interface FrameAccessContractV0 {
  gopFrames: number;
  cacheFrames: number;
  reverseFrames: number;
  decodeP95Ms: number | "unverified";
  memoryCeilingBytes: number;
}
```

`durationTicks`は`frame.count × 2`（contract）と一致しなければならない。
`loop.startTick`は`0`以上（contract）、`loop.endTickExclusive`は`durationTicks`以下
（contract）、かつstartより大きい値でなければならない。phaseは整数source tickから導き、
wall-clockの`t`を参照しない。

### 2.3 validation

loaderはprogramまたはpreviewへ出す前に次を全件検証する。

| 検査 | pass条件 | 強度 |
|---|---|---|
| schema version | `v=0`（contract） | hard |
| dimensions | logical frame/depth/alphaが`960×540`、fallback assetだけ`480×270`（contract） | hard |
| frame count | integer `1..120`（contract） | hard |
| frame rate | `30fps`（contract） | hard |
| frame payload | `62,208,000B`以下（contract） | hard |
| fallback | 指定時はRGBA8 `480×270`、upscale先`960×540`（contract） | hard |
| static maps | depthとalphaが各`518,400B`（measured arithmetic） | hard |
| tick relation | `frameStepTicks=2`、`durationTicks=frame.count×2`（contract） | hard |
| loop | tick範囲内、空区間なし | hard |
| parallax | displacementとedge dilationが各`0..8px`（contract） | hard |
| access | §6.4の5値がすべて存在する | hard |
| provenance | `licenseStatus`が存在する。`unverified`はUI警告対象 | soft |
| hash | manifestと全assetの再計算値が一致 | hard |

未知のhard field、欠損asset、hash不一致、byte上限超過はload errorとし、部分的な素材を
成功扱いしない。`licenseStatus:"unverified"`は技術的loadを許すが、公開上映可能という表明を
してはならない。

### 2.4 content hash

content hashはSHA-256（contract）を使う。入力は次の固定順とする。

1. `contentHash` fieldを除いたmanifestのcanonical byte列
2. asset pathをUTF-8昇順へ並べた一覧
3. 各assetのpath、byte length、SHA-256

canonical encodingはv2 §5.3と同じくkey順へ依存しない。1 byteでも変化したstackは別hashとする。
replayはstack本体を`60,000B/分`（frozen contract）のarchiveへ埋め込まず、content hashを参照する。
再生開始前に同じhashのstackが解決できなければreplayを失敗させる。

### 2.5 deck v0との関係

frozenの`deck.schema v0`は変更しない。`species[index].scale`と
`species[index].motion`だけを外部化する既存契約を維持し、stack fieldを追加しない。

instrument側は別のsession manifestでdeckとslotを結び付ける。

```ts
interface InstrumentSessionManifestV0 {
  v: 0; // contract
  engineDeckId: string;
  engineDeckHash: `sha256:${string}`;
  slots: {
    A: `sha256:${string}` | null;
    B: `sha256:${string}` | null;
  };
  bundledStacks: [`sha256:${string}`];
}
```

GYOGEN素材は同梱stackを`1個`（contract）だけ持つ。既存`gyogen-v0` deckのatlas、
8 species（frozen contract）、4 motion families（frozen contract）を可変stack schemaへ
移さず、prep時に確定した出力をGYOGEN stackとしてhashする。deckは「魚がどう動くか」、
stackは「deck slotが何を演奏するか」を担い、相互のschemaを入れ子にしない。

deck v0の`flashLimit.level:"soft"`（frozen contract）はmetadataのまま維持する。
stack validation、EQ、source validationがこのfieldをhard enforcementへ昇格させることはない。
S2のfixed-step audio smoothingとbest-effort slew limiter、独立milestoneの
`FLASH_HARD_M1`もv2から変更しない。

---

## 3. source 4系統と共通IF — hard boundary

### 3.1 共通IF

すべてのsourceは、programへ直接pixelを書かず、検証済みstackまたは検証中のstack candidateを返す。

```ts
type StackSourceState =
  | "idle"
  | "preparing"
  | "validating"
  | "ready"
  | "failed";

interface StackCandidate {
  sourceKind: StackSourceKind;
  state: StackSourceState;
  prep: StackPrepMetaV0;
  frameAsset: Blob;
  depthAsset: Blob;
  alphaAsset: Blob;
  providerJobId?: string;
}

interface StackSourceV0 {
  readonly kind: StackSourceKind;
  prepare(sourceT: number): Promise<StackCandidate>;
  cancel(sourceT: number): void;
}
```

sourceは`sourceT`を受け、prep metadataのtick基準・phase axis・loop点を生成する。
candidateは§2.3 validationとhash確定を通って初めて`ready`になる。source固有のclock、
network arrival時刻、camera callback時刻をEngineStateの時間基準にしない。

### 3.2 4系統

| source | 入力 | ready条件 | replay時の扱い |
|---|---|---|---|
| **playback** | local/remoteの既存stack | hashと§2.3がpass | 同じhashを再解決 |
| **generated** | prompt、provider job、生成物 | frame/depth/alpha prepとlicense metadataが確定 | providerを再実行せず完成hashを参照 |
| **collected** | 静止画、動画、画面収集、camera収録 | 背景分離・depth・alpha・frame access prepが完了 | 完成hashを参照 |
| **live** | cameraまたはlive generatorのrolling input | program投入区間をbounded assetとして固定しhash済み | 固定した区間のhashを参照 |

background removalはprep用途だけに使う。M1/16GBでの1024² synthetic warm inferenceは
約`2.7–2.8秒`（measured: RESEARCH_V1 §5.1）であり、live `30fps`（contract）の前景分離には
使わない。depth推定のM1処理時間と実素材品質はunverifiedのまま渡す。

live sourceはrolling inputそのものをreplay archiveへ入れない。演奏に採用したbounded区間を
外部stack assetとして保存できないsessionは`replayable:false`とし、決定論replay成功を
表明しない。

### 3.3 AI生成の「注文着弾」文法

generated sourceは同期的な素材生成ではなく、注文、待機、validation、着弾の4状態
（contract）を持つ。
provider job完了時刻を演奏時刻にしない。

1. operatorが注文を出す。
2. candidate到着後、prepとvalidationを完了する。
3. readyになった最初のbar境界へlaunchを予約する。
4. 予約eventをfrozen v2の`sourceT` tickで記録する。

既定launchは`1 bar` snap（contract）、拍子は`4/4`（contract）とする。BeatStateの
confidenceが`0.5`未満（contract）ならbar snapを使わず、次のsimulation tickへ予約する。
到着が予約境界に間に合わない場合は、未完成素材を出さず次のbarへ送る。

公開nominal値は次だけを使用する。

| hosted tier | nominal | price | status |
|---|---:|---:|---|
| fast image | `4–15秒` | `$0.04–$0.06/image` | measured from RESEARCH_V1 §6.2 source table |
| high-quality short video | `2–5分` | `$0.05–$0.20/output-sec` | measured from RESEARCH_V1 §6.2 source table |

queue込みp50/p95とvenue/public-performance licenseはunverifiedである。provider adapterは
これらをSLAとして表示してはならない。生成失敗、license不明、validation失敗はsource単体の失敗であり、
playback/collected/liveの演奏を止めない。

---

## 4. 空間周波数EQ仕様 — hard

### 4.1 信号定義

EQ処理は各deckのstack decode後、channel opacityとcrossfaderの前に置く。入力`I`は
sRGBからlinear RGBへ変換し、alpha premultipliedで扱う。alpha自体を周波数分解せず、
再構成RGBへ元のalphaを適用する。

3帯（contract）はGaussian pyramidから定義する。

- `G0 = I`
- `G1 = P1(G0)`
- `G2 = P2(G1)`
- `HI = G0 - G1`
- `MID = G1 - G2`
- `LOW = G2`
- `O = clamp(gLOW·LOW + gMID·MID + gHI·HI)`

`P1`と`P2`は各levelで同じ`5-tap` binomial kernel
`[1, 4, 6, 4, 1] / 16`（contract）、mirror edge（contract）、
downsample `2:1`（contract）、元解像度への再構成を行うGaussian pyramid operatorとする。
render target配置、pass結合、precisionはinternalだが、上式の結果を変えてはならない。

LOWは大形状、MIDは中間構造、HIは輪郭・ディテールを意味する。音声の周波数bandやRGB channelへ
読み替えてはならない。

### 4.2 FLX4 14-bit値とgain

FLX4のEQは`0..16383`（measured: RESEARCH_V1 §4.2）の14-bit絶対値で受ける。
centerは`8192`（contract）とし、gainは次のpiecewise linear curveへ写像する。

- `0 ≤ raw ≤ 8192`: `gain = raw / 8192`
- `8192 < raw ≤ 16383`: `gain = 1 + (raw - 8192) / 8191`

したがってraw `0 → gain 0`、raw `8192 → gain 1`、raw `16383 → gain 2`
（すべてcontract）である。LOW/MID/HI knobはそれぞれ`gLOW/gMID/gHI`へ直結し、
色、opacity、tempoへ副作用を持たない。

```ts
type EqBand = "LOW" | "MID" | "HI";

type EqPayload = {
  deck: "A" | "B";
  band: EqBand;
  update: "absolute";
  raw14: number;       // integer 0..16383, contract
  gainQ16: number;     // canonical mapped gain, contract
};
```

`gainQ16`はreducer前のvalidationで`raw14`から再計算し、不一致payloadをrejectする。
state hashには`raw14`ではなくcanonical `gainQ16`を固定順で含める。

### 4.3 flatとband kill

3 knobがcenterのとき、`LOW + MID + HI = I`が代数的に成立する。これを
**原画一致ゼロ点**と呼ぶ。ゼロ点は「効果が弱い」ではなく「EQ追加前の原画と一致する」契約である。

band killは次で固定する。

- knobがraw `0`（contract）に到達したbandはgainを正確に`0`（contract）へする。
- kill中も他bandのgain、channel opacity、transportは変えない。
- knobがraw `1`以上（contract）へ戻った最初のcanonical eventでkillを解除する。
- UIからのkillも最終的に同じ`raw14=0`（contract）のabsolute eventを送る。
- 3 band同時killはRGBを`0`（contract）へするが、alphaとtransportは維持する。
- BLACKOUTはfrozen v2のShowStateであり、EQ killの別名にしない。

### 4.4 EQ受入

固定seed、固定tick、同一browser/GPU、`960×540`（contract）、DPR `1`（contract）で判定する。

| test | pass条件 |
|---|---|
| flat state | 3 bandすべてgain `1`（contract） |
| flat image | frame平均SSIM `0.999`以上、各frame `0.998`以上（contract） |
| flat pixel | linear RGB各channelの最大絶対誤差 `2/255`以下（contract） |
| single kill | 出力が式のsoftware referenceと最大絶対誤差 `2/255`以下（contract） |
| all kill | RGB全sampleが `0±1/255`（contract）、alpha差分 `0`（contract） |
| determinism | 同じevent/tick列のEQ state hashが全件一致 |

`2/255`（contract）を超えるprecision lossを「postの性格」として許容しない。EQ passを減らす最適化は、
flatとkillの両testを通った場合だけinternal変更として認める。

---

## 5. FLX4マッピング — hard mapping / bench-gated transport

### 5.1 Web MIDIとSysEx

`producerId:"midi"`はv2で予約済みのProducerIdをそのまま有効化し、新しいbusを作らない。
MIDI adapterはraw messageをvalidateし、§5.3の意味eventへ変換してEngineStoreへdispatchする。

既定接続は`navigator.requestMIDIAccess({ sysex: false })`（contract）である。
keepaliveを送らない設計を正とする。Mixxx sourceには12-byte SysExを`200ms`間隔で送る実装
（measured: RESEARCH_V1 §4.2）があるが、FLX4実機に必須かはunverifiedである。

F-B03で「keepaliveなしだと入力停止または切断」が再現した場合だけ、次の条件分岐を解錠する。

1. `sysex:true`を別permissionとしてoperatorへ明示する。
2. 公式/Mixxxと同じ12-byte message（measured）を、benchで通った間隔だけ送る。
3. permission拒否時は通常MIDIまで巻き添えにせず、FLX4 sourceを`limited`表示にする。

F-B03で必要性が出ない限り、SysEx request、keepalive、vendor message送信を実装しない。

### 5.2 暫定raw map

次表のmessageはRESEARCH_V1 §4.2で固定Mixxx sourceと公式MIDI資料から再構成した
measured値である。実機F-B01〜F-B11を通るまではhardware acceptanceを宣言しない。

| control | deck A | deck B | encoding | status |
|---|---|---|---|---|
| Jog top, vinyl on | `B0 22 vv` | `B1 22 vv` | center `0x40`、7-bit relative | measured |
| Jog top, vinyl off | `B0 23 vv` | `B1 23 vv` | center `0x40`、7-bit relative | measured |
| Jog side | `B0 21 vv` | `B1 21 vv` | center `0x40`、7-bit relative | measured |
| Shift+jog search | `B0 29 vv` | `B1 29 vv` | center `0x40`、7-bit relative | measured |
| Jog touch | `90 36 vv` | `91 36 vv` | nonzero press / zero release | measured |
| Tempo MSB/LSB | `B0 00` / `B0 20` | `B1 00` / `B1 20` | `0..16383` | measured |
| Channel fader MSB/LSB | `B0 13` / `B0 33` | `B1 13` / `B1 33` | `0..16383` | measured |
| EQ HI MSB/LSB | `B0 07` / `B0 27` | `B1 07` / `B1 27` | `0..16383` | measured |
| EQ MID MSB/LSB | `B0 0B` / `B0 2B` | `B1 0B` / `B1 2B` | `0..16383` | measured |
| EQ LOW MSB/LSB | `B0 0F` / `B0 2F` | `B1 0F` / `B1 2F` | `0..16383` | measured |
| Crossfader MSB/LSB | `B6 1F` / `B6 3F` | shared | `0..16383` | measured |
| CUE | `90 0C vv` | `91 0C vv` | `0/127` | measured |
| PLAY/PAUSE | `90 0B vv` | `91 0B vv` | `0/127` | measured |
| Hotcue pads 1–8 | `97 00..07 vv` | `99 00..07 vv` | `0/127` binary | measured |
| Shift pads 1–8 | `98 00..07 vv` | `9A 00..07 vv` | `0/127` binary | measured |
| Pad LED | 対応status/note | 対応status/note | `0/127` on/off | measured; color count unverified |

pad velocityは使わない。値`0`をrelease、`127`をpress（contract）として扱い、中間値が来ても
velocity表現へ昇格しない。中間値はbench artifactへ保存した上でnonzero pressへ正規化する。

### 5.3 control割当

ミキサー部はDJ/VJ modeで不変である。

| FLX4 control | 意味 | event |
|---|---|---|
| EQ LOW/MID/HI | deckごとの空間周波数gain | `eq` absolute |
| Channel fader A/B | deck opacity `0..1`（contract） | `deck/channelOpacity` absolute |
| Crossfader | `mixA=1-x`、`mixB=x`、`x∈[0,1]`（contract） | `deck/crossfader` absolute |
| Tempo fader | playback rate `0.5..2.0`（contract）、center `1.0`（contract） | `transport/rate` absolute |
| PLAY/PAUSE | DJ modeは即時play/pause、VJ modeはquantized launch/stop | `transport` absolute/trigger |
| CUE | deck cue tickへseekしてpause | `transport/cue` trigger |
| Jog | §7のmode文法でplayheadまたはpreview phaseを動かす | `transport/jogSeek` relative |
| Pads | DJ modeはhot cue、VJ modeはShowState操作 | `transport`またはfrozen v2 event |

14-bit faderの正規化値は`x = raw / 16383`（contract）とする。channel faderとcrossfaderは
この`x`をそのまま使う。tempo faderはcenter raw `8192`（contract）でrate `1.0`
（contract）になり、次のpiecewise curveを使う。

- `0 ≤ raw ≤ 8192`: `rate = 0.5 + 0.5 × raw / 8192`（contract）
- `8192 < raw ≤ 16383`: `rate = 1 + (raw - 8192) / 8191`（contract）

VJ modeのpadは次へ固定する。

| Pad | press時のevent |
|---:|---|
| 1 | `mode=MYSTIC` absolute |
| 2 | `mode=SENSUAL` absolute |
| 3 | `mode=EUPHORIC` absolute |
| 4 | `scene=MANDALA` absolute |
| 5 | `scene=FREE_SWIM` absolute |
| 6 | `param/dive` absolute反転後値 |
| 7 | `param/blackout` absolute反転後値 |
| 8 | `oneshot/reset` trigger |

Pad `1–8`（contract）のpressは各`1 event`（frozen contract）だけを送る。releaseは演奏eventを
生成しない。DJ modeのpad `1–8`（contract）はhot cue `1–8`（contract）をtriggerし、
Shift padは同番号hot cueをclearする。

control grammarの切替はoperator consoleのmode switchから`deck/setGrammar`を1 event
（contract）で送る。FLX4上の切替chordはv0に置かない。

### 5.4 rateと14-bit assembly

MSB/LSBは同じdeck/controlのpairとして組み立て、完成した`0..16383`（measured source range）
だけをevent candidateにする。片byte欠損時は直前値と混ぜず、そのpairを破棄する。

frozen v2のbase `param`上限`8Hz aggregate`（contract）は変更しない。instrumentの連続laneは
新しい`eq/deck/transport` typeであり、laneごとに最大`8Hz`（contract）とする。flush境界は
session tick `0`（contract）を起点に`8 ticks`、`7 ticks`を交互に置き、`60Hz`上で平均
`8Hz`（contract）を作る。全laneは同じ境界を共有する。

absolute laneは同じ`producerId/deck/action`のraw値をlast-write-winsでcoalesceする。
`jogSeek`だけは同じ`producerId/deck/target`の`deltaQ16Frames`をraw到着順に符号付き加算する。
総和`0`は送らず、signed 32-bit範囲超過はadapter errorとする。relative deltaの間引き・
last-write-winsは禁止する。

flush tickの開始時に、変更laneをlane code昇順で各`1 EngineEvent`（frozen gesture contract）
としてdispatchする。canonical eventの`sourceT`は最後のraw時刻ではなくflush tickをmsへ変換した
effective source time、`t`はそのbus dispatch時刻とする。最後のraw時刻は診断artifact
`lastRawSourceT`へだけ保存し、recording、reducer、hashへ入れない。これによりlive適用tickと
replay schedule tickを一致させる。

具体的には`effectiveSourceTick=flushTick`、
`sourceT=firstSourceT+(effectiveSourceTick×1000/SIM_HZ)`（contract）とする。
recorderはこのfloatを逆変換せず、adapterが渡すinteger `effectiveSourceTick`をそのまま
delta source tickへ保存する。

absolute controlは各flush eventで後述の`8-tick`固定rampを開始し、Engine frame laneが
`60Hz`固定tick（frozen contract）で評価する。operator-facingな更新は`30–60Hz`
（contract）とする。raw hardware event rate、jitter、最大gapはF-B04までunverifiedである。

### 5.5 instrument binary track — hard X-04 amendment

X-04のbyte算術を新証拠として、frozen v2 §15 E-01の代替案1を解錠する。continuous
instrument eventとfrozen base `param` eventをlosslessな`instrument.bin`へ移す。
base control JSONのtuple/order規約、audio.bin、space.binの意味は変更せず、
runtimeの1 gesture=`1 EngineEvent`（frozen contract）も維持する。

1 flush tickを1 sampleとして、次のlayoutで保存する。

| Field | Bytes |
|---|---:|
| delta source tick | `2B` u16 |
| changed-lane mask | `2B` u16、instrument 13 lane使用 |
| first order in tick | `1B` u8 |
| instrument value | set bitごとに`2B` |
| maximum instrument sample | `5B + 13×2B = 31B`（measured layout） |

lane codeはEQ `6`、channel opacity `2`、tempo `2`、crossfader `1`、jog `2`の計
`13`（contract）を固定順へ割り当てる。EQ/opacity/tempo/crossfaderはraw14をu16で保存し、
replay adapterが同じQ16 curveを再計算する。jogは`0.25 frame`単位（contract）の符号付き
i16総和として保存し、replay時に`deltaQ16Frames = value × 16384`（contract）へ戻す。
同tickのeventはlane code昇順に展開するため、liveとreplayのseq順が一致する。
`firstOrderInTick + changedLaneCount - 1`が`255`を超えるsampleはrejectする（contract）。

base paramは別record
`[tickInChunk:u8, orderInTick:u8, dictionaryCode:u8, canonicalValue:u16]`
の`5B/event`（measured layout）で同じchunkへ入れる。dictionary codeはv2の10 paramを
固定順u8へ写し、値はv2 §5.3のcanonical integerをu16へ保存する。`fishSelection`は
species `0..7`をbit `0..2`、swimType index `0..3`をbit `3..4`へpackし、残bitが
nonzeroならrejectする（contract）。`orderInTick`は同source tickの全canonical event内の
元順序`0..255`（contract）であり、範囲超過sessionをrejectする。binary化前後でcanonical
event数、source tick、event順を変えない。

最大`8Hz × 60秒 = 480 samples/分`（contract）なので、payloadは
instrumentが`31B × 480 = 14,880B/分`（measured arithmetic）、base paramが
`5B × 480 = 2,400B/分`（measured arithmetic）、1秒chunk headerが
`24B × 60 = 1,440B/分`（measured arithmetic）、track上限は`18,720B/分`
（contract）である。instrument trackだけはheaderの`interval microseconds=0`
（contract）をvariable-interval sentinelとし、各sampleのdelta source tickを使う。
continuous instrument tupleとbase param tupleを除いたcontrol JSON上限は
`10,720B/分`（contract）とする。

chunk headerの`sample count`はinstrument sample数を表す。decoderはその件数をmaskで
可変長parseした後、payload末尾までを`5B`単位のbase-param recordとして読む。余剰byteが
`5B`の倍数でなければtrackをrejectする（contract）。

decoderはcontrol JSON、instrument sample、base-param recordを
`(sourceTick, orderInTick)`の昇順でmergeする。instrument sample内の各laneは
`firstOrderInTick`からlane code昇順に連続したorderを復元する。同じsource tickの元順序を
track種別順へ置き換えない。

| Replay allocation | 1分上限 |
|---|---:|
| existing audio/space binary | `26,280B`（frozen measured arithmetic） |
| instrument/base-param binary | `18,720B`（contract） |
| sparse/beat control JSON | `10,720B`（contract） |
| manifest/dictionaries | `2,000B`（frozen contract） |
| archive/container reserve | `2,000B`（frozen estimated） |
| total | `59,720B/分`（calculated） |
| `60,000B/分`との差 | `280B/分`（calculated margin） |

instrument binaryがないsessionはbase v2 containerのままとする。存在するsessionはmanifestへ
`instrumentHz:8`、lane dictionary、base-param dictionary、track hashを追加する。CRC、
chunk sequence、budget超過を成功扱いしない。

---

## 6. transport仕様 — hard

### 6.1 stateとEngineEvent増築

v2の`EventEnvelope`、`t/sourceT`規約、bus、seq、producer登録をそのまま使う。
`EngineEventBody`へ次の3 type（contract）を追加する。

```ts
type InstrumentEventBody =
  | { type: "deck"; payload: DeckPayload }
  | { type: "eq"; payload: EqPayload }
  | { type: "transport"; payload: TransportPayload };

type DeckPayload =
  | {
      action: "load";
      deck: "A" | "B";
      stackHash: `sha256:${string}`;
      update: "absolute";
    }
  | {
      action: "eject";
      deck: "A" | "B";
      update: "trigger";
    }
  | {
      action: "channelOpacity";
      deck: "A" | "B";
      valueQ16: number;
      update: "absolute";
    }
  | {
      action: "crossfader";
      valueQ16: number;
      update: "absolute";
    }
  | {
      action: "setGrammar";
      value: "DJ" | "VJ";
      update: "absolute";
    }
  | {
      action: "selectPreview";
      deck: "A" | "B";
      update: "absolute";
    };

type TransportPayload =
  | {
      action: "playing";
      deck: "A" | "B";
      value: boolean;
      quantize: "none" | "bar";
      update: "absolute";
    }
  | {
      action: "rate";
      deck: "A" | "B";
      valueQ16: number;
      update: "absolute";
    }
  | {
      action: "direction";
      deck: "A" | "B";
      value: "forward" | "reverse";
      update: "absolute";
    }
  | {
      action: "cue";
      deck: "A" | "B";
      update: "trigger";
    }
  | {
      action: "setCue";
      deck: "A" | "B";
      tick: number;
      update: "absolute";
    }
  | {
      action: "hotCue";
      deck: "A" | "B";
      index: number;
      update: "trigger" | "clear";
    }
  | {
      action: "jogSeek";
      deck: "A" | "B";
      deltaQ16Frames: number;
      target: "program" | "preview";
      update: "relative";
    };
```

本書の`Q16`はQ16.16固定小数点であり、`encode(x)=floor(x×65536+0.5)`、
`decode(q)=q/65536`（contract）とする。`1.0=65536`（contract）である。
`gainQ16`はunsigned 32-bit `0..131072`、opacity/crossfaderの`valueQ16`は
unsigned 32-bit `0..65536`、rateの`valueQ16`はunsigned 32-bit `32768..131072`、
`deltaQ16Frames`はsigned 32-bit（すべてcontract）とする。これはv2 §5.3のnormalized
float規則ではなく、「fieldごとに定義したscale」を使うinstrument fieldである。hashはraw floatでなく、
このintegerを固定field順へ入れ、範囲外と非canonical integerをrejectする。

本書の`floorDiv(a,b)`は`b>0`に対する数学的floor、`ceilDiv(a,b)=-floorDiv(-a,b)`、
`floorMod(a,b)=a-b×floorDiv(a,b)`（すべてcontract）である。固定小数点、playhead、
beat、rampの中間演算はsigned 64-bitで行い、overflowをsession errorとしてrejectする。

absolute instrument controlは`CONTROL_RAMP_TICKS=8`（contract）の整数線形rampを使う。
event適用tickを`k`、適用直前の補間値を`startQ16`、新値を`targetQ16`とし、tick `n`の
`elapsed=clamp(n-k+1, 0, 8)`、補間値を
`floor((startQ16×(8-elapsed)+targetQ16×elapsed)/8)`（contract）とする。
途中で新eventが来た場合は、そのtickの適用直前値を新しい`startQ16`にして8-tick rampを再開する。
EQ gain、opacity、crossfader、rateはこの補間後integerをhashへ入れる。jog delta、button、
pad、launchはrampを通さない。

各simulation tick `n`（contract）の処理順は次へ固定する。

1. 同source tickのeventをrecorded seq順でdispatchする。MIDI flushもここで行う。
2. beat anchorを更新し、未発火launchのtarget tickを再計算する。
3. `targetTick=n`のlaunch snapshotをprogramへcommitする。
4. absolute control rampを上式で1 step進める。
5. transport playheadを進める。
6. RenderSnapshotを導出する。
7. `n mod 30 = 0`（frozen contract）ならstate hashを採取する。

同tickのclock anchorはlaunch判定より先に適用する。再計算後のtargetが現在tickより後なら、
旧targetで発火させない。

base v2のmode/scene/param/beat/space payloadを再定義しない。instrument eventも
bus到着時に新しい`t`を得て、recordingは`sourceT`差分を保存する。1 MIDI gestureから
複数eventを派生させない。

### 6.2 play、cue、seek

- nominal playbackは`30 frames/s`（contract）、simulation `60Hz`（frozen contract）なので、
  rate `1.0`（contract）で`2 ticks/frame`（contract）進む。
- playheadはsigned 64-bitの`playheadQ17`（contract）で保持する。Q16 frame positionは
  `floorDiv(playheadQ17, 2)`、剰余は`floorMod(playheadQ17, 2)`（contract）から導く。
  rate `valueQ16`を1 tickごとにdirection符号付きで`playheadQ17`へそのまま加算するため、
  奇数rateQ16の`0.5 Q16 unit`を捨てない。hashには`playheadQ17`を入れる。
- loop終端ではmanifestの`wrap/pingpong/hold`へ従う。
- directionはtransport stateであり、negative rateとして二重表現しない。
- PLAY/PAUSEは現在snapshotをproducerが読み、反転後booleanをabsolute eventとして送る。
- CUE pressは保存cue tickへseekし、playingをfalseへする原子的triggerである。
- SET CUEは停止中の現在tickをabsolute保存する。
- hot cueは最大`8点/deck`（contract）。triggerは保存tickへseekし、clearは該当点だけを消す。
- jog seekはframe単位のrelative deltaとしてcanonical化し、wall-clock速度をhash入力にしない。

FLX4 jogの`vv-64`（measured source encoding）からframe deltaへの初期scaleは
`0.25 frame/unit`（contract）とする。F-B04/F-B09で操作不能と判定された場合だけ§10 E-I05へ進む。
seek/cue/hot cueはQ16位置を`×2`して`playheadQ17`へ設定し、loop wrapもQ17単位で行う。

### 6.3 quantized launch

VJ modeのPLAYは、readyなpreview stateを次のbar境界へ予約する。barは`4 beats`
（contract）、BeatState confidenceは
`confidenceU16=floor(confidence×65535+0.5)`（contract）へcanonicalizeし、
`32768`以上（contract、float `0.5`のcanonical値）で有効とする。閾値未満なら次simulation
tickでlaunchする。

bar計算へraw BeatState floatを入れない。clock eventをreducerへ入れる前に
`phaseU16=floor(phase×65535+0.5)`、
`phaseQ16=min(65535, floor(phaseU16×65536/65535+0.5))`、
`bpmQ16=floor(bpm×65536+0.5)`（contract）へcanonicalizeし、liveとreplayが同じintegerを使う。
`phaseQ16`のcanonical rangeは`0..65535`（contract）であり、phase `<1.0`を`65536`へ
丸め上げない。

barはunwrapped beat positionから導く。最初に採用したclock anchor
`(Ta, phaseQ16A, bpmQ16A)`でsigned 64-bit `beatAQ16=phaseQ16A`（contract）と置く。
anchorからtick `T`までの予測値は
`beatQ16(T)=beatAQ16+floorDiv((T-Ta)×bpmQ16A, 60×SIM_HZ)`（contract）とする。
次のanchorでは直前anchorから予測したbeat positionに最も近く、下位16-bitが
`phaseQ16N`になるsigned 64-bit `beatNQ16`を採用する。同距離なら正方向を選ぶ
（contract）。更新後は新anchorを単一の正とする。

予約tickのunwrapped `beatRQ16`から、厳密に次の4-beat境界
`targetBeatQ16=4×65536×(floor(beatRQ16/(4×65536))+1)`（contract）を求める。
`targetTick=Ta+ceilDiv((targetBeatQ16-beatAQ16)×60×SIM_HZ, bpmQ16A)`（contract）とし、
境界へ達する最初のinteger simulation tickを選ぶ。発火前にclock anchorが更新された場合だけ同じ予約snapshotから
再計算する。同tickのanchor/launch順は§6.1の処理順へ従う。anchor tick、`phaseQ16`、
`bpmQ16`、`beatAQ16`、targetBeatQ16、targetTickを固定width integerとしてstate hashへ含める。

予約時にstack hash、deck、playhead、rate、direction、EQ、cue stateをatomic snapshotとして
保持し、境界到達時にprogramへ適用する。予約後のpreview操作は既存予約を書き換えない。
更新する場合は新しいlaunch gestureを必要とする。

### 6.4 WebCodecsとframe accessの5値契約

媒体経路を1方式へ固定しない。独立frame列でもindexed streamでも、次の5値（contract）をmanifestへ持ち、
対象Mac/Chromiumでbenchする。

このbenchはS4 task 1のspike-first gateである。stack loader、transport、preview/programを
書く前に、同一`120-frame` fixture（contract）で両経路を測る。両方がpassしない場合は
その時点でS4実装を止め、E-I01へ進む。20h消費後のacceptance試験まで失敗を遅延させない。

| field | v0 pass値 | status |
|---|---:|---|
| `gopFrames` | independentは`1`、indexed streamは最大`30` | contract |
| `cacheFrames` | 最低`30` | contract |
| `reverseFrames` | 最低`15` | contract |
| `decodeP95Ms` | `16.7ms`以下 | contract; current value unverified |
| `memoryCeilingBytes` | decoder/cache/stack payload合計`134,217,728B`以下 | contract |

`134,217,728B = 128MiB`（measured arithmetic）。§2のresident payload最大
`63,244,800B`（measured arithmetic）を含む。GPU driverの不可視allocationは
`performance.memory`だけで確定せず、browser task managerとprocess peakを併記する。

indexed stream seekはtarget以前の最近傍key frameからforward decodeする。cache外reverseは
前key frameからdecodeし直す。GOP、cache、reverse幅、decode p95、memory ceilingのどれか1つでも
欠けた素材をscratch可能としてloadしない。

Apple M1/Chromeのcompressed texture extension set、KTX2 transcode/upload p95、
WebP/AVIF独立frame列のcold/warm decode・GPU upload p50/p95はすべてunverifiedである。
実測前に特定backendの成立を表明せず、同一`120-frame` fixture（contract）で5値を比較する。
両経路が死んだ場合でも、manifestの`fallbackResolution`が有効ならRGBA8
`480×270`（contract）を同じ5値で再測定できる。

### 6.5 2.5D小parallax

v0はprep済みdepthを使う小振幅parallaxだけを許す。最大displacementは`8px`
（contract、基準幅`960px`）、edge dilationも最大`8px`（contract）である。

次はv0仕様外とする。

- hidden backgroundを露出する振幅
- layered depthまたはcolor/depth inpaintingを必要とする素材
- 大parallax
- camera orbit
- jogによるorbit演奏

jog=orbitはS3完了後のbacklogであり、S3に含めない。parallax validationで未定義pixelが
frame面積の`0.5%`を超えるstack（contract）は2.5Dを無効化してflat表示する。
inpaintingを暗黙に追加して通してはならない。

---

## 7. 2モード、共通ミキサー、preview/program — hard

### 7.1 不変状態

DJ/VJ switchは**入力文法だけ**を変える。switch event適用時に変化してよいのは
`controlGrammar`だけであり、次は全件不変とする。

- slot A/Bのstack hash
- playhead、playing、rate、direction
- cue/hot cue
- LOW/MID/HI gain
- channel opacity、crossfader
- preview deck、program composite
- ShowState、BeatState、SpaceState
- transitionとone-shot残tick

`controlGrammar`はsemantic state hashへ含めるが、RenderSnapshotへ入れない。同じsimulation tickで
switch前後のRenderSnapshot canonical bytesは完全一致し、program/previewのpixel diffは
`0`（contract）でなければならない。

### 7.2 DJ mode

DJ modeは既在のDJ-video文法をparityとして実装する。

| gesture | 対象 | 意味 |
|---|---|---|
| PLAY/PAUSE | program deck | 即時play/pause |
| CUE | program deck | cueへ戻りpause |
| Jog touch + turn | program deck | relative scratch seek |
| Jog side | program deck | 小幅relative seek |
| Tempo | program deck | rate `0.5..2.0`（contract） |
| Pad 1–8 | program deck | hot cue 1–8（contract） |
| Shift pad 1–8 | program deck | hot cue 1–8 clear（contract） |

### 7.3 VJ mode

VJ modeはpreviewで次の状態を仕込み、quantized launchでprogramへ着弾させる。

| gesture | 対象 | 意味 |
|---|---|---|
| PLAY | preview | 次barへlaunch予約 |
| PAUSE | program deck | 次tickでstop |
| CUE | preview | preview cueへ戻りpause |
| Jog | preview | preview phase seek。orbitはしない |
| Tempo | preview | 次のlaunch snapshotへrateを設定 |
| Pad 1–8 | ShowState | §5.3のmode/scene/DIVE/BLACKOUT/RESET |

VJ modeでもEQ、channel fader、crossfaderはprogramへ連続適用する。VJ modeだから別の
EQ意味論や別mixer curveへ切り替えることを禁止する。

§7.1の不変条項が対象にするのは`deck/setGrammar` eventそのものだけである。§5.3のVJ padが
送る`mode/scene/param/oneshot`は切替後の別gestureであり、ShowStateと映像を意図どおり変更する。
ShowStateの`mode`と入力文法の`controlGrammar`を同じfieldへ統合しない。

### 7.4 preview/program

v0は2系統を必須とする。

- **preview**: 選択deckのpre-channel-fader映像、playhead、cue、launch予約を手元画面へ出す。
- **program**: deck A/BへEQ、channel opacity、crossfader、master postを適用した最終映像を
  external fullscreenへ出す。

program合成はlinear RGB・premultiplied alphaのcross-dissolveに固定する。EQ後のdeck値を
`(CA, αA)`、`(CB, αB)`、channel opacityを`oA/oB`、crossfaderを`x`とすると、
`wA=1-x`、`wB=x`、`Cprogram=clamp(wA×oA×CA+wB×oB×CB, 0, 1)`、
`αprogram=clamp(wA×oA×αA+wB×oB×αB, 0, 1)`（contract）である。
未装填deckはRGB/alphaとも`0`（contract）として扱い、このpremultiplied結果をmaster postへ渡す。
source-over、additive、deck順依存のblendはv0で使わない。

previewはprogramの代替outputではなく、programへpixelを混入させない。program側DOM overlayは
frozen visual contractへ従う。S3のcalibrationModeではscanlines、badges、DIVE badge、
DOM BLACKOUTを停止し、canvasを投影面とするfrozen規約を維持する。

2 output（contract）は同じsimulation tickと同じstack hashを参照する。別々のwall-clockで再生して
driftさせてはならない。

v0のprimary targetは、RESEARCH_V1 §5.1で測定したApple M1 / 16GB RAMのMac
（measured）とdesktop Chromiumである。受入時のbrowser version、接続display、
Window Management permissionはartifactへ保存する。exact browser versionと
multi-display permission成功率は実機Sprintまでunverifiedとする。手動で開いた第2windowを
fullscreenにするfallbackは許すが、programがexternal fullscreenにならない状態を
§8.1の合格には数えない。

---

## 8. 受入基準

### 8.1 Minimum parity全行判定

RESEARCH_V1 §1.3の全行を、v0合格対象か、明示的に落とす対象かへ固定する。

| minimum parity機能 | v0判定 | v0受入 |
|---|---|---|
| 動画像/静止画のload・loop・seek・speed/direction | **満たす** | stack validation、§6 transport |
| 2系統以上のlayer、opacity、blend/composite | **満たす** | deck A/B、channel opacity、crossfader |
| 素材/scene triggerとtransition | **満たす** | immediate/quantized launch、既存scene transition |
| BPM/audio analysisによるparameter modulation | **満たす** | frozen BeatStateとaudio bandsを同一fixed tickで適用 |
| beat/quantized launchまたはbeat snap | **満たす** | 1-bar snap（contract）、confidence fallback |
| 素材/layer/masterの汎用FX chain | **落とす** | v0は空間周波数EQと既存master postだけ。任意chainは対象外 |
| MIDI learn/mapping | **満たす** | FLX4固定mapping。learn UIは対象外 |
| live camera/capture input | **満たす** | live/collected source、bounded区間のstack化 |
| external fullscreen/programとpreview | **満たす** | §7.4の2出力 |
| Syphon/Spout/NDIの少なくとも1つ | **落とす** | Web v0では直接提供しない |
| corner pin/warp/projection mapping | **落とす** | S3 homographyはCV照合用でありprogram mappingではない |
| output recordまたはoffline export | **落とす** | replayはoutput録画の代替と呼ばない |
| shader/generator/node拡張 | **落とす** | internal shaderだけ。外部拡張slotは対象外 |
| AI生成 | **minimum外・gateから落とす** | generated source IFは定義するが、差別化・v0合格条件にしない |

「落とす」行をREADMEやdemoで実装済みと表記しない。v0のparity達成とは、本表の
「満たす」行が全greenであることを指し、市場全体への完全parityを意味しない。

### 8.2 stack acceptance

1. GYOGEN同梱stack `1個`（contract）がA/Bどちらにもloadできる。
2. `120 frames`（contract）最大素材でframe payloadが`62,208,000B`以下（contract）。
3. depth/alphaを含むresident payloadが`63,244,800B`以下（contract）。
4. manifest、asset path、1-byte corruptionの各fixtureをrejectする。
5. 同じ構成物からSHA-256が`100回`（contract）連続で一致する。
6. content hash不在のreplayを開始しない。
7. 2.5D invalid-pixel率が`0.5%`以下（contract）。超過時はflat fallbackする。
8. E-I01 fallback fixtureはRGBA8 `480×270×4B×120=62,208,000B`（contract）で、
   `960×540`（contract）へupscaleできる。

### 8.3 transport acceptance

1. play、pause、cue、hot cue、loop、forward/reverseを`120-frame` fixture（contract）で通す。
2. fixed tickで期待frame indexとの差が`0 frame`（contract）。
3. jog seek後のtarget誤差が`±1 frame`以内（contract）。
4. quantized launchが予定source tickと完全一致する。
5. S4 task 1で§6.4の5値を対象Mac/Chromiumで記録し、選択経路が全pass値を満たす。
6. cache外reverseとGOP最大値の両fixtureでdecode errorを出さない。
7. program/previewが`10分`（contract）走行後もsimulation tick差`0`（contract）。

### 8.4 EQ acceptance

§4.4のflat、single kill、all kill、determinismを全greenにする。さらにFLX4の
LOW/MID/HIを各端から端へ`10往復`（contract）し、次を満たす。

- endpointがraw `0/16383`（measured source range）へ到達する。
- center raw `8192`（contract）がgain `1`（contract）になる。
- MSB/LSB欠損時に前後controlのbyteを混ぜない。
- gain traceにNaN、範囲外、逆行がない。
- 3 deck-bandのeventから対応外bandへのstate changeが`0件`（contract）。

### 8.5 replay acceptance

instrument拡張後もfrozen v2のreplay契約を維持する。

- `60秒`（frozen contract）のcontrol JSON + audio/space binary +
  optional instrument binaryをrecord/replayする。
- 完成archiveは`60,000B/分`以下（frozen contract）。
- 両deck EQ `6 lane` + crossfader `1 lane` + jog `2 lane`を全flushで同時操作する
  X-04 fixtureは、`(5B + 9×2B) × 480 + 1,440B = 12,480B/分`
  （measured arithmetic）のinstrument track、完成archive `53,480B/分`
  （calculated）以下を満たす。
- base paramもaggregate `8Hz`で同時に最大発生するglobal worst-caseは、
  instrument/base-param track `18,720B/分`、完成archive `59,720B/分`
  （ともにcontract）以下を満たす。
- `30 simulation ticks`ごとのhash traceが全件一致（frozen contract）。
- replay投入時に新しい`t`を刻み、scheduleはsource tickだけを使う。
- stack hash、slot、`playheadQ17`、rate、direction、cue/hot cue、EQ gain、opacity、
  crossfader、preview/program selection、launch queue、controlGrammar、
  parallax displacementをhash入力へ追加する。
- 各absolute laneのramp
  `{startQ16,targetQ16,startTick,elapsedTicks,currentQ16}`をfixed lane順でhashへ入れる。
- canonical beat
  `{anchorTick,phaseQ16,bpmQ16,beatAQ16,targetBeatQ16,targetTick}`をhashへ入れる。
- hashは§6.1 step 7、すなわちevent、anchor、launch、ramp、playhead、RenderSnapshotの
  更新後にだけ採取する。
- `rateQ16=32769`（contract test value）をforward/reverse各`2 ticks`進め、
  `playheadQ17`と`floorDiv/floorMod`の期待値がlive/replayで完全一致する。
- ramp `0→65536`はevent tickから
  `[8192,16384,24576,32768,40960,49152,57344,65536]`
  （measured arithmetic）の`8 ticks`列と完全一致する。
- 同一flush内に異なるraw時刻を持つjog入力を置き、recorded source tickがflush tick、
  `lastRawSourceT`の変更によるhash差が`0件`（contract）であることを確認する。
- phaseが1.0直前で`phaseU16=65535`へ丸まるfixtureでも`phaseQ16=65535`
  （contract）に飽和し、予約tickがlive/replayで完全一致する。
- same machine visual gateは平均SSIM `0.995`以上、各frame `0.990`以上
  （frozen contract）。
- controlGrammar switchだけを入れた同tick比較ではsemantic hashだけが変化し、
  RenderSnapshot bytesとpixel diffは`0`（contract）。

### 8.6 FLX4 bench-required

RESEARCH_V1 §4.4のF-B01〜F-B11を削らない。特に次はunverifiedのまま実機へ渡す。

- Web MIDI port name
- keepalive必須性
- raw jog rate/jitter
- jog touch release形式
- 14-bit message順と欠損
- pad velocity unique set
- LED色数とsafe update rate
- MIDI-to-photon p50/p95
- reconnect
- firmware差

F-B01、F-B03、F-B04、F-B06、F-B07、F-B09、F-B10がgreenになるまで
「FLX4対応完了」と表記しない。

S5の固定bench blockではF-B01/F-B03/F-B06/F-B07を完了し、F-B04/F-B09/F-B10は
harness起動までをDoneとする。F-B03でkeepalive必須ならE-I04 ticketを起票して
`limited`表示に落とし、上記の「FLX4対応完了」条件を満たしたとは数えない。

---

## 9. Sprint積算

### 9.1 工数規律

frozen v2の上限を変更しない。

- S1 total `20h`以下（contract）
- S2 total `15h`以下（contract）
- S3 total `24h`以下（contract）

v2 §11の既存積算から、S1aはT0-A `3.0h`、Event core `4.0h`、
Console migration `3.5h`、Canvas migration `4.0h`、QA/golden/CI `3.5h`、
合計`18.0h`（estimated）と仮置きする。S1bはfrozen deck v0の
`2.0h`（estimated）だけを行い、S1 totalを`20.0h`（estimated）に保つ。

S1へstack loader、EQ、FLX4、preview/programを押し込まない。本書のtype/schemaは設計成果物であり、
S1実装LOCへ数えない。

### 9.2 Sprint table

| Sprint | 上限 | task | 工数 |
|---|---:|---|---:|
| S1a | S1内`18.0h`（estimated） | SSOT、T0-A、golden、CI | `18.0h`（estimated） |
| S1b | S1内`2.0h`（estimated） | frozen deck v0のscale/motion外部化とvalidator | `2.0h`（estimated） |
| S2 | `15h`（contract） | frozen replay、T0-B、hash、soft limiter | `15.0h`（estimated） |
| S3 | `24h`（contract） | frozen CV v0。instrument orbitは入れない | `24.0h`（estimated） |
| S4 | `20h`（contract） | stack core、transport、A/B、preview/program | `20.0h`（estimated） |
| S5 | `20h`（contract） | spatial EQ、mixer、FLX4、2 mode | `20.0h`（estimated） |
| S6 | `20h`（contract） | 4 source adapter、quantized arrival、parity統合 | `20.0h`（estimated） |

### 9.3 S4 — stack/transport

| task | 工数 | 差分 |
|---|---:|---:|
| **task 1: access spike-first** — 120-frame両経路5値bench | `4.0h`（estimated） | `80–140 LOC`（estimated） |
| stack manifest、validation、content hash | `4.0h`（estimated） | `140–220 LOC`（estimated） |
| playback loader + transport reducer/frame state | `5.0h`（estimated） | `200–320 LOC`（estimated） |
| deck A/B、mixer state、preview/program | `5.0h`（estimated） | `180–280 LOC`（estimated） |
| fixturesと§8.2/8.3 test | `2.0h`（estimated） | `80–140 LOC`（estimated） |
| total | `20.0h`（estimated） | `680–1,100 LOC`（estimated） |

task 1で両経路が死んだ場合は残り`16h`（estimated）へ進まずE-I01を発火する。
`12h`経過時に上限超過予測なら、live/generated adapter stubをS6へ残し、
S4はplayback stack、transport、preview/program、hashだけで閉じる。

### 9.4 S5 — EQ/FLX4/mode

S5冒頭にコードLOCと分離した固定bench block `4h`（contract）を置く。
F-B01/F-B03/F-B06/F-B07はblock内で完了し、F-B04/F-B09/F-B10はharness起動までを行う。

| task | 工数 | 差分 |
|---|---:|---:|
| **fixed F-B bench block** | `4.0h`（contract） | LOCへ算入しない |
| Gaussian pyramidと3-band reconstruction | `4.5h`（estimated） | `160–260 LOC`（estimated） |
| gain/kill/state hash/golden | `3.5h`（estimated） | `120–200 LOC`（estimated） |
| Web MIDI adapterと14-bit assembly | `3.5h`（estimated） | `140–220 LOC`（estimated） |
| FLX4 mapping、mixer wiring | `2.5h`（estimated） | `80–140 LOC`（estimated） |
| DJ/VJ grammarとstate-invariance test | `2.0h`（estimated） | `80–130 LOC`（estimated） |
| implementation subtotal | `16.0h`（estimated） | `580–950 LOC`（estimated） |
| total | `20.0h`（estimated） | `580–950 LOC`（estimated） |

LED outputとVJ modeのShift pad clear表示は切り順を事前発動し、S5で作らない。
EQ式、flat/kill、normal MIDI、preview/program、mode switch不変testは切らない。

S5 Doneは次のどちらかとする。

1. F-B03でkeepalive不要を確認し、通常MIDI acceptanceがgreen。
2. keepalive必須を確認してE-I04解錠ticketを起票し、FLX4を`limited`として通常MIDI以外の
   完了表記をしない。

SysEx実装と再試験をS5へ押し込まない。

### 9.5 S6 — source/parity integration

| task | 工数 | 差分 |
|---|---:|---:|
| collected/live bounded capture | `5.0h`（estimated） | `180–280 LOC`（estimated） |
| generated order/ready/arrival queue | `4.0h`（estimated） | `140–220 LOC`（estimated） |
| prep validationとprovenance/license metadata | `3.0h`（estimated） | `100–160 LOC`（estimated） |
| quantized launchとBeatState integration | `3.0h`（estimated） | `100–160 LOC`（estimated） |
| parity/replay/10-minute integration test | `4.0h`（estimated） | `140–220 LOC`（estimated） |
| reserve | `1.0h`（estimated） | — |
| total | `20.0h`（estimated） | `660–1,040 LOC`（estimated） |

`12h`経過時に上限超過予測なら、hosted provider実接続を切り、generated sourceは
fixture adapterだけにする。playback、collected、live、共通IF、hash/replayは切らない。

---

## 10. Escalation

本文の値はopen questionではなく、実装開始可能な仮置き判断である。次の実測条件が成立した場合だけ、
記載した代替案をレビュー票へ上げる。

### E-I01 — stack frame経路が対象Macで成立しない

発火条件:

- `decodeP95Ms > 16.7ms`（contract）、または
- `memoryCeilingBytes > 134,217,728B`（contract）、または
- Apple M1/Chromeのcompressed texture/transcode経路が利用不能。

代替順:

1. independent framesとindexed streamを入れ替えて同じ5値を再測定する。
2. GOPを`30 frames`以下（contract）へprepし直す。
3. frame count/resolution契約の変更票を起票する。
4. manifestの`fallbackResolution`を有効化し、RGBA8 `480×270`（contract）を
   `960×540`（contract）へupscaleする。

採用優先順位は1→2→4→3とする。4のframe payloadは
`480×270×4B×120=62,208,000B`（measured arithmetic）で既存上限内に収まる。
3はstack v0互換性を変えるため、実装側の独断で行わない。

### E-I02 — flat EQが原画一致しない

発火条件: 平均SSIM `0.999`未満、各frame `0.998`未満、または最大誤差
`2/255`超（すべてcontract）。

代替順:

1. colorspace、premultiply、edge、precisionを固定fixtureで分離する。
2. internal pass構成を変えて同じ式を再実装する。
3. spatial EQを無効化してS5を未完了とする。

閾値を下げてfreezeしない。

### E-I03 — replay archiveが上限を超える

発火条件: FLX4演奏を含む`60秒`fixture（contract）が、instrument/base-param binary
`18,720B/分`または完成archive `60,000B/分`（contract）を超える。

現行判断: §5.5の13-lane binary sampleとbase-param recordへlossless packingし、
control JSONからcontinuous instrument/base-param tupleを除く。X-04指定の9-lane
FLX4 fixtureは`53,480B/分`（calculated）、全13 laneとbase param最大rateを重ねた
global worst-caseは`59,720B/分`（calculated）である。

代替順:

1. lane maskとvalue encodingの実測byte数を再検証する。
2. instrument lane rateを下げる変更票を起票する。
3. 総量契約変更を起票する。

recording側だけのsample drop、lane別last-write-wins、live/replayで異なるrateは採用しない。

### E-I04 — FLX4がkeepaliveなしで停止する

発火条件: F-B03のno-keepalive条件で入力停止または切断が再現し、`200ms`
（measured Mixxx interval）条件で解消する。

代替:

- `sysex:true`を明示permissionとして追加し、benchを通ったmessage/intervalだけを送る。
- permission拒否時はFLX4をlimitedとして停止し、keys/ui producerを継続する。

F-B03証拠なしでSysExを先回り実装しない。F-B03で必須性が出た場合はE-I04解錠ticketを
S5とは別に起票し、SysEx実装と再試験をそのticketへ積算する。ticket完了までは
FLX4を`limited`とし、S5の20hへ押し込まない。

### E-I05 — jog感度またはlatencyがparityを満たさない

発火条件:

- F-B09 MIDI-to-photon p95が`50ms`超（contract）、または
- `0.25 frame/unit`（contract）で1-frame jog acceptanceを満たせない。

代替順:

1. sensitivity curveだけをF-B04 raw traceから再fitする。
2. canonical first-event dispatchとcoalescing境界を再測定する。
3. FLX4 transport対応をv0から外す。

2.5D orbitへ逃げない。

### E-I06 — mode switchでpixelが動く

発火条件: switch同tickのRenderSnapshot差分またはpixel diffが`1px以上`
（contract）。

代替:

1. controlGrammarがrenderer inputへ漏れたfieldを除去する。
2. MIDI adapter stateへgrammarを隔離し、semantic replay用eventだけを残す。
3. 2 mode acceptanceを未完了とする。

golden更新で差分を正当化しない。

### E-I07 — small parallaxでもdisocclusionが出る

発火条件: displacement `8px`以下（contract）で未定義pixel率が`0.5%`超（contract）。

代替順:

1. stack単位でparallaxを無効化しflat表示する。
2. max displacementを下げるstack metadataを再prepする。
3. layered depth/inpainting milestoneを別起票する。

3をv0へ混入させない。

### E-I08 — hosted generationが運用契約を満たさない

発火条件:

- queue込みp95がset運用で測定され、既定bar arrivalを継続的に逃す、または
- venue/public-performance licenseを確認できない。

代替:

1. generated sourceをfixture/local importだけへ制限する。
2. providerを交換し、同じStackSourceV0境界で再検証する。
3. generated sourceをv0から落とす。

空間周波数EQ、transport、playback sourceのfreezeを巻き戻さない。

### E-I09 — Sprint上限を超える

発火条件:

- S4/S5/S6の各`12h`時点（contract）で、各`20h`上限（contract）を超える予測が出る。

代替:

1. 各Sprint本文の切り順を実行する。
2. 未完了taskを次Sprintへ移し、完了表記をしない。
3. 上限変更票を起票する。

差別化の芯であるEQ式・flat/kill testを、周辺parityより先に削らない。
