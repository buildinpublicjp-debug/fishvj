# FishVJ World Design — Independent F Review

> review date: 2026-07-22
>
> scope: `WORLD_SOURCE_V0` / `PERFORMANCE_MAP_V0` / `OUTPUT_SURFACES_V0` /
> `WORLD_PROOFS_V0` / `FISHVJ_INSTRUMENT_V2`
>
> result: F-W01〜F-W07 adopted and patched / active P0=0 / active P1=0

## F-W01 — bounded transport stateが一意でない

- priority: P0 / freeze blocker
- 壊れる具体シナリオ: 後方jogでplayheadだけを戻す実装とtick 0から再simulationする実装が、同じevent列から
  別entity stateを作る。非整数tempoの端数処理でもhashが分岐する。
- patch: `initialTick`、`Baseline(p)`、seek/reverse/loopのcanonical resimulation、Q32.32 tempo accumulatorを
  `WORLD_SOURCE_V0 §2.1/§3.5`へ固定した。`WORLD_PROOFS_V0 W-P05`へ60秒DJ transport fixtureを追加した。
- status: adopted / patched

## F-W02 — seedとPRNG substreamが二重定義

- priority: P1 / implementation gate
- 壊れる具体シナリオ: manifest seedを使う実装とsession overrideを使う実装、system IDのhash byte orderが異なる
  実装で、最初のspawnから軌道が分岐する。
- patch: `sessionSeedU64 = manifest.seed.valueU64`、override禁止、PCG-XSH-RR 64/32の定数・初期化・
  SHA-256先頭8B big-endian stream selectorを`WORLD_SOURCE_V0 §3.1–3.2`へ固定した。
- status: adopted / patched

## F-W03 — entity IDの比較規則がない

- priority: P1 / implementation gate
- 壊れる具体シナリオ: UTF-8辞書順、length-first、code point順の違いがneighbor/collision/transfer/hashの走査順を
  変え、boidsとportal ownershipが分岐する。
- patch: identityを`(systemIndexU8, spawnCounterU32)`、順序を数値tuple昇順、hash bytesを
  `u8 + little-endian u32`へ固定した。event文字列表現も固定した。
- status: adopted / patched

## F-W04 — 共有2,000B metadataのbyte数が実装依存

- priority: P1 / implementation gate
- 壊れる具体シナリオ: hashをhexで保存するwriterとraw 32Bで保存するwriterが、同じsessionを2,000B以下/超過へ
  別判定し、record開始可否が分岐する。
- patch: `world.dict` header、param entry、hash entry、little-endian、順序、CRC32、raw SHA-256を
  `WORLD_SOURCE_V0 §5.1`へ固定した。判定式を`UTF8(JCS(manifest))+world.dict ≤ 2,000B`へ一本化した。
- status: adopted / patched

## F-W05 — proof manifestを実装者が変更できる

- priority: P1 / implementation gate
- 壊れる具体シナリオ: phaseやdwell値を合格する値へ書き換えてもproofがgreenになる。存在しない`decay ticks`は
  判定不能である。
- patch: `fixtures/world/`へ各manifest/input/expectedを置き、JCS SHA-256を
  `WORLD_PROOFS_V0 §1`へpinした。water decayを
  `v(n+1)=floor(v(n)×61440/65536)`、初期値65536から139 ticksでzeroへ固定した。
- status: adopted / patched

## F-W06 — 死亡entityへのinvokeが未定義

- priority: P2 / backlog
- 壊れる具体シナリオ: validator後、reducer前にtarget entityが死亡するとerror/no-op/fallbackのいずれも可能になる。
- patch: reducer tickで不在なら`no-op + diagnostic`、semantic state/hash差0、fallback禁止を
  `WORLD_SOURCE_V0 §4`へ固定した。
- status: adopted / patched

## F-W07 — 複数伝播とmulti-blobが無証明

- priority: P2 / backlog
- 壊れる具体シナリオ: 同時waveが同一nodeへ到着した時の合成が実装ごとに異なり、単一trigger proofだけを
  greenにしても反応の連鎖でhashが分岐する。
- patch: first-arrival merge、origin event ID、queue順を`WORLD_SOURCE_V0 §3.6`へ固定した。
  pinned graph fixtureはnode 0/128同時triggerとnode 64/192のcollisionを検証する。pinned flower fixtureには
  2つの2×2 blobとregionごとの最低1 transitionを固定した。
- status: adopted / patched

## Patch audit

| gate | result |
|---|---|
| bounded state(p) / backward seek ambiguity | `0` |
| seed / substream derivation ambiguity | `0` |
| entity ordering ambiguity | `0` |
| metadata byte-layout ambiguity | `0` |
| unpinned W-P01〜W-P05 manifest | `0` |
| undefined dead-entity invoke | `0` |
| undefined simultaneous graph merge | `0` |
| active P0 | `0` |
| active P1 | `0` |

この監査は文書・fixtureの静的整合を閉じる。M1/16GB上のperformance、visual SSIM、実camera/projector
latencyはimplementation前のため`unverified`のままであり、proof実行時にのみgreenへ変更できる。
