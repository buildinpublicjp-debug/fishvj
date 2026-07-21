# FishVJ World Proofs v0

> status: frozen / acceptance contract / X review P0=0 / implementation not started
>
> visual rule: capabilityを証明し、他作品の配色・構図・キャラクター・物語を再現しない

## 1. 共通fixture

### target

| item | value |
|---|---:|
| machine | Apple M1 / 16GB（contract / runtime unverified） |
| browser | desktop Chromium、versionはbench artifactへ保存（contract） |
| program viewport | `1920×1080`, DPR `1`（contract） |
| world internal | `960×540`（contract） |
| simulation | fixed `60Hz`（frozen contract） |
| camera/projector | 各`1台`（contract / model unverified） |
| semantic SpaceState | 8×8 + 2 scalar、最大`5Hz`（frozen contract） |
| fast CV | 512px width p95 `≤33ms`、失敗時256px（frozen contract） |

### common gates

各proofは次を全件満たす。

1. fixed seed + fixture Beat/Space/event trackの`60秒`runを2回行い、30 tickごとのworld/base hashが完全一致。
2. 同一machine/browser/GPUでgolden平均SSIM `≥0.995`、各frame `≥0.990`
   （frozen visual regression contract）。
3. declared entity/system/field capを超えず、NaN、integer overflow、duplicate entity IDが`0件`。
4. semantic input適用の次simulation tickまでにworld stateへ反映する。camera/projectorを含む
   end-to-end latencyは実測値をartifactへ記録し、未計測の合格値を創作しない。
5. `60秒`のprogram renderでworld update + submitのp95 `≤16.7ms`、present intervalのp95
   `≤20.0ms`、`>33.4ms` frameが`≤1%`（contract / unverified）。
   CV passは別clockでfrozen `≤33ms`を使う。
6. camera/CVを停止してもcontroller、mixer、preview/program、pure VJ/DJが継続。
7. replay archive `≤60,000B/分`。world/entity snapshotをarchiveへ入れない。

performance計測は`10秒 = 600 ticks` warm-up後の`60秒 = 3,600 ticks`を対象にする
（contract）。CPUはtick開始からprogram submit完了までとpresent間隔を別々に採取し、両方のp95を
報告する。利用可能なら`EXT_disjoint_timer_query_webgl2`のGPU timeも記録し、disjoint sampleは
除外件数と共にartifactへ残す。合否の`16.7ms`はCPU update+submit p95とpresent interval p95の
update+submitへ`16.7ms`、present intervalへ`20.0ms`と`>33.4ms ≤1%`を適用し、平均fpsだけで
代用しない。GPU timer非対応は`unverified`として空欄にする。

性能gateに失敗した場合はentity/field capを切り、固定tick、hash、single bus、UI visual contractを
削らない。

## 2. W-P01 — Flow Field / Water

### capability

観客位置が流れを分け、粒子の軌跡として見えることを証明する。物理流体simulationや既存作品の
水表現を再現するproofではない。

### fixture

| item | value |
|---|---:|
| particles | `2,048`（contract / target unverified） |
| field | `64×36 = 2,304 cells`（contract / target unverified） |
| trail history | `24 ticks`（contract / target unverified） |
| semantic input | zero grid 10s → center 2×2 occupied 20s → zero 30s（contract） |
| fast presentation | residual maskによるrenderer-only local warp（soft） |

### acceptance

- particle countは全tickで`2,048`。
- occupied sample適用後の最初のtickで、該当field cellのrepulsion Q16がnonzero。
- obstacle fixtureとzero fixtureのworld hashが最初の入力tickで分岐する。
- obstacle解除後、field impulseはmanifest decay ticksでexact zeroへ戻る。
- same fixture replayでparticle positions、field cells、PRNG counterのhash traceが完全一致。
- fast mask ON/OFFでsemantic world hash差`0件`。

## 3. W-P02 — Flower Lifecycle

### capability

長く留まる場所では生まれ育ち、動きが横切る場所では散る、時間を持った世界を証明する。

### fixture

| item | value |
|---|---:|
| entities | 最大`512`（contract / target unverified） |
| phases | `seed → bud → bloom → wither → dead`（contract） |
| field | `32×18 = 576 cells`（contract） |
| dwell input | 同じ2×2 grid、low energyを`300 ticks = 5s`（contract） |
| sweep input | 4 cell/semantic sampleで移動、high energyを`60 ticks = 1s`（contract） |

### acceptance

- zero-input `1,800 ticks = 30s`内に全5 phaseがhash対象stateとして少なくとも1回現れる。
- dwell fixtureの対象cellで`seed/bud→bloom` transition数がzero fixtureより多い。
- sweep sample適用後`12 ticks = 200ms`以内に対象cellのbloomの少なくとも1体が`wither`へ入る。
- entity capを超えるspawnはdeterministic rejectとなり、古いentityを暗黙削除しない。
- replayでphase、age、cell、spawn counterのhash traceが完全一致。

## 4. W-P03 — Collected Fish Ecosystem

### capability

来場者由来の1素材を検証して群れへ加え、身体から逃げ、餌へ寄ることを証明する。

### fixture

| item | value |
|---|---:|
| total fish | 最大`2,000`（existing FishVJ measured at 60fps; WorldRuntime path unverified） |
| collected asset | alpha付き`512×512` PNG 1件（contract） |
| asset validation | byte length + SHA-256 + dimensions + alpha coverage（contract） |
| group | built-in fish + collected species、stable IDs（contract） |
| viewer input | center 2×2 semantic grid occupied（contract） |
| feed input | `entity.attract` atomic verb 1 event（contract） |

### acceptance

- hash一致assetだけがspawn可能。hash不一致ではprogramを維持してload拒否。
- decoded formatはRGBA8 `512×512 = 1,048,576B`（measured arithmetic）。alpha>0 pixelが
  全pixelの`1%以上`、alpha=0 pixelも`1%以上`（contract）でなければfixtureをrejectする。
- collected speciesがmanifest groupへ最低`1体`spawnし、source asset hashがworld hashへ入る。
- viewer fixture適用後`12 ticks`以内に対象近傍魚の平均radial velocity Q16が外向きになる。
- feed verb適用後`60 ticks = 1s`以内に対象groupの平均distance Q16が適用直前より小さくなる。
- repelとattractを同tickへ入れたfixtureはrecorded event orderに従い、live/replayで一致。
- `2,000`で共通performance gateに失敗した場合、最低`800`までcapを下げて再測定し、
  measured capをmanifestへ固定する。`2,000`成功を偽装しない。

scan/UI/印刷工程は本proofに含めない。事前fixture assetを「来場者素材pipeline完成」と表記しない。

## 5. W-P04 — Cross-Surface Continuity

### capability

1つのworld entityがlogical surface AからBへ移り、別動画の切替ではなく同一個体の継続として
記録・再生できることを証明する。

### fixture

| item | value |
|---|---:|
| physical projector | `1`（contract） |
| offscreen surfaces | A/B各`480×540`（contract） |
| topology | A right ↔ B left、two-way portal 1件（contract） |
| entities | `200`（contract / target unverified） |
| duration | `120秒 = 7,200 ticks`（contract） |

### acceptance

- transfer tickでsource ownerから消え、destination ownerへ同じentity IDが1回だけ現れる。
- 全tickで`count(A)+count(B)=200`、duplicate/lost ID `0件`。
- position、velocity、age、group、PRNG substreamがtransfer前後で連続。
- world hash traceは2回runとreplayで完全一致。
- surface Bにcamera inputを暗黙複製せず、Bのsemantic gridはzero。
- このproofの成功を「2台projector同期済み」と表記しない。

## 6. capability coverage

| world capability | proof |
|---|---|
| field deformation / trails | W-P01 |
| lifecycle | W-P02 |
| autonomous group | W-P03 |
| collected entity | W-P03 |
| propagation graph | W-P01後の追加fixture `graph-256` |
| multi-surface ownership | W-P04 |
| multi-person aggregate | recorded 8×8 multi-blob fixtureをW-P01/02へ追加 |
| cross-system interaction | W-P03 fish collision → W-P02 scatterの2-system fixture |

`graph-256`は256 nodesをringへ配置し、1 triggerがnodeを各1回通過してoriginへ戻ることを
hashで確認する（contract / target unverified）。cross-system fixtureはfish groupのtyped
`entity.scatter` capabilityだけをflower groupへ届け、名前推測をしない。

## 7. 実行順と停止条件

1. W-P01: field/particle kernel。
2. W-P02: lifecycle kernel。
3. graph-256: propagation。
4. W-P03: boids + collected asset。
5. cross-system fixture。
6. W-P04: surface ownership。

各proofは前proofのhash/performance gateがgreenになるまで開始しない。切る順はW-P04 physical拡張、
cross-system fixture、graphのvisual polish、W-P03 entity cap、W-P02 flower cap、W-P01 particle cap。
hash、replay、camera fallback、1 gesture=1 eventは切らない。

## 8. Escalation

- **E-T01 — performance gate超過**: entity/field/trail capを順に下げ、最低合格capをmeasuredで固定する。
- **E-T02 — 5Hz semantic inputで反応が粗い**: fast presentationをsoft追加する。意味stateを30Hz maskで
  更新しない。必要ならWORLD_SOURCE E-W05を発火する。
- **E-T03 — fish 800未満**: WorldRuntime boids proofを不合格とし、既存FishCanvasを成功根拠に代用しない。
- **E-T04 — 2-system interactionが曖昧**: capability/bindingを減らし、暗黙の名前変換を追加しない。
