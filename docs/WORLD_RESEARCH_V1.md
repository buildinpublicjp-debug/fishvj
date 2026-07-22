# FishVJ World Capability Baseline v1

> 対象: `buildinpublicjp-debug/fishvj`
>
> 基準コミット: `2275308460f48d4031fa550fafc80e7b2611f900`
>
> 調査基準日: 2026-07-21
>
> status: frozen / primary-source review complete / X review P0=0 / implementation not started
>
> 規定強度: capability baseline=`hard`、作品別の見た目=`out of scope`

## 0. Z-01 — 製品方向の増築

オーナー判断（2026-07-21）により、FishVJはDJ/VJ映像楽器の操作系を維持したまま、
観客・空間・複数投影面に反応する生成世界を演奏素材として扱えるよう増築する。

- DJ/VJは引き続き**2つの操作文法**である。第3 modeは追加しない（hard）。
- `WorldSource`は両文法から演奏できる**source種別**である（hard）。
- 空間周波数EQは差別化の唯一の主語から、全sourceに効く固有operatorへ位置を変更する（hard）。
- 目標は他者の作品の複製ではなく、下表の能力クラスをFishVJ固有の素材・動詞・見た目で成立させること（hard）。
- 初回proof環境はApple M1 / 16GB、desktop Chromium、camera `1台`、projector `1台`
  （contract / unverified）。複数投影面は契約とoffscreen fixtureまでで、物理実装しない。

## 1. 一次情報から抽出した能力

本表は公式作品ページが明記する挙動だけを根拠にする。日付欄は作品の初出年または公式ページの
表記年、確認日は全件2026-07-21である。数値性能や内部実装は公式情報にないため推定しない。

| ID | 能力クラス | 一次情報で確認できる挙動 | FishVJで必要な最小抽象 |
|---|---|---|---|
| WC-01 | 身体で変形する場 | 人の存在と空間形状が粒子の流れへ影響し、軌跡が線になる（verified: [Circulating Universe of Water Particles, 2025](https://art.team-lab.cn/w/circulatinguniverse-waterparticles/)） | `SpaceState → field → particles/trails` |
| WC-02 | 生命周期 | 花が発生・成長・開花・枯死を反復し、接近・接触で状態が変わる（verified: [Flowers and People, 2014](https://art.team-lab.cn/en/w/flowerandpeople-tokyo/)） | tick駆動lifecycle + proximity/touch verb |
| WC-03 | 自律群・創発 | 数千規模の魚群が局所規則で動き、人の存在で移動・色が変わる（verified: [The Way of the Sea: Crystal World, 2018](https://art.team-lab.cn/en/w/wayofthesea-crystal/)） | stable entity IDs + neighborhood behavior + field response |
| WC-04 | 来場者素材の実体化 | 紙の絵をscanして水槽の生物にし、触れると逃げ、餌へ寄る（verified: [Sketch Aquarium, 2013](https://art.team-lab.cn/en/w/aquarium/living_digital_space/)） | collected asset → validated entity archetype → spawn |
| WC-05 | 反応の伝播 | 人の近傍から発火した光が隣接点へ伝わり、他者の伝播と交差する（verified: [Forest of Resonating Lamps, 2016](https://art.team-lab.cn/en/w/forest_of_resonating_lamps/)） | deterministic graph + propagation event |
| WC-06 | 境界越え | 作品が部屋を出て別作品へ入り、互いに影響し混ざる（verified: [teamLab Borderless Tokyo, current page](https://www.teamlab.art/e/tokyo/)） | surface graph + entity ownership transfer + shared tick |
| WC-07 | 複数人の共作 | 個々の人の存在が同じ世界へ影響し、他者の存在も変化を豊かにする（verified: [Flowers and People, current series page](https://art.team-lab.cn/zh-hant/w/flowersandpeople/)） | aggregate field + commutative multi-person influence |
| WC-08 | 世界同士の相互作用 | 魚群や鳥が別作品へ入り、花を散らすなど他systemへ作用する（verified: [teamLab: Continuity, 2020](https://art.team-lab.cn/en/e/asianart/)） | typed capability/verb routing between systems |

## 2. Minimum world parity

「同領域の演出を作れる」と表現するための最小集合を次に固定する。作品名、画風、構図、音、
キャラクター、文章を模倣する必要はなく、模倣してはならない。

| 能力 | v0判定 | 受入の種 |
|---|---|---|
| realtime生成であり、事前映像の単純loopではない | 必須 | fixed tickでworld stateが変化する |
| 人の存在・動きで場またはentityが変化する | 必須 | recorded SpaceState fixtureでhash一致 |
| 発生から消滅までのlifecycle | 必須 | flower proofで全phase到達 |
| 自律entity同士の局所相互作用 | 必須 | fish proofでstable neighbor response |
| 来場者由来assetの投入 | 必須 | fixture assetのhash検証とspawn |
| 反応の連鎖 | 必須 | graph proofで全nodeを一度ずつ通過 |
| 複数surface間の移動 | 契約必須 / 物理実装を落とす | offscreen A/B fixtureでtick一致 |
| 複数人の個体追跡 | v0では落とす | 8×8 aggregate fieldを正とする |
| 作品間のtyped interaction | 契約必須 / proofは2 system | capability不一致をvalidatorがreject |
| 物理LED、鏡、水、霧、床振動、香り | 落とす | software/projector契約外 |
| 数百台projectorの分散同期 | 落とす | single-process surface graphまで |
| 他作品の美術・ストーリー再現 | 禁止 | FishVJ deck/world固有assetだけを使う |

## 3. 設計へ渡す判定

### D-W01 — frame列だけでは能力集合を表せない

`stack`はbounded frame列として維持する。一方、WC-01〜08には長寿命entity、lifecycle、
相互作用field、surface ownershipが必要である。したがってstackを肥大化させず、
`ContentSource = StackSource | WorldSource`の直和にする（hard）。

### D-W02 — 3状態protocolを増やさない

外部producerが書く公開状態はfrozenのBeat/Space/Showの3状態に保つ。`WorldRuntime`は第4の
公開状態ではなく、EngineEventと3状態を読む決定論的simulation/render subsystemとする（hard）。

### D-W03 — 高速maskは意味stateを変えない

frozen replayは30Hzのsilhouette maskを記録しない。よってfast maskは表示上の局所変形にだけ使い、
spawn、death、surface移動、lifecycleなどhash対象stateを変えてはならない（hard）。意味stateは
記録済み8×8/5Hz SpaceStateだけから進める。これを破るsessionは`replayable:false`とする。

### D-W04 — 操作割当はcontentから分離する

sourceが「何をできるか」、controller profileが「どの物理操作を読むか」、performance mapが
「操作を何へ適用するか」を分離する（hard）。これにより同じfaderを全体、deck、system group、
選択entityへ向けられるが、1 gesture=1 eventは維持する。

### D-W05 — 複数面は同一世界のviewport

各projectorへ別動画を送るモデルではなく、全surfaceを同じworld tickのviewportとする（hard）。
entityは境界を跨ぐtickでowner surfaceを一度だけ変更し、複製しない。

## 4. 調査限界

- 公式ページは体験挙動を示すが、sensor構成、latency、GPU、entity数、network同期方式は
  `unverified`である。
- 本調査は能力の存在を確認したもので、FishVJが同じ規模・品質へ到達できることの証明ではない。
- v0のperformance値は[WORLD_PROOFS_V0](./WORLD_PROOFS_V0.md)でFishVJ側のcontractとして置き、
  実装時benchでmeasuredへ更新する。
