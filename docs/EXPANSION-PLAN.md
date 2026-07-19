# FishVJ — Performance Expansion Plan

> Goal開始日: 2026-07-19  
> 目的: 魚素材と既存シーンを保ちながら、1画面から多数のルックを即興生成できるVJ楽器へ拡張する。

## 1. 体験の柱

1. **CORE** — 魚種・群れ・モード・色・奥行きを作る
2. **FX** — 同じシーンを8種類の連続エフェクトで変形する
3. **CUES** — 完成した状態を8枠へ保存し、滑らかに呼び戻す
4. **AUTO** — BPM基準でCUEを順番に進め、手を離しても展開を作る

右操作パネルは `CORE / FX / CUES` の3ビューとする。ライブ出力、PERFORMパッド、FISH DECKは常に残し、迷子にならない構造を維持する。

## 2. FX RACK

| FX | 見え方 | 実装 | 初期値 |
|---|---|---|---:|
| FEEDBACK | 前フレームが奥へ残り続ける | ping-pong履歴 + 有界max合成 | 0 |
| TWIST | 中心に近いほど渦状にねじれる | 極座標角度変形 | 0 |
| CHROMA | RGBが異方向へ分離する | 3点テクスチャサンプル | 0 |
| PIXEL | 画面が粗いデジタル格子になる | UV量子化 | 0 |
| RIPPLE | 水面・音波のように揺れる | 半径sin変形 | 0 |
| GLITCH | 横ブロックが瞬間的にずれる | 時間ハッシュUVシフト | 0 |
| ZOOM | 拍に合わせて吸引・押し出し | 中心UVスケール | 0 |
| MIRROR | 通常像から四方向反射へ変形 | UV fold | 0 |

- すべて0〜100%の連続値
- 複数FXを同時使用可能
- 黒背景を持ち上げず、白飛びは最終clampで防ぐ
- FEEDBACKだけ追加履歴パスを使い、その他は既存ポストシェーダーへ統合する

## 3. CUE BANK

8枠をF1〜F8へ割り当てる。

- `F1〜F8`: 呼び出し
- `Shift + F1〜F8`: 現在状態を保存
- 保存対象: SCENE / MODE / COLOR / SWARM / SWIM / FISH SIZE / SPEED / DEPTH / 8 FX
- 保存先: ブラウザのlocalStorage（端末ローカル）
- 初回は8種類のseed CUEを同梱
- 呼び出し時は連続値を設定時間で補間し、SCENE / SWARMは既存モーフ機構へ渡す
- MORPH TIME: 0.5〜8秒

seed CUE:

1. RITUAL — 基準の魚曼荼羅
2. ABYSS — 暗い深海と長い残像
3. ACID — 高彩度・色分離・波紋
4. OPEN SEA — 自由遊泳
5. VORTEX — 高速吸引
6. DIGITAL — Pixel / Glitch
7. BLOOM DROP — 放射とZoom
8. PRISM — Mirror / Chroma / Twist

## 4. AUTO PILOT

- `P`: ON / OFF
- `O`: 4 / 8 / 16拍を循環
- ON中は選択CUEの次を順番に呼び出す
- 手動F1〜F8操作で起点だけ更新し、AUTO自体は継続する
- ESCでAUTOと全FXを停止し、INTROへ戻す

## 5. Space FXレイヤー

- `Space + 1〜8`: 操作対象FXを選択
- `Space + ← / →`: 選択FXを連続減少 / 増加
- `Space + ↓ / ↑`: 選択FXを0% / 100%へ即時移動
- 通常時の矢印DEPTH / SPEED操作とはSpaceで明確に分離する
- 画面フォーカス喪失時は全保持キーを解除する

## 6. 性能契約

- 魚のCPU個体更新は増やさない
- FXは同じフルスクリーンポストシェーダーへ統合
- FEEDBACK ON時だけ履歴用HalfFloat render targetを2枚使用
- resize時は履歴を破棄して黒で再初期化
- 初期800匹で60fps、最大2,000匹で実用フレームレートを維持
- エフェクト値が0のときは見た目が従来版と一致する

## 7. 受け入れ条件

- [x] CORE / FX / CUESを1クリックで切替できる
- [x] 8 FXが0〜100%で独立・同時動作する
- [x] FEEDBACKが前フレームを使い、0%で完全停止する
- [x] F1〜F8呼出しとShift保存が動く
- [x] CUEが0.5〜8秒で連続モーフする
- [x] AUTOが4 / 8 / 16拍でCUEを進める
- [x] Space FXレイヤーが通常キーと衝突しない
- [x] ESCでAUTO / FX / 保持キーを全解除できる
- [x] 本番ビルドとサーバーレンダーテストが成功する
- [x] GitHubと公開URLへ反映する
