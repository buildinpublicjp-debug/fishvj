# FishVJ S5 — spatial EQ / Web MIDI / FLX4 mapping / 2-mode 検証記録

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-s5-eq-midi`（S4 #10 の上に stack） |
| 実施日 | 2026-07-23 |
| 対象 | INSTRUMENT_V1 §4 (spatial EQ) / §5 (FLX4 mapping) / §7 (mode) / §9.4 |

## 0. 主張と範囲

**空間周波数EQ（software reference）と Web MIDI adapter（14-bit + FLX4 map + curves + VJ/DJ pad + flush coalescing）を実装しテストした。EQ gain は instrument state に入り 8-tick ramp で hash 対象。**

- 実装（software、決定論・テスト済）: Gaussian pyramid 3-band EQ（§4）、gainQ16 piecewise + band kill、Flx4 adapter（§5.2/5.3/5.4）。
- **BLOCKED（hardware, §5.1 bench-gated）**: keepalive 必要性（F-B03）、SysEx、LED output、実機 FLX4 I/O・raw event rate/jitter/gap（F-B01〜11）。既定接続 `requestMIDIAccess({sysex:false})`・keepalive 無し設計を正とし、必要性が実機で再現するまで SysEx/keepalive/vendor message を実装しない（spec 通り）。
- **残件（software、次段）**: `instrument.bin` binary track（§5.5、X-04 amendment）。continuous instrument event + base param の lossless binary 化。archive byte 予算の再計算含む。EQ/MIDI の performance-facing 契約とは分離可能なため S6 前半へ回す。

## 1. 空間周波数EQ（§4）

`app/engine/instrument/eq.ts` — §4.4 の「software reference」そのもの。GPU shader はこの結果を変えない忠実 port（実描画は stack rendering 依存で hardware-gated）。

| 項目 | 実装 |
|---|---|
| pyramid | `G1=P(G0)`, `G2=P(G1)`。P = reduce（5-tap binomial `[1,4,6,4,1]/16`・mirror edge・2:1 downsample）→ expand（full res 再構成） |
| 3-band | `HI=G0-G1`, `MID=G1-G2`, `LOW=G2`, `O=clamp(gLOW·LOW+gMID·MID+gHI·HI)` |
| alpha | 周波数分解せず、再構成 RGB に元 alpha を適用（§4.1） |
| gain curve | `raw≤8192: raw/8192`、`else: 1+(raw-8192)/8191` → 0/8192/16383 = 0/1/2（§4.2） |
| band kill | raw 0 → gain 正確に 0。他 band/opacity/transport 不変（§4.3） |
| state | gLOW/gMID/gHI を deck ごとに `gainQ16` の 8-tick ramp で instrument state に保持（§4.2 hash は gainQ16） |

## 2. Web MIDI adapter（§5）

`app/engine/instrument/midi.ts` — raw message を validate し semantic event へ。

| 項目 | 実装 |
|---|---|
| 14-bit assembly | MSB(CC) + LSB(CC+0x20) を pair 化。片 byte 欠損は pair 破棄（前値と混ぜない、§5.4） |
| FLX4 map | §5.2 の tempo/channel fader/EQ HI/MID/LOW/crossfader/jog/play/cue/pad を deck A/B 判別で decode |
| curves | fader `x=raw/16383`、tempo `center 8192→rate 1.0` piecewise（§5.3） |
| pad | VJ: pad1-5 → mode/scene（§5.3 表）、DJ: pad → hot cue trigger、shift pad → clear |
| jog | 7-bit relative（center 0x40）→ `0.25 frame/unit` の Q16 frame。lane で符号付き加算、net 0 は drop（§5.4） |
| flush | 8Hz flush 境界で immediate → absolute lane（lane code 順・last-write-wins）→ jog（符号和）を emit。`lastRawSourceT` は診断のみ（recording/reducer/hash 非対象、§5.4） |
| grammar | mixer は DJ/VJ 不変（§7）。切替は operator console の `deck/setGrammar` 1 event |

## 3. 受入結果

### EQ acceptance（§4.4、software reference）

| test | 実測 |
|---|---|
| flat state（全 band gain 1）→ 原画一致 | max abs err ≤ 2/255（実測 ~1e-7、telescoping 恒等） ✅ |
| all kill → RGB 0 | 全 sample ≤ 1/255、alpha 差分 0 ✅ |
| single HI kill = reference | reference と一致、原画とは有意差 ✅ |
| determinism | 同 event/tick で完全一致 ✅ |

### MIDI / state

14-bit assembly・half-pair 破棄・crossfader/opacity/tempo map・last-write-wins・jog 符号和/net-0 drop・VJ/DJ pad・EQ state ramp を unit test（合計 11本）。

### CI / golden

| gate | 結果 |
|---|---|
| CI 5 gate（test:engine **35/35** = engine11+replay4+instrument9+s5 11。※s5内訳: EQ5+MIDI5+EQstate1） | 全 exit 0 |
| golden 再gate（render path 不変） | hash 131/131、mean SSIM 1.000000 / min 0.999998、PASS |

## 4. hardware-gated / 残件 一覧（S5分）

- **F-B bench block（§5.1, §9.4）**: keepalive 必要性・SysEx・LED・実機 I/O。実機 FLX4 必須。S5 Done は §9.4 の「通常MIDI acceptance green」で、SysEx/keepalive は必要性が出るまで未実装（正）。
- **`instrument.bin` track（§5.5）**: continuous instrument + base param の binary 化。S6 前半で実装予定（archive 予算 59,720B/分 の再計算込み）。
- **EQ の実 WebGL pass**: stack frame への適用は stack rendering（S4 で hardware-gated）に依存。math reference は実装済み。
