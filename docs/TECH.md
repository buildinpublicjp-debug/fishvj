# FishVJ — 技術選定 / TECH

> SPEC.md の実装方針。3h制約での最適化が全判断の基準。
> 決定: **Three.js で確定**（2026-07-18）

## スタック決定

| 領域 | 採用 | 理由 |
|---|---|---|
| 描画 | Three.js | InstancedMesh / EffectComposer / Codex学習量。3hで事故らない |
| アプリ | Vite + vanilla TS | 状態が少なくReactは過剰。描画ループとDOM UIを分離 |
| UI | DOMオーバーレイ（Resolume風ダークCSS） | r3f混在リスク回避 |
| デプロイ | Vercel（静的 + /api serverless） | HTTPS自動（getUserMedia要件）、APIキー秘匿 |
| 画像生成 | gpt-image-1 via /api/generate-image | **background: "transparent" で魚スプライト直生成** |
| 演出設計 | GPT-5.6 via /api/journey | 自然言語 → 演出JSON（structured output） |
| 音解析 | Web Audio 素書き | 4バンド+オンセットは自前で書ける量 |
| 保険lib | Meyda / realtime-bpm-analyzer | 詰まったら30分で差し替え可 |

## 描画詳細

### 魚群（Layer 2）
- `InstancedMesh` + PlaneGeometry、5,000〜10,000インスタンス
- インスタンス属性: phase / speciesIndex / scale / hueShift
- 頂点シェーダーで泳ぎのうねり（sin波 + phase）
- テクスチャ: スプライトアトラス（魚種 = アトラス内index）
- 動き: curl noise フィールド + ビート位相で収縮/リリース

### 曼荼羅（Layer 3）
- 生成リング画像の放射配置 + **万華鏡パスが実質の曼荼羅生成器**
- 雑な魚群でも万華鏡を通すと即曼荼羅化 = 画のコスパの核

### ポストFXチェーン（EffectComposer）
1. RenderPass
2. KaleidoPass（自作ShaderPass 約20行、分割数uniform: 6/8/12）
3. AfterimagePass（フィードバック/残像）
4. UnrealBloomPass（発光）
5. RGBShift + 彩度/色相（最終色調、モードのhue rangeここで適用）

### パフォーマンス / 8K
- canvas解像度は上限キャップ（プロジェクタ実解像度 x devicePixelRatio）
- Bloomは半解像度レンダーターゲット
- M系Macなら1万インスタンス + 4K canvasは余裕圏

## 生成パイプライン

```
[client] 生成リクエスト（モード別プロンプト or journey入力）
   → POST /api/generate-image { prompt, transparent: true }
   → [vercel fn] OpenAI Images (gpt-image-1, background: "transparent", 1024px)
   → PNG返却 → createImageBitmap → THREE.Texture
   → クリップ棚に追加（サムネイル + クリックでLayer 3/4へ）
   → 16拍ごとに棚から自動投入も
```

- レイテンシ 10〜20s/枚 → クライアントはキュー管理 + 生成中表示（「新しい魚が生まれています…」）
- **最重要保険: シード素材同梱**
  - 事前生成の魚スプライト15〜20枚 + 曼荼羅リング数枚をrepoに同梱
  - 起動直後からリッチ、API生成は「棚が増える演出」として上乗せ
  - → OpenAI APIはデモの必須依存ではなく加点要素になる

## 音解析詳細

- AudioContext: mp3直結（本線） / getUserMedia（constraints全false）
- AnalyserNode fftSize 2048 → 4バンド（SPEC参照）
- オンセット: バンドエネルギーの移動平均比 + 閾値
- BPM: キックオンセット間隔の中央値、70-180クランプ、倍/半分補正
- 位相: 直近オンセット時刻 + BPM から 0-1 を毎フレーム算出
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
- audio→render のインターフェースは `BeatState { bpm, phase, kick, snare, hihat, vocal, energy, bands }` を最初に型で凍結

## 3hタイムライン

| 時間 | 作業 |
|---|---|
| 0:00-0:20 | スキャフォールド: Vite+TS+Three、レンダーループ、mp3再生、Analyser骨格、BeatState型凍結 |
| 0:20-1:10 | コア映像: 背景シェーダー + 魚群Instanced + 万華鏡/Bloom（「本気の映像」ライン） |
| 1:10-1:40 | ビートエンジン: オンセット/BPM/位相 + 楽器マッピング接続 |
| 1:40-2:10 | 3モード + 2秒lerpクロスフェード + Resolume風UIパネル |
| 2:10-2:40 | 生成パイプライン + クリップ棚 + 16拍自動投入 |
| 2:40-3:00 | Vercelデプロイ / README / デモ動画キャプチャ |

## リスクと対策

- 生成APIレート/遅延 → シード同梱で無害化
- 会場マイク事故 → mp3直結が本線、マイクは加点デモ
- 4K+Bloomでfps落ち → Bloom半解像度 + 解像度スケールのスライダーを仕込む
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

1. **WebGPU移行**（ブラウザ継続）: Three.js WebGPURenderer差し替えでコード大半が生存。compute shaderで8K級負荷に対応
2. **Syphon連携**（プロ現場合流）: macOSフレーム共有規格Syphonに出力 → FishVJをResolumeのソースとして流し込める。競合ではなく「AI生成レイヤー」として上流部品化。※ブラウザから直接不可の可能性大 → Electron化 or ネイティブ薄ラッパー要検証
3. **Metalネイティブ**（最終形）: Swift/Metal + GLSL移植 = VDMXと同構成。8K/60fpsの最確実路線。魚曼荼羅レイヴ実開催の段で着手

推奨順序: 1 → 2、3は実イベント実開催のタイミングで。

要外部検証: WebGPUのM系チップ8K実効fps / SyphonのWeb側出力可否
