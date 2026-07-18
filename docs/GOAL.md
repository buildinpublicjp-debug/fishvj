# FishVJ — Implementation Goal

> 2026-07-18、プロジェクトオーナーの `/goal` 指示により実装ゲートを開放。実装中。

## ゴール

音に反応するレイヤー式AI VJ「FishVJ」を、Vercelで動くURLとして完成させる。

## P0受け入れ条件

- [x] 音声ファイル再生と5帯域リアクションが動く
- [ ] BPM自動推定を音声ファイル再生へ接続する（現在は138 BPM基準位相）
- [x] キー1〜3でモード切替できる
- [ ] モード切替の2秒クロスフェード
- [x] 6/8/12分割のミラー万華鏡が効いている
- [ ] 時間フィードバック（前フレーム残像）
- [x] 生成した透過魚アトラスがFISH DECKへ追加される
- [ ] 実行中の画像生成結果がクリップ棚へ追加される
- [x] デモURLが存在する

## P1

- [x] マイクモード（echo cancellation / noise suppression / AGC無効）
- [x] 音声ファイル入力
- [x] 2,000匹個別GPUアニメーション
- [x] SCHOOL / GLIDE / WAVE / FLOAT
- [x] SPIRAL / VORTEX / WAVE / BLOOM + 1.5秒モーフ
- [x] MANDALA / FREE SWIMの1.2秒シーンモーフ
- [x] FREE SWIMのCRUISE / CURRENT / CROSS / DRIFT + 1.5秒モーフ
- [x] 個体別位相・速度差・尾のうねり・速度ベクトル追従
- [x] FISH SIZE 0.5x〜3.0x（魚数と独立）
- [x] CLEAN / PUNCH / ACID / DEEP + COLOR DRIVE
- [x] INFINITE DIVE + EXIT DIVE
- [x] SCHOOL RUSH + EXIT RUSH
- [x] 複数魚種の同時選択（最低1種を維持）
- [x] PERFORM 5ワンショット + 2ホールド + 同時押し
- [x] キーボード長押しフェーダー（MODE / COLOR / SPEED / DEPTH / SIZE）
- [x] MYSTIC〜SENSUAL〜EUPHORICの連続モーフ
- [x] ESCで全エフェクト解除 + INTRO復帰
- [x] BLACKOUT / RESET / FULLSCREEN
- [ ] ヒーロー魚GLB演出
- [ ] journey入力

## 実装ゲート

- status: `open`
- 開放根拠: プロジェクトオーナーの「`/goal` で実際に動くのを作っていって欲しい」
- 現在: Milestone 1の動作版を実装・検証中
