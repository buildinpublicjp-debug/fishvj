# FishVJ — Implementation Goal

> 2026-07-18、プロジェクトオーナーの `/goal` 指示により実装ゲートを開放。実装中。

## ゴール

音に反応するレイヤー式AI VJ「FishVJ」を、Vercelで動くURLとして完成させる。

## P0受け入れ条件

- [x] 音声ファイル再生と5帯域リアクションが動く
- [ ] BPM自動推定を音声ファイル再生へ接続する（現在は138 BPM基準位相）
- [x] キー1〜3でモード切替できる
- [ ] モード切替の2秒クロスフェード
- [ ] Feedback + 万華鏡が効いている
- [x] 生成した透過魚アトラスがFISH DECKへ追加される
- [ ] 実行中の画像生成結果がクリップ棚へ追加される
- [ ] デモURLが存在する

## P1

- [x] マイクモード（echo cancellation / noise suppression / AGC無効）
- [x] 音声ファイル入力
- [x] 2,000匹個別GPUアニメーション
- [x] SCHOOL / GLIDE / WAVE / FLOAT
- [x] CLEAN / PUNCH / ACID / DEEP + COLOR DRIVE
- [x] INFINITE DIVE + EXIT DIVE
- [x] BLACKOUT / RESET / FULLSCREEN
- [ ] ヒーロー魚GLB演出
- [ ] journey入力

## 実装ゲート

- status: `open`
- 開放根拠: プロジェクトオーナーの「`/goal` で実際に動くのを作っていって欲しい」
- 現在: Milestone 1の動作版を実装・検証中
