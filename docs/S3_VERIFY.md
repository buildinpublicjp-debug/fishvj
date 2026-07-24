# FishVJ S3 — CV v0（ソフト側）検証記録

| 項目 | 値 |
|---|---|
| 作業branch | `agent/fishvj-s3-cv`（S6 #12 の上に stack） |
| 実施日 | 2026-07-24 |
| 対象 | v2 §10（SpaceState CV v0） |

## 0. 主張と範囲

**CV v0 の固定経路（homography warp → RGB gain/bias → absdiff → threshold + 3×3 cleanup → 8×8 集約 → SpacePayload）を pure function の software reference として実装しテストした。frame ID と history ring も実装。**

- 実装（software、決定論・テスト済）: §10.1 の処理経路、§10.4 の 4点 homography 解、§10.2 の history ring、§10.5 の frame ID encode/decode。
- **BLOCKED（hardware, v2 §10.5/§10.6）**: 実 camera（getUserMedia / `requestVideoFrameCallback`）、projector、実 lag 実測（median/p95/jitter）、4点 calibration の click UI、§10.6 minimum acceptance（camera 30fps・p95 33ms・no-person 60秒・occluder IoU・lag ring 収まり・停止時継続）。**契約受入は主張せず「ソフト完成・実機受入待ち」で止める。**

## 1. 実装

| file | 役割 |
|---|---|
| `app/engine/cv/homography.ts` | 4点対応から projector-UV→camera-UV homography を DLT（8式・Gauss-Jordan）で解く、applyHomography |
| `app/engine/cv/space.ts` | rgbGainBias、absdiffGray、threshold、cleanup3x3（3×3 majority）、aggregate8x8（grid[64]/energy/silRatio = SpacePayload scalars）、encodeFrameId/decodeFrameId |
| `app/engine/cv/ring.ts` | 512×288 RGBA8・12 frame history ring（1 frame 589,824B / 12 frame 6.75MiB）、lag に対応する slot 選択、ring 超過は null（E-03 escalation） |

## 2. 受入結果（software reference）

| test | 実測 |
|---|---|
| homography 4隅厳密写像 | 4 corner を誤差 <1e-6 で写像、内点有限 ✅ |
| RGB gain/bias | channel 補正 + clamp ✅ |
| no-person（同一 frame）| residual occupancy energy 0 / silRatio 0 ✅ |
| 既知矩形 occluder | mask IoU ≥ 0.60（§10.6 基準）✅ |
| 8×8 集約 | 半被覆 frame で silRatio ≈128、full-on/off cell 正 ✅ |
| frame ID round-trip | tick 0/1/42/3600/65535 で一致 ✅ |
| history ring | lag slot 選択、ring 超過 → null ✅ |

## 3. 受入 gate

| gate | 結果 |
|---|---|
| CI 5 gate（test:engine **53/53** = ...+cv 7） | lint / tsc / test:engine / build / SSR 全 exit 0 |
| golden 再gate（render path 不変） | hash 131/131、mean SSIM 0.999999 / min 0.999998、PASS |

## 4. hardware-gated 一覧（S3分）

- 実 camera track（30fps）・`requestVideoFrameCallback` frame 検出
- projector 投影 + 実 lag 実測（§10.5 median/p95/jitter、10秒以上）
- 4点 calibration の operator click UI（§10.4）と device profile 保存
- §10.6 minimum acceptance 全項目（実機 Mac/projector/camera 必須）

`calibrationMode` の overlay 抑止・`canvas=projected pixels` 維持・BLACKOUT 中 SpaceState 非生成は frozen visual contract 側の規約（実 CV 稼働時に配線）。math reference と ring/frame-ID は本 sprint で実装済み。
