# FishVJ — 技術選定 / TECH

> SPEC.md の実装方針。3h制約での最適化が全判断の基準。
> 決定: **Three.js で確定**（2026-07-18）

## スタック決定

| 領域 | 採用 | 理由 |
|---|---|---|
| 描画 | Three.js | InstancedMesh / EffectComposer / Codex学習量。3hで事故らない |
| アプリ | Vinext + React + TypeScript | Sites配布互換のVite基盤を使い、描画ループはReact外のThree.jsへ分離 |
| UI | DOMオーバーレイ（Resolume風ダークCSS） | r3f混在リスク回避 |
| デプロイ | OpenAI Sites（Cloudflare Worker互換） | HTTPSと公開導線を確保。画像生成API追加時もサーバールートでキーを秘匿 |
| 画像生成 | 素材種別による2系統ルーティング via /api/generate-image | 魚=`gpt-image-1.5`透明、曼荼羅/背景=`gpt-image-2`指定アスペクト |
| 演出設計 | GPT-5.6 via /api/journey（stretch goal） | 自然言語 → 演出JSON（structured output）。本番URL/録画確保後のみ |
| 音解析 | Web Audio 素書き | 5帯域+オンセットは自前で書ける量 |
| 保険lib | Meyda / realtime-bpm-analyzer | 詰まったら30分で差し替え可 |

## 描画詳細

### 魚群（Layer 2）
- `InstancedBufferGeometry` + 分割Plane、初期値800・上限2,000インスタンス
- 魚数は実行時スライダーで変更し、会場マシンの60fps実測後に増やす
- インスタンス属性: offset / phase（0〜2π）/ species / scale / motion / velocity（±30%）
- 横12分割・縦2分割Planeを頂点シェーダーで尾側ほど大きく変形
- テクスチャ: 4×2の透過8魚種スプライトアトラス
- 個体進行方向は約0.11秒前との位置差から求め、数フレーム分を平均した接線方向へ追従
- 同一層の速度を16%だけ共通ペースへ寄せ、個体差を残した簡易整列とする
- 魚種別の移動倍率はSCHOOL 1.16 / GLIDE 1.02 / WAVE 0.76 / FLOAT 0.58。全体SPEEDへ乗算し、群泳は速く漂流魚は遅くする
- 尾振り周期はSCHOOL 1.25 / GLIDE 0.55 / WAVE 0.86 / FLOAT 0.42。移動速度と別係数にして、GLIDEは直進、WAVEは全身うねり、FLOATは低周波の上下漂流を強める
- リング間隔の約10%に相当する半径ゆらぎを個別位相で加える
- キック時は軌道を先送りし、進行方向への押し出しと魚体の伸びを同時に加える
- FISH SIZEは魚数と独立したuniform。0.5x〜3.0x、初期1.5xで旧表示比約2.5倍
- Planeはカメラ視線追従とし、旋回時のedge-on消失を防ぐ

### SWARM構造
- `MODE`（感情）/ `COLOR`（配色）/ `SWARM`（群れ構造）は独立した3軸
- SPIRAL: 6層を保った螺旋移動
- VORTEX: 6層を半径60〜70%へ圧縮し、外周だけalpha fade
- WAVE: 基準扇形内を横断する波状帯
- BLOOM: 中心から外周へ放射し、外縁で消えて再生成
- 切替時は旧座標生成器と新座標生成器の結果を1.5秒で補間
- 4構造とも基準半扇形だけを描画し、同じ万華鏡コピーを通す

### SCENE / FREE SWIM
- `SCENE`を最上位軸とし、MANDALAとFREE SWIMをキー0またはUIで1.2秒モーフする
- MANDALAは基準半扇形から6/8/12方向へミラーコピーし、FREE SWIMは万華鏡を外して全個体を直接描画する
- FREE SWIMでは個体が左右両方向から画面を横断し、進行方向は約0.11秒前との位置差へ追従する
- FREE SWIMの構造はCRUISE / CURRENT / CROSS / DRIFT。既存SWARMと同じ座標補間基盤を使い1.5秒で切り替える
- CRUISEは層状巡航、CURRENTは2本の海流、CROSSは対向群の交差、DRIFTは広い蛇行漂流
- SCHOOL RUSHはFREE SWIM専用の速度倍率として働き、キックの尾振り・前方伸長も維持する

### 2.5Dカメラ
- 汎用スプラインは作らず、時間ベースの固定 `sin/cos` とモード別パラメータだけで駆動
- MYSTIC: 緩い沈降 / SENSUAL: 緩い旋回 / EUPHORIC: 急上昇・魚群突入・曼荼羅吸引
- ドロップ検出でEUPHORICの移動速度を一時加速
- 実装10分timebox。`cameraMotionEnabled` で即時OFFにし、静止カメラへ復帰可能にする

### ヒーロー魚GLB（条件付きLayer 4）
- タイマー開始前に見た目とブラウザ読込を確認済みのseed 1体だけを使用
- 外部テクスチャ/追加デコーダ不要の静的GLBとし、起動時にロードして通常は非表示
- ドロップ時の表示・移動・回転だけを当日実装。GLB未完成または疎通未確認なら関連コードごとdrop
- 第三者image-to-3Dの事前生成seedであり、OpenAIによるライブ生成とは説明しない

### 曼荼羅（Layer 3）
- 生成リング画像の放射配置 + **万華鏡パスが実質の曼荼羅生成器**
- 雑な魚群でも万華鏡を通すと即曼荼羅化 = 画のコスパの核

### 実装済みポストFXチェーン
1. 魚と黒背景をHalfFloatのrender targetへ描画
2. 基準半扇形をミラーし、6/8/12方向へ回転コピー
3. 半径層ごとの差動回転と色相オフセット
4. 8近傍・高閾値の選択的Bloom（明るい魚だけを滲ませる）
5. 黒レベルを保つcontrast / saturation / hue / color preset

時間Feedbackは将来項目として残し、Milestone 1では60fpsと魚の可読性を優先して未実装。

### FeedbackPass
- 前フレーム用ping-pong render targetはAfterimagePassの構造を流用し、汎用フィードバック基盤は作らない
- 旧フレームUVへzoom 0.97〜0.99 / rotate 0.2〜0.5度、色へ微hueshiftを適用
- 旧フレームへdecayを掛けた後、`clamp(max(current, mix(current, feedback, amount)), 0, 1)` の有界構成で合成。無制限の加算合成は禁止
- ビート位相でzoom/rotationを脈動させ、ドロップ時だけzoomを一時的に深くする
- MYSTIC=浅く遅く / SENSUAL=回転強め / EUPHORIC=深いzoom + 速い色相回転
- 実装10分timebox。`feedbackEnabled` で即時OFF、超過/不安定時はstock AfterimagePassへ復帰

### パフォーマンス / 8K
- 初期値は出力領域サイズ、devicePixelRatio上限1、魚800体
- 2,000体 + INFINITE DIVE、および2,000体 + FREE SWIM / EUPHORIC / SCHOOL RUSHで60fpsをブラウザE2E実測済み
- canvas解像度はプロジェクタ実解像度を上限キャップ
- 解像度スケールと魚数を実行時スライダーで調整
- Bloomは半解像度レンダーターゲット
- 60fps実測後だけ解像度と魚数を段階的に上げる。4K/8K性能はハッカソン後に検証

## 生成パイプライン

```
[client] 生成リクエスト（kind + モード別プロンプト or journey入力）
   → POST /api/generate-image { kind, prompt, projectorAspect }
   → [vercel fn] kindで固定ルーティング
      ├─ fish: gpt-image-1.5 / background:"transparent" / 1024x1024
      └─ mandala|background: gpt-image-2 / API制約内でprojectorAspectに合わせたsize
   → 画像返却 → createImageBitmap → THREE.Texture
   → クリップ棚に追加（サムネイル + クリックでLayer 3/4へ）
   → 16拍ごとに棚から自動投入も
```

- `gpt-image-2` のsizeは最大辺3840px、両辺16pxの倍数、縦横比3:1以内、総画素数655,360〜8,294,400の範囲でプロジェクタ比率へ丸める
- 生成は複雑なプロンプトで最大2分を見込む。クライアントは同時1リクエスト、キュー/タイムアウト表示、失敗後もseed再生継続
- Vercelの4.5MB応答上限対策: 1枚/リクエスト、3h版はlow quality、`gpt-image-2` は圧縮形式を優先し、本番経路で応答サイズを実測
- `gpt-image-1.5` は透明背景要件のため採用するがDeprecated。開始前の利用可否確認を必須とし、停止時は透明seedのみで継続
- **最重要保険: シード素材同梱**
  - 事前生成の魚スプライト15〜20枚 + 曼荼羅リング数枚をrepoに同梱
  - 起動直後からリッチ、API生成は「棚が増える演出」として上乗せ
  - → OpenAI APIはデモの必須依存ではなく加点要素になる

## 音解析詳細

- AudioContext: mp3直結（本線） / getUserMedia（constraints全false）
- AnalyserNode fftSize 2048 → 5帯域（kick 30-100Hz / bass 100-250Hz / mid 250Hz-2kHz / high 2k-6kHz / hihat 6k-12kHz）
- オンセット: バンドエネルギーの移動平均比 + 閾値
- BPM: キックオンセット間隔の中央値、70-180クランプ、倍/半分補正
- 本線mp3は既知BPM（予定138）を保持。推定安定前または信頼度低下時は既知値、手動復旧はタップテンポ
- 位相: 直近オンセット時刻 + BPM から 0-1 を毎フレーム算出
- `vocalLead`: 200Hz-3kHzの持続エネルギーによるproxy。汎用歌声分離ではなくデモ曲向け閾値
- 詰まったら: Meyda(spectralFlux) / realtime-bpm-analyzer に差し替え

## リポジトリ構成（並列CC境界）

```
fishvj/
├── src/
│   ├── audio/      # セッションB担当（解析・BPM・検出）
│   │   ├── engine.ts
│   │   ├── bands.ts
│   │   └── beat.ts
│   ├── render/     # セッションA担当（Three.js全部）
│   │   ├── scene.ts
│   │   ├── fish.ts
│   │   ├── mandala.ts
│   │   └── post.ts
│   ├── modes.ts    # 3モードパラメータ定義（共有・先に確定して凍結）
│   ├── ui/
│   └── main.ts
├── api/
│   ├── generate-image.ts
│   └── journey.ts
├── public/seeds/   # 同梱シード素材
└── README.md       # Codex Session ID / GPT-5.6利用説明 必須
```

- 並列CCは2セッションまで。src/audio と src/render で境界分離、同一ファイル同時編集禁止
- audio→render のインターフェースは `BeatState { bpm, phase, kick, snare, hihat, vocalLead, energy, bands }` を最初に型で凍結。`bands` は kick/bass/mid/high/hihat の5帯域

## 3hタイムライン

| 時間 | 作業 |
|---|---|
| 0:00-0:20 | スキャフォールド: Vite+TS+Three、レンダーループ、mp3再生、Analyser骨格、BeatState型凍結 |
| 0:20-1:05 | コア映像: 背景シェーダー + 魚群Instanced + 万華鏡/Bloom + 性能スライダー + 2.5Dカメラ/Feedback差し替え（各最大10分）。事前疎通済みならヒーロー魚GLB |
| 1:05-1:30 | ビートエンジン: 5帯域/オンセット/BPM/位相 + 楽器マッピング接続 |
| 1:30-1:55 | 3モード + 2秒lerpクロスフェード + Resolume風UIパネル |
| 1:55-2:20 | 2系統生成パイプライン + クリップ棚 + 16拍自動投入 |
| 2:20-3:00 | **機能凍結**。Vercelデプロイ / README / デモ動画キャプチャ / 提出 |

- `Describe the journey` はコア完成・本番URL・デモ動画確保後に時間が残った場合だけ着手

## リスクと対策

- `gpt-image-1.5` Deprecated/利用停止 → 事前疎通 + 透明seedへ自動フォールバック
- 生成APIレート/最大2分遅延/Organization Verification → 本番アカウント事前疎通 + 同時1件 + seed同梱
- Vercel 4.5MB応答上限 → low quality/圧縮形式/1枚ずつ + 本番経路でサイズ実測
- 会場マイク事故 → 開始前に許可と入力を確認し、UIがgreenの場合だけ切替。mp3直結が本線
- 4K+Bloomでfps落ち → 1080p/2,000体開始 + Bloom半解像度 + 解像度/魚数スライダー
- 2.5Dカメラで画面酔い/Plane消失/時間超過 → 振幅制限 + billboard + 10分timebox + `cameraMotionEnabled` OFF
- Feedback白飛び/実装超過 → 有界mix/max+clamp + 10分timebox + `feedbackEnabled` OFF + stock AfterimagePass復帰
- ヒーロー魚GLB未完成/読込失敗 → 機能全体を無条件drop。本線レイヤーへ依存させない
- 並列CCマージ事故 → ファイル境界 + BeatState先行凍結
- Vercelデプロイ詰まり → ローカル `vite preview` + ngrok系を最終フォールバックに

## 実VJソフトの技術構成（質疑対策 + ロードマップ根拠）

- Resolume: C++自社エンジン + OpenGL/DirectX。動画クリップ合成特化
- TouchDesigner: C++ + ノードベース、エフェクト実体はGLSL。プロのトリップ系映像の主流
- VDMX: Obj-C/Metal。エフェクトは ISF（GLSLシェーダー + JSONメタデータ）規格
- Synesthesia: シーン ≈ GLSLシェーダー + 音反応パラメータ注入
- Notch: C++/DirectX リアルタイム3D（大規模ツアー演出）

**抽出される構造: アプリ言語はバラバラだが「トリップ感」の正体は全部GLSL。WebGLは同じGLSLが動く = 絵作りの表現力でブラウザとResolumeに差はない。差はガワ（動画デコード・出力管理・8Kパイプライン効率）。**

質疑「Resolumeと何が違う?」回答: Synesthesiaと同じGLSL+音反応の土俵に立った上で、(1)感情の方向を指定できる (2)素材棚がAIで自動増殖する、の2点が既存に無い。

参考資源: ISF（interactive shader format）/ Shadertoy のシェーダー資産はGLSLなのでWebGLへ移植容易。トリップ系の定番: フィードバックループ / kaleidoscope / raymarching fractal / domain warping。

## 8Kロードマップ（ハッカソン後）

1. **WebGPU移行**（ブラウザ継続）: アプリ状態・音解析・シーン設計は再利用。WebGL向けGLSL/ShaderPass/EffectComposerはTSL/WGSL等への移植検証対象。compute shaderで8K級負荷に対応
2. **Syphon連携**（プロ現場合流）: macOSフレーム共有規格Syphonに出力 → FishVJをResolumeのソースとして流し込める。競合ではなく「AI生成レイヤー」として上流部品化。※ブラウザから直接不可の可能性大 → Electron化 or ネイティブ薄ラッパー要検証
3. **Metalネイティブ**（最終形）: Swift/Metal + GLSL移植 = VDMXと同構成。8K/60fpsの最確実路線。魚曼荼羅レイヴ実開催の段で着手
4. **ライブimage-to-3D**: 実イベント開催時に、その日水揚げされた魚の画像を3D化してヒーロー魚へ投入。ハッカソン当日は対象外

推奨順序: 1 → 2、3/4は実イベント実開催のタイミングで。

要外部検証: WebGPUのM系チップ8K実効fps / SyphonのWeb側出力可否

## PERFORM / 複数魚種選択（実装済み）

- FISH DECKは8魚種の複数選択に対応し、最後の1種は解除できない。選択状態は2つの`vec4` uniformへ渡し、GPU側で対象魚を同時に強調する。
- STROBE / RUSH / SCATTER / HUE FLIP / KALEIDO BURSTは開始時刻だけをReact stateへ記録し、強度包絡をレンダーループで計算する。再トリガーは時刻を上書きするため安全にリスタートできる。
- RUSHとSCATTERは既存の個体座標・速度方向を変形し、HUE FLIP / STROBE / KALEIDO BURSTは既存ポストFXへ合成する。新しい描画パスやCPU個体更新は増やさない。
- `Shift`のSLOW-MOは描画時間のみ0.3倍、`Tab`のBLACKOUTは保持中のみ表示を遮断する。keyup / window blur / ESCで必ず解除する。
- ESCはパッドタイマーを全破棄し、INTRO（MANDALA / MYSTIC / PUNCH / 800匹 / SPIRAL）へ即時復帰する。
