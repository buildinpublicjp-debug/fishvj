# FishVJ Design Review Board

> 対象: `docs/SPEC.md` / `docs/TECH.md`
> 最終更新: 2026-07-18
> 設計フェーズ: completed（R-013〜R-027判断済み。実装ゲート開放）
> 採否ルール: 設計管理者は起票と推奨まで行い、プロジェクトオーナーの確認なしに `adopted` へ変更しない。

## Status

- `open`: 未判断
- `adopted`: 採用済み。SPEC/TECHへの反映先を記録する
- `rejected`: 棄却済み。理由を一行で記録する
- `needs-info`: 判断材料待ち

## 判断基準

1. 3時間で完成すること
2. 90秒デモの価値を最大化すること
3. OpenAI審査4軸（技術実装 / 完成した体験 / インパクト / 新規性）
4. 8Kロードマップとの整合

## 一覧

| ID | status | 優先度 | 要旨 | 推奨 |
|---|---|---:|---|---|
| R-001 | adopted | P0 | 現行画像モデルと透過魚スプライト要件が両立しない | adopt |
| R-002 | adopted | P0 | 生成APIの待ち時間・利用条件・応答サイズがデモ前提として未検証 | adopt |
| R-003 | adopted | P0 | 3h計画に出荷バッファがなく、journey機能も工数計上されていない | adopt |
| R-004 | adopted | P1 | `high`帯域上限とハイハット検出帯域が矛盾している | adopt |
| R-005 | adopted | P1 | ボーカル検出の表現が実装予定のヒューリスティックより強い | adopt |
| R-006 | adopted | P0 | 本線MP3に決定論的なBPM同期フォールバックがない | adopt |
| R-007 | adopted | P0 | 90秒本番中のマイク切替が許可・入力・フィードバック事故を招く | adopt |
| R-008 | adopted | P0 | 1080p出力に4K canvas、最大1万魚を初期値とする前提が過大 | adopt |
| R-009 | adopted | P2 | WebGPU移行時にカスタムGLSL/ポストFXが大半そのまま生存する保証はない | adopt |
| R-010 | adopted | P1 | 3モードへ2.5Dカメラパスを追加する | adopt（範囲限定） |
| R-011 | adopted | P2 | ヒーロー魚GLBを1体seed同梱する | adopt（事前完了条件） |
| R-012 | adopted | P1 | AfterimagePassを変換付きFeedbackPassへ差し替える | adopt（範囲限定） |
| R-013 | adopted | P0 | 完成画像内の魚と、個別に動く魚インスタンスの契約が未定義 | adopt（範囲限定） |
| R-014 | adopted | P0 | 全魚を個別に動かしつつライブ生成素材を追加するGPU構成が未定義 | adopt（上限付き） |
| R-015 | adopted | P0 | 任意画像の背景除去まで3h版へ含めると生成・品質リスクが拡大する | adopt（透過生成に限定） |
| R-016 | adopted | P1 | 生成から奥行き配置・ライブ出力までの最小操作契約が未定義 | adopt（プリセット中心） |
| R-017 | rejected | P0 | Codex app-serverを本番画像生成バックエンドとして使う案は用途不一致 | reject |
| R-018 | rejected | P1 | iPhoneを遠隔マイクとして接続する案は3h版の通信範囲を超える | reject（3h版） |
| R-019 | adopted | P1 | 参考画像のような高彩度・高コントラストを安全に作る色調整が不足 | adopt（軽量マクロ） |
| R-020 | adopted | P1 | 魚種図鑑から素材を選び群れへ投入する操作が未定義 | adopt（seed図鑑） |
| R-021 | adopted | P1 | 魚種が増えても泳ぎ方が一種類では個体差が伝わらない | adopt（4泳動型） |
| R-022 | adopted | P1 | 無限落下・再帰トンネルを明示的に呼び出す演出がない | adopt（既存機能のプリセット） |
| R-023 | adopted | P0 | 生成した完成画像と実時間レンダーの到達点が混同されている | adopt（再構成契約） |
| R-024 | adopted | P1 | 現行PlaneGeometryでは魚体のうねりに必要な頂点数と素材向きが未定義 | adopt（分割Plane） |
| R-025 | adopted | P0 | 装飾円を除き、群れ構造を独立切替できる必要がある | adopt（4 SWARM） |
| R-026 | adopted | P0 | 剛体回転ではなく個体が泳いで見える運動が必要 | adopt（個体GPU泳動） |
| R-027 | adopted | P1 | 魚の可読サイズとVORTEXの密度を現場調整できない | adopt（独立SIZE + 層圧縮） |
| R-028 | adopted | P0 | 曼荼羅と自由遊泳を独立sceneとして切り替える | adopt（2 SCENE） |
| R-029 | adopted | P1 | 魚種ごとの速度と揺れが同じテンポに見える | adopt（motion分離） |
| R-030 | adopted | P0 | frozen SpacePayloadへsurface IDを暗黙追加していた | adopt（profile routing） |
| R-031 | adopted | P0 | world loadとperformance map選択がatomicでない | adopt（2 hash payload） |
| R-032 | adopted | P0 | world param targetとu16量子化が5B replay recordに閉じない | adopt（compound dictionary） |
| R-033 | adopted | P0 | system kernel/config不在でworld hashが挙動を固定しない | adopt（versioned kernels） |
| R-034 | adopted | P0 | World output形式が共通EQ/mixerへ接続不能 | adopt（linear premultiplied RGBA8） |
| R-035 | adopted | P0 | worldのbounded/continuous timelineが未定義 | adopt（timeline union） |
| R-036 | adopted | P1 | asset memory gateにbyte上限とdecoded算術がない | adopt（2段ceiling） |
| R-037 | adopted | P1 | p95計測が平均fpsで代用できる | adopt（warm-up + 3,600 tick） |
| R-038 | adopted | P0 | bounded worldのseek/tempoからstateが一意に決まらない | adopt（Baseline + Q32.32） |
| R-039 | adopted | P1 | manifest/session seedとPRNG substream導出が曖昧 | adopt（seed一本化） |
| R-040 | adopted | P1 | composite entity IDのcanonical順序がない | adopt（numeric tuple order） |
| R-041 | adopted | P1 | shared 2,000B metadataのbinary layoutがない | adopt（world.dict） |
| R-042 | adopted | P1 | proof fixtureがcontent hashでpinされていない | adopt（pinned fixtures） |
| R-043 | adopted | P2 | 死亡entityへのinvokeが未定義 | adopt（no-op + diagnostic） |
| R-044 | adopted | P2 | 複数graph伝播とmulti-blobに機械判定がない | adopt（dual trigger + 2 blob） |
| R-045 | adopted | P0 | continuous worldへactive DJ transportを表示していた | adopt（VJ-only disabled panel） |
| R-046 | adopted | P1 | world time scaleをBPM表示しbounded seek意味論がUIから読めない | adopt（倍率 + Baseline label） |

## 指摘詳細

### R-001 — 現行画像モデルと透過魚スプライト要件が両立しない

- status: `adopted`
- source: 設計管理者レビュー + OpenAI公式Docs確認
- priority: P0
- 対象: `SPEC.md`「生成レイヤー」、`TECH.md`「スタック決定」「生成パイプライン」
- 指摘: TECHは `gpt-image-1` と `background: "transparent"` に依存しているが、`gpt-image-1` は現行カタログでDeprecated。一方、現行の `gpt-image-2` は透明背景をサポートしない。
- 影響: 単純なモデル更新では魚スプライトに背景が付き、現行モデルへ更新しなければ利用停止・可用性リスクを抱える。
- 推奨（起票時）: `adopt`。3h版は透過魚を同梱seedへ固定し、ライブ生成は背景・曼荼羅リングなど不透明でも成立する素材を `gpt-image-2` で生成する。透過魚のライブ生成はハッカソン後の背景除去パイプライン検証項目に分離する。
- 採用内容: オーナー修正により2系統化。魚は `gpt-image-1.5` + transparent、曼荼羅リング/背景は `gpt-image-2` + プロジェクタ比率。seed保険を維持。`gpt-image-1.5` のDeprecatedリスクは事前疎通とseed fallbackで受容する。
- 反映先: `SPEC.md`「生成レイヤー」「事前準備チェックリスト」、`TECH.md`「スタック決定」「生成パイプライン」「リスクと対策」
- 棄却理由: —
- 根拠:
  - https://developers.openai.com/api/docs/models/gpt-image-2
  - https://developers.openai.com/api/docs/guides/image-generation
  - https://developers.openai.com/api/docs/models/gpt-image-1.5

### R-002 — 生成APIの待ち時間・利用条件・応答サイズがデモ前提として未検証

- status: `adopted`
- source: 設計管理者レビュー + OpenAI/Vercel公式Docs確認
- priority: P0
- 対象: `SPEC.md`「生成レイヤー」「事前準備チェックリスト」、`TECH.md`「生成パイプライン」「リスクと対策」
- 指摘: TECHは生成レイテンシを10〜20秒と断定しているが、公式Docsは複雑なプロンプトで最大2分の可能性を示す。またGPT ImageはOrganization Verificationが必要な場合があり、Vercel Functionsには4.5MBのリクエスト/レスポンス上限がある。
- 影響: 90秒中に生成が完了しない、当日にAPIが使えない、base64画像応答が上限超過する、の三経路でOpenAI賞の核が見えなくなる。
- 推奨（起票時）: `adopt`。事前チェックに「本番アカウントで1枚生成成功」「利用モデル・IPM・Organization Verification確認」「本番経路で応答サイズ計測」を追加する。デモは生成完了を必須にせず、1リクエストずつ・低品質圧縮形式・タイムアウト表示・seed継続を契約にする。
- 採用内容: 推奨どおり。両モデルの本番経路疎通、同時1件、最大2分想定、low quality/圧縮、Vercel応答サイズ実測、失敗時seed継続を設計契約に追加。
- 反映先: `SPEC.md`「事前準備チェックリスト」、`TECH.md`「生成パイプライン」「リスクと対策」
- 棄却理由: —
- 根拠:
  - https://developers.openai.com/api/docs/guides/image-generation
  - https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions

### R-003 — 3h計画に出荷バッファがなく、journey機能も工数計上されていない

- status: `adopted`
- source: 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「3モード」「実装優先順位」、`TECH.md`「3hタイムライン」
- 指摘: デプロイ・README・動画キャプチャに最後の20分しかなく、失敗時の切替時間がない。さらに `Describe the journey`、structured output、JSON検証、演出反映の工数がタイムラインに明示されていない。
- 影響: コア映像が動いても提出物が完成しないか、journey実装が全体を押して「動かないもの」になる。
- 推奨（起票時）: `adopt`。2:20を機能凍結、残り40分をデプロイ・README・動画・提出に固定する。journeyはコア完成・本番URL・録画成功後だけ着手するstretch goalにし、未実装でも3モードでコンセプトを説明可能にする。
- 採用内容: 推奨どおり。2:20機能凍結、40分出荷枠、journeyのstretch goal化。
- 反映先: `SPEC.md`「3モード」「実装優先順位」、`TECH.md`「スタック決定」「3hタイムライン」
- 棄却理由: —

### R-004 — `high`帯域上限とハイハット検出帯域が矛盾している

- status: `adopted`
- source: 設計管理者レビュー
- priority: P1
- 対象: `SPEC.md`「帯域分解」「楽器・声の検出」、`TECH.md`「音解析詳細」
- 指摘: 4バンドの `high` は2k〜8kHzだが、ハイハット条件は6k〜12kHz。4バンド値だけを使う実装では8k〜12kHzを評価できない。
- 影響: `BeatState` と検出ロジックの契約が曖昧になり、並列セッション間で異なる実装が生まれる。
- 推奨（起票時）: `adopt`。`high` を2k〜12kHzへ統一するか、ハイハットだけFFT binの6k〜12kHzを直接集計すると明記する。3hでは前者を推奨。
- 採用内容: オーナー指定により `high` を2k〜6kHzへ変更し、`hihat` 6k〜12kHzを独立帯域として追加。解析契約を5帯域化。
- 反映先: `SPEC.md`「帯域分解」「楽器・声の検出」、`TECH.md`「音解析詳細」「リポジトリ構成」
- 棄却理由: —

### R-005 — ボーカル検出の表現が実装予定のヒューリスティックより強い

- status: `adopted`
- source: 設計管理者レビュー
- priority: P1
- 対象: `SPEC.md`「楽器・声の検出」「デモ設計」、`TECH.md`「音解析詳細」
- 指摘: 200Hz〜3kHzの持続エネルギーだけではボーカルとリード、パッド、ギター等を分離できない。現仕様は「ボーカル検出」と断定している。
- 影響: 質疑で技術実装を過大表示と見られるほか、デモ曲の別楽器で中央開花が誤発火する。
- 推奨（起票時）: `adopt`。信号名と説明を「vocal/lead proxy（中域持続エネルギー）」へ正確化し、Suno曲のチャント区間で成立する閾値を事前調整する。汎用の歌声分離は3h版の対象外と明記する。
- 採用内容: 推奨どおり。仕様表記と `BeatState` を `vocalLead` proxyへ変更。
- 反映先: `SPEC.md`「楽器・声の検出」「デモ設計」、`TECH.md`「音解析詳細」「リポジトリ構成」
- 棄却理由: —

### R-006 — 本線MP3に決定論的なBPM同期フォールバックがない

- status: `adopted`
- source: 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「BPM同期」「Suno事前生成トラック」、`TECH.md`「音解析詳細」「リスクと対策」
- 指摘: キック間隔推定だけではイントロ、ブレイク、倍テン/半テン誤判定で位相がずれる。本線は事前生成した固定曲なのに、その既知BPMを利用する保険がない。
- 影響: 90秒の見せ場で曼荼羅回転・ドロップ演出が拍から外れ、完成体験が大きく落ちる。
- 推奨（起票時）: `adopt`。同梱曲には既知BPM（予定138）をメタデータとして持たせ、推定が安定するまで、または信頼度低下時は既知値で位相駆動する。タップテンポは手動復旧経路として残す。
- 採用内容: 推奨どおり。既知138 BPM fallbackとタップテンポ復旧を追加。
- 反映先: `SPEC.md`「BPM同期」、`TECH.md`「音解析詳細」
- 棄却理由: —

### R-007 — 90秒本番中のマイク切替が許可・入力・フィードバック事故を招く

- status: `adopted`
- source: 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「入力2系統」「デモ設計」、`TECH.md`「リスクと対策」
- 指摘: デモ終盤の10秒で初回マイク許可、入力デバイス選択、会場音量、ハウリング/フィードバックまで同時に賭けている。
- 影響: 成功している本線デモを最後に止め、締めの印象を悪化させる可能性がある。
- 推奨（起票時）: `adopt`。開始前に許可と入力確認を済ませ、UIにgreen状態が出た場合だけ切り替える。未確認または不安定なら90秒本編では切り替えず、質疑用の保険へ回す。
- 採用内容: 推奨どおり。事前確認 + green gate、不安定時は質疑へ退避。
- 反映先: `SPEC.md`「デモ設計」「事前準備チェックリスト」、`TECH.md`「リスクと対策」
- 棄却理由: —

### R-008 — 1080p出力に4K canvas、最大1万魚を初期値とする前提が過大

- status: `adopted`
- source: 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「解像度」、`TECH.md`「魚群」「パフォーマンス / 8K」「リスクと対策」
- 指摘: SPECの「1080pなら4K canvasで十分」は出力以上の負荷をかけ、TECHの1万インスタンス + 4K + 多段ポストFX「余裕圏」は実測根拠がない。
- 影響: 初期状態からfpsが落ち、音反応とモード遷移の体感が損なわれる。性能調整で3hを消費する。
- 推奨（起票時）: `adopt`。当日既定値を出力実解像度、devicePixelRatio上限1、魚2,000体、Bloom半解像度にする。60fps実測後だけ段階的に増やし、4K/8Kはロードマップとする。
- 採用内容: オーナー修正を加えて採用。初期値1920x1080 / DPR上限1 / 2,000体。解像度スケールと魚数を実行時スライダーにし、会場実測で上げる。
- 反映先: `SPEC.md`「解像度」「実装優先順位」「事前準備チェックリスト」、`TECH.md`「魚群」「パフォーマンス / 8K」「3hタイムライン」「リスクと対策」
- 棄却理由: —

### R-009 — WebGPU移行時にカスタムGLSL/ポストFXが大半そのまま生存する保証はない

- status: `adopted`
- source: 設計管理者レビュー
- priority: P2
- 対象: `TECH.md`「8Kロードマップ」
- 指摘: Three.jsのシーン構造・状態・音解析は再利用しやすいが、WebGL向けShaderPass、GLSL、EffectComposerチェーンはWebGPU移行時にTSL/WGSL等への移植や別経路が必要になり得る。
- 影響: 「Renderer差し替えでコード大半が生存」という表現のままでは、8Kロードマップの工数を過小評価する。
- 推奨（起票時）: `adopt`。生存範囲を「アプリ状態・音解析・シーン設計」に限定し、「カスタムシェーダーとポストFXは移植検証対象」と明記する。ハッカソン実装方針は変更しない。
- 採用内容: 推奨どおり。再利用範囲と移植検証範囲を分離。
- 反映先: `TECH.md`「8Kロードマップ」
- 棄却理由: —

### R-010 — 3モードへ2.5Dカメラパスを追加する

- status: `adopted`
- source: 外部レビュー（Claude）
- priority: P1
- 対象: `SPEC.md`「3モード」「デモ設計」、`TECH.md`「魚群」「3hタイムライン」
- 提案: 魚Planeへ奥行きを持たせ、MYSTIC=緩い沈降、SENSUAL=うねる旋回、EUPHORIC=急上昇/魚群突入/曼荼羅吸引のカメラパスを追加。ドロップ時にカメラを加速する。
- 評価: 視差とカメラ運動は少ないアセット追加でトリップ感とモード差を強め、90秒デモへの費用対効果が高い。ただし現タイムラインのコア映像枠は0:20〜1:05の45分であり、回転カメラではPlaneのbillboard対応、frustum/clipping、画面酔いの調整が必要になるため「無条件に数十行」とは見なさない。
- 推奨: `adopt（範囲限定）`。3h版はスプライン/汎用カメラシステムを作らず、時間ベースの `sin/cos` とモード別固定パラメータだけに限定する。10分timebox、振幅上限、即時OFF可能なcamera motionフラグ、魚Planeの視線追従を受入条件とし、超過時は静止カメラへ戻す。
- 理由: 完成確率を守る停止条件を付ければ、低い追加コストで90秒デモの奥行きとモード差を大きく増やせる。
- 採用内容: 条件付き承認。10分timebox、OFFフラグ、固定数式の範囲に限定して採用。
- 反映先: `SPEC.md`「レイヤースタック」「3モード」「実装優先順位」「デモ設計」「事前準備チェックリスト」、`TECH.md`「魚群」「2.5Dカメラ」「3hタイムライン」「リスクと対策」
- 棄却理由: —

### R-011 — ヒーロー魚GLBを1体seed同梱する

- status: `adopted`
- source: 外部レビュー（Claude）
- priority: P2
- 対象: `SPEC.md`「レイヤースタック」「デモ設計」「事前準備チェックリスト」、`TECH.md`「描画詳細」「3hタイムライン」「8Kロードマップ」
- 提案: 事前にimage-to-3Dで魚1体をGLB化してrepoへseed同梱し、ドロップ時に巨大魚が曼荼羅中心を突き抜ける見せ場へ使う。ライブimage-to-3Dは当日対象外とし、実イベント時のロードマップへ置く。
- 評価: seed扱いならAPI障害と生成待ち時間がなく、ドロップの明確なヒーローモーメントになる。一方、GLB読込、マテリアル/ライティング、座標・スケール調整を当日始めると独立項目ではなくなり、第三者3D生成をOpenAIライブ生成と誤認させない説明も必要。
- 推奨: `adopt（事前完了条件）`。タイマー開始前にGLBの見た目とブラウザ読込を単体確認し、外部テクスチャ/追加デコーダ不要、静的1メッシュ、既存ポストFXで成立する状態なら採用する。当日はロード済みモデルの表示・移動・回転だけに限定し、未完成ならコードごとdropする。
- 理由: 完全に事前完了できれば本線から独立した高インパクト演出になり、間に合わない場合も無損失で切れる。
- 採用内容: 事前完了条件付きで採用。GLB未完成またはブラウザ疎通未確認なら関連機能を無条件drop。
- 反映先: `SPEC.md`「レイヤースタック」「デモ設計」「事前準備チェックリスト」、`TECH.md`「ヒーロー魚GLB」「3hタイムライン」「リスクと対策」「8Kロードマップ」
- 棄却理由: —

### R-012 — AfterimagePassを変換付きFeedbackPassへ差し替える

- status: `adopted`
- source: 外部レビュー（Claude）
- priority: P1
- 対象: `SPEC.md`「レイヤースタック」「BPM同期」「3モード」「実装優先順位」「デモ設計」「事前準備チェックリスト」、`TECH.md`「ポストFXチェーン」「3hタイムライン」「リスクと対策」
- 提案: 前フレームをzoom 0.97〜0.99、rotate 0.2〜0.5度、微hueshiftしてから現フレームへ合成し、ビート位相とドロップで変換量を駆動する。MYSTIC=浅く遅く、SENSUAL=回転強め、EUPHORIC=深いzoom + 速い色相回転。
- 評価: 無限トンネル/吸い込みは90秒デモのトリップ感に直結し、AfterimagePassの前フレーム用ping-pong構造を流用すれば差し替えコストを抑えられる。ただし単純なShaderPassだけでは前フレーム保持にならず、`current + previous * 0.95` の加算も定常的な白飛びを保証なく防げない。
- 推奨: `adopt（範囲限定）`。AfterimagePassのdual-buffer構造をforkし、旧フレームUVへzoom/rotate、色相へ小変換を加える。合成はboundedなmix/max + clampで行い、モード別固定uniformとビート接続だけに限定する。10分timebox、`feedbackEnabled` OFF、超過/不安定時はstock AfterimagePassへ戻す。
- 理由: 安定合成と即時fallbackを条件にすれば、工数純増を抑えながらカメラパスと相乗する強い吸い込み表現を得られる。
- 採用内容: 推奨どおり採用。有界mix/max+clamp、10分timebox、OFFフラグ、stock AfterimagePass fallbackを実装契約とする。
- 反映先: `SPEC.md`「レイヤースタック」「BPM同期」「3モード」「実装優先順位」「デモ設計」「事前準備チェックリスト」、`TECH.md`「ポストFXチェーン」「FeedbackPass」「3hタイムライン」「リスクと対策」
- 棄却理由: —

### R-013 — 完成画像内の魚と、個別に動く魚インスタンスの契約が未定義

- status: `adopted`
- source: プロジェクトオーナー追加要件
- priority: P0
- 対象: `SPEC.md`「生成レイヤー」「レイヤースタック」、`TECH.md`「魚群」「生成パイプライン」
- 指摘: 一枚の完成画像に複数の魚が描かれている場合、その内部の魚は一枚のPlaneとして一緒にしか動かせない。「見えている魚がそれぞれ泳ぐ」体験には、魚を一個体ずつ透過素材として扱い、各表示個体へ独立した変換・泳動パラメータを持たせる契約が必要。
- 影響: 契約が曖昧なままだと、生成画像を重ねただけの平面的な映像になり、オーナーが求める個体感・奥行き・トリップ感に届かない。
- 推奨: `adopt（範囲限定）`。3h版では魚生成を「全身一体・重なりなし・透明背景」のクリップに限定し、画面上の各魚はそのクリップから作る独立インスタンスと定義する。背景・曼荼羅・完成コンセプト画像は別レイヤーとし、完成画像からの自動物体分解は対象外にする。
- 理由: 素材単位を明確にすれば、既存の2.5D/InstancedMesh方針のまま全個体の運動を実現でき、画像分割という不確実な追加処理を避けられる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-014 — 全魚を個別に動かしつつライブ生成素材を追加するGPU構成が未定義

- status: `adopted`
- source: プロジェクトオーナー追加要件 + 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「駆動レイヤー」「解像度」、`TECH.md`「魚群」「生成パイプライン」「パフォーマンス / 8K」
- 指摘: 2,000個体をCPU側で個別更新したり、魚ごとにMesh/Materialを作るとdraw callとフレーム更新負荷が増える。一方、現TECHの静的スプライトアトラスだけでは、実行中に生成された新しい透過魚を群れへ追加する方法が定義されていない。
- 影響: 「全部動く」を素直に実装すると60fpsを失うか、ライブ生成魚が棚に入るだけで実際の魚群へ反映されない。
- 推奨: `adopt（上限付き）`。seed魚群2,000体は既存アトラスを使う単一InstancedMeshとし、位置・奥行き・大きさ・位相・速度・旋回量をインスタンス属性として頂点シェーダーで個別駆動する。ライブ生成クリップは素材ごとに小規模なInstancedMesh群を追加し、同時表示素材数と各群の個体数に上限を設ける。全個体は動くが、同一素材の個体はテクスチャを共有してよい。
- 理由: 一個体ごとの見え方と動きの差を保ちつつ、draw callとCPU更新を素材数に比例する範囲へ抑えられる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-015 — 任意画像の背景除去まで3h版へ含めると生成・品質リスクが拡大する

- status: `adopted`
- source: プロジェクトオーナー追加要件 + 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「生成レイヤー」、`TECH.md`「生成パイプライン」「リスクと対策」
- 指摘: 魚を自由に奥行き配置するには透明背景が必須だが、任意の完成画像・アップロード画像に対する汎用背景除去は、輪郭欠け、半透明の鰭、発光縁、処理待ち時間の検証を追加する。現設計は `gpt-image-1.5` の透明生成を前提にしており、背景除去サービスは含まれていない。
- 影響: 背景が残ればPlaneの四角形が見え、トリップ感より合成の粗さが目立つ。汎用背景除去を追加すれば3h完成確率が下がる。
- 推奨: `adopt（透過生成に限定）`。3h版は魚を最初から透明PNGで生成し、alpha有無・透明辺・被写体占有率だけを受入検査する。不合格は再生成せずseedへフォールバックする。任意画像の背景除去と手動マスクはロードマップへ分離する。
- 理由: 見た目を壊す素材を確実に排除しながら、追加モデル・サービス・編集UIを本線へ持ち込まずに済む。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-016 — 生成から奥行き配置・ライブ出力までの最小操作契約が未定義

- status: `adopted`
- source: プロジェクトオーナー追加要件
- priority: P1
- 対象: `SPEC.md`「生成レイヤー」「実装優先順位」、`TECH.md`「生成パイプライン」「3hタイムライン」
- 指摘: 現設計は「棚をクリックしてレイヤーへ差し込み」までしか定義しておらず、試写、奥行き、動き、誤操作からの復旧が不明。先に作成した高密度UI案をそのままP0にすると、タイムライン、3Dギズモ、多数のスライダーが3h制約を破る。
- 影響: 映像が良くても、生成結果をどこへ置き、いつ本番へ出すかが直感的でなければ完成した体験にならない。
- 推奨: `adopt（プリセット中心）`。3h版は `GENERATE → PREVIEW → PLACE → LIVE` の一方向フロー、`FRONT / MID / DEEP / TUNNEL` の奥行きプリセット、`AUTO-SWIM`、`REMOVE/UNDO`、`BLACKOUT` だけを操作契約にする。生成完了時は安全なMIDへ仮配置し、LIVE前に必ずPREVIEWを通す。タイムライン編集と自由な3Dギズモはロードマップへ送る。
- 理由: 5秒で理解できる操作感と安全なライブ運用を、少ない画面要素で成立させられる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-017 — Codex app-serverを本番画像生成バックエンドとして使う案は用途不一致

- status: `rejected`
- source: プロジェクトオーナー追加要件 + OpenAI Codex公式マニュアル確認
- priority: P0
- 対象: `SPEC.md`「アーキテクチャ」、`TECH.md`「スタック決定」「生成パイプライン」
- 指摘: Codex app-serverはCodexのリッチクライアントを作るための認証・会話履歴・承認・エージェントイベント用インターフェースであり、Vercel公開アプリの画像生成APIとして使うものではない。公式マニュアルも一般のOpenAI API呼び出しにはPlatform API keyを使い、app-serverを共有・公開ネットワークへ直接露出しないよう案内している。
- 影響: app-serverを本番依存にすると、ローカルCodex環境・認証・常駐プロセス・WebSocketをVercelデモへ持ち込み、既存の安全な `/api/generate-image` 設計を壊す。
- 推奨: `reject`。先のUIモックアップに表示した「Codex App Server CONNECTED」は設計要件にせず、既存TECHどおりVercel FunctionからOpenAI Image APIを呼ぶ。Codexは開発・設計・実装支援として使い、実行時生成経路とは分離する。
- 理由: 既存のVercel serverless経路の方が3h、APIキー秘匿、公開URLの条件を同時に満たす。
- 採用内容: —
- 反映先: —
- 棄却理由: —
- 根拠:
  - https://learn.chatgpt.com/docs/app-server.md

### R-018 — iPhoneを遠隔マイクとして接続する案は3h版の通信範囲を超える

- status: `rejected`
- source: プロジェクトオーナー追加要件 + 設計管理者レビュー
- priority: P1
- 対象: `SPEC.md`「音声解析」「デモ設計」、`TECH.md`「音解析詳細」「リスクと対策」
- 指摘: iPhoneで同じURLを開いて `getUserMedia` することと、iPhoneの音声解析結果をMac側の投影画面へ送ることは別機能。後者には端末ペアリング、ネットワーク通信、切断復旧、遅延処理、認証またはルーム管理が必要になる。
- 影響: 会場Wi-Fiと遠隔通信を90秒デモの入力経路へ加えると、既にP1のマイクモードがP0全体を不安定にする。
- 推奨: `reject（3h版）`。3h版は出力端末自身の `getUserMedia` をP1として維持する。Macの入力デバイス一覧にiPhoneマイクがOS機能で現れ、事前疎通できた場合だけ通常の入力デバイスとして利用する。iPhone companionページから解析値だけを送る遠隔入力はハッカソン後のロードマップとする。
- 理由: 音反応の見え方は既存の5帯域・BPM・ドロップ連動で十分に示せ、遠隔接続を切っても作品価値を失わない。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-019 — 参考画像のような高彩度・高コントラストを安全に作る色調整が不足

- status: `adopted`
- source: プロジェクトオーナー追加要件（参考画像2点）
- priority: P1
- 対象: `SPEC.md`「レイヤースタック」「3モード」、`TECH.md`「ポストFXチェーン」「3hタイムライン」
- 指摘: 参考画像の「パキッとした色」は彩度だけでなく、深い黒、強いコントラスト、色相分離、発光量の制御で成立している。現TECHの最終色調はRGBShift・彩度・色相のみで、黒レベルやコントラストをオペレーターが安全に調整する契約がない。
- 影響: 単純に彩度やBloomだけを上げると白飛び・色潰れ・Feedback残像の飽和が起き、参考画像の明瞭さではなく濁った映像になる。
- 推奨: `adopt（軽量マクロ）`。最終段にGPUの `ColorGradePass` を1つ置き、`COLOR DRIVE` マクロと `CLEAN / PUNCH / ACID / DEEP` の4プリセットを提供する。内部パラメータは exposure / contrast / saturation / hue / black point / bloom mix に限定し、各3モードの基準値へオペレーター補正を加算する。`RESET` と安全な上下限を必須にし、個別スライダーを常時露出する高度なカラー編集UIは3h版の対象外にする。
- 理由: 既存の最終色調パスを小さく拡張するだけで、参考画像に近い鮮烈さとモード横断の現場調整を低工数で得られる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-020 — 魚種図鑑から素材を選び群れへ投入する操作が未定義

- status: `adopted`
- source: プロジェクトオーナー追加要件（魚種・犬種一覧の参考画像3点）
- priority: P1
- 対象: `SPEC.md`「生成レイヤー」「レイヤースタック」、`TECH.md`「生成パイプライン」「3hタイムライン」
- 指摘: 現設計のクリップ棚は生成順のサムネイル一覧であり、魚種から選ぶ操作や複数種を混ぜる操作がない。参考画像の価値は分類された多数の選択肢を一目で比較できる点にある。
- 影響: 15〜20種のseedを同梱しても、選択・混合・投入の導線がなければ「魚で色々いける」体験が伝わらず、素材が並ぶだけになる。
- 推奨: `adopt（seed図鑑）`。クリップ棚の先頭へ `FISH DECK` を置き、同梱seed 15〜20種を魚種カードとして表示する。各カードは `PREVIEW / SCHOOL / HERO` の投入先を持ち、`MIX` で選択中の複数種を一つの群れへ追加する。ライブ生成時は選択魚種をプロンプトへ渡し、完成した透過魚を同じカードへ追加する。検索、学名、産地、外部データ取得は3h版に含めない。
- 理由: 既存seedとクリップ棚を再利用しながら、生成・選択・群れ化を一つの分かりやすい体験へまとめられる。
- 採用内容: —
- 反映先: —
- 棄却理由: —
- 注記: 添付されたSNS画面・図鑑画像はUI発想の参考に限定し、画像素材の切り抜きや再配布には使わない。

### R-021 — 魚種が増えても泳ぎ方が一種類では個体差が伝わらない

- status: `adopted`
- source: プロジェクトオーナー追加要件 + 設計管理者レビュー
- priority: P1
- 対象: `SPEC.md`「駆動レイヤー」、`TECH.md`「魚群」
- 指摘: 魚種図鑑から形の違う魚を選べても、すべてが同じsin波と速度で動くと、見た目だけを貼り替えた印象になる。魚種ごとの専用物理を作るのは3h制約に反する。
- 影響: ウナギ型、マグロ型、イワシ型、タイ型の輪郭差が動きに反映されず、個体が生きて泳いでいる感覚が弱くなる。
- 推奨: `adopt（4泳動型）`。魚種を `SCHOOL`（小型魚の同期群泳）、`GLIDE`（大型魚の直進滑走）、`WAVE`（長魚の大きな蛇行）、`FLOAT`（丸い魚の緩い漂い）の4プリセットへ割り当てる。各型は既存の速度・curl・うねり振幅・旋回率の組み合わせだけで作り、魚種別コードは増やさない。
- 理由: 4種類のパラメータセットだけで魚種差を動きとして読ませられ、GPU構成と3h完成確率を維持できる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-022 — 無限落下・再帰トンネルを明示的に呼び出す演出がない

- status: `adopted`
- source: プロジェクトオーナー追加要件（サイケデリックVJ参考画像2点）
- priority: P1
- 対象: `SPEC.md`「レイヤースタック」「3モード」「デモ設計」、`TECH.md`「2.5Dカメラ」「FeedbackPass」「3hタイムライン」
- 指摘: 採用済みの2.5Dカメラと変換付きFeedbackは吸い込み表現を持つが、魚・曼荼羅・再帰像が永遠に奥へ続き、観客が落下していくように感じる一つの演出として操作契約がない。
- 影響: 各エフェクトが個別に動くだけでは、参考画像のような「戻れない奥行き」や明確なヒーローモーメントにならず、オペレーターも複数パラメータを同時調整する必要がある。
- 推奨: `adopt（既存機能のプリセット）`。`INFINITE DIVE` をワンボタン演出として追加し、カメラ前進、魚群と曼荼羅リングのZ座標ラップ、Feedback zoom/rotate/hueshift、軽いFOV脈動を一つの固定プリセットで同期する。キックで前進量、ドロップで深度とFeedbackを強める。8〜16拍のデモキューと連続保持の両方を許可するが、`EXIT DIVE` で2秒lerpして通常カメラへ戻し、強度上限とFeedback OFFを維持する。新しい汎用トンネルエディタは作らない。
- 理由: R-010とR-012の実装資産を再利用し、少ない追加工数で90秒デモに分かりやすい「無限落下」の見せ場を作れる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-023 — 生成した完成画像と実時間レンダーの到達点が混同されている

- status: `adopted`
- source: プロジェクトオーナー確認 + 設計管理者レビュー
- priority: P0
- 対象: `SPEC.md`「生成レイヤー」「レイヤースタック」「デモ設計」、`TECH.md`「魚群」「曼荼羅」「生成パイプライン」
- 指摘: 今回生成した高品質な魚曼荼羅は全要素が一枚へ焼き込まれたアートディレクション用の完成画像であり、その画像内部の魚を個別に動かすことはできない。実アプリで同等の映像を作るには、透過魚、曼荼羅リング、粒子、背景、カメラ、Feedbackを別要素として再構成する必要がある。
- 影響: 完成画像をそのままテクスチャとしてズーム・回転するだけでは、近景魚の泳ぎや視差がなく「画像が動いている」状態に留まる。一方、生成画像と完全同一の細密さを3h実装へ要求すると完成確率を失う。
- 推奨: `adopt（再構成契約）`。生成した完成画像はルック目標とseed背景の保険に限定し、本線は15〜20種の透過魚を2,000個体へ展開する。画面上で魚として読める個体はすべて独立した位置・深度・速度・位相を持つ。遠景のサブピクセル密度だけは粒子・リング・Feedbackで補い、静止画とのピクセル一致ではなく「個体運動・奥行き・放射構造・60fps」を受入条件にする。
- 理由: 見た目の目標と実時間描画の契約を分離すれば、画像生成品質に引っ張られず、実際に動く体験を優先できる。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-024 — 現行PlaneGeometryでは魚体のうねりに必要な頂点数と素材向きが未定義

- status: `adopted`
- source: 設計管理者レビュー
- priority: P1
- 対象: `SPEC.md`「駆動レイヤー」、`TECH.md`「魚群」「生成パイプライン」「パフォーマンス / 8K」
- 指摘: Three.jsの未分割Planeは頂点が四隅しかなく、頂点シェーダーへsin波を入れても魚の胴体から尾へ伝わるうねりを表現できない。また生成魚の向き・余白・尾の位置が不統一だと共通変形式を適用できない。
- 影響: 各個体の座標は動いても、魚本体が硬い板のまま平行移動し、「一匹ずつ泳いでいる」質感に届かない。
- 推奨: `adopt（分割Plane）`。全透過魚素材を「全身、右向き、尾が左、同一余白」の規格へ統一し、横8〜12分割・縦2分割程度の共有PlaneをInstancedMeshへ使う。頂点シェーダーは尾側ほど振幅が増える曲げと個体別phaseを適用し、R-021の4泳動型で振幅・周波数だけを切り替える。頂点数は会場実測スライダーの対象にせず固定し、性能悪化時は魚数を下げる。
- 理由: 数万頂点程度の増加で、CPU更新を増やさず全個体に身体運動を与えられ、ユーザーが求める「画像ではなく生きた魚」に最も直結する。
- 採用内容: —
- 反映先: —
- 棄却理由: —

### R-025〜R-027 — SWARM・個体泳動・サイズ/密度の実装調整

- status: `adopted`
- source: プロジェクトオーナーの実画面レビュー
- priority: P0 / P1
- 採用内容: 中央の装飾円を削除。MODE/COLORから独立したSPIRAL・VORTEX・WAVE・BLOOMを追加し、1.5秒で座標補間する。各魚へ0〜2πの位相、±30%速度、尾側ほど大きい変形、半径ゆらぎ、速度ベクトル追従、簡易層整列、キック加速を追加。FISH SIZEを魚数と独立した0.5x〜3.0xとして追加し、初期表示を旧比約2.5倍へ拡大。VORTEXは6層を半径60〜70%へ圧縮し外周をフェードする。
- 反映先: `TECH.md`「魚群」「SWARM構造」「実装済みポストFXチェーン」、実装UI
- 棄却理由: —

### R-028 — 曼荼羅と自由遊泳を独立したシーンとして切り替える

- status: `adopted`
- source: プロジェクトオーナーの実画面レビュー
- priority: P0
- 採用内容: 最上位にMANDALA / FREE SWIMのSCENE軸を追加。1.2秒で全個体を補間し、FREE SWIMでは万華鏡コピーを解除して左右双方向へ全個体を直接描画する。自由遊泳側はCRUISE / CURRENT / CROSS / DRIFTの4構造を持ち、1.5秒で群れの泳ぎ方を連続変形する。加速演出としてSCHOOL RUSHを追加する。
- 反映先: `TECH.md`「SCENE / FREE SWIM」、実装UI
- 棄却理由: —

### R-029 — 魚種ごとの速度と揺れが同じテンポに見える

- status: `adopted`
- source: プロジェクトオーナーの公開版E2Eレビュー
- priority: P1
- 採用内容: 移動速度と尾振り周期を分離し、SCHOOLは速い小刻みな尾振り、GLIDEは直進中心、WAVEは大きな全身うねり、FLOATは遅い上下漂流へ調整。MYSTIC / SENSUAL / EUPHORICの全体速度差、4遊泳スタイル、RUSH、2,000匹最速状態をブラウザE2Eで確認する。
- 反映先: `TECH.md`「魚群」、魚頂点シェーダー

### R-030〜R-037 — WorldSource増築の一回攻撃監査

- status: `adopted / patched / active P0=0 / active P1=0`
- source: [WORLD_REVIEW_X](./WORLD_REVIEW_X.md) X-W01〜X-W08
- priority: P0×6 / P1×2
- 対象: `WORLD_SOURCE_V0`、`PERFORMANCE_MAP_V0`、`OUTPUT_SURFACES_V0`、
  `WORLD_PROOFS_V0`、`FISHVJ_INSTRUMENT_V2`
- 採用内容: frozen SpacePayloadをsession profile routingへ戻した。world/mapの2 hashをload eventへ
  atomicに同梱した。world paramのdeck/target/rangeをdictionary codeへ固定し、live時点でu16往復後の
  Q16へcanonicalizeした。systemごとのversioned kernel/config、bounded/continuous timeline、
  linear-premultiplied RGBA8出力、asset memory ceiling、warm-up付きp95測定を追加した。
- 反映先: 上記5文書。詳細な破壊シナリオとpatch auditは`WORLD_REVIEW_X.md`を正とする。
- 棄却理由: —

### R-038〜R-044 — World設計の独立再監査

- status: `adopted / patched / active P0=0 / active P1=0`
- source: [WORLD_REVIEW_F](./WORLD_REVIEW_F.md) F-W01〜F-W07
- priority: P0×1 / P1×4 / P2×2
- 対象: `WORLD_SOURCE_V0`、`PERFORMANCE_MAP_V0`、`OUTPUT_SURFACES_V0`、
  `WORLD_PROOFS_V0`、`FISHVJ_INSTRUMENT_V2`
- 採用内容: bounded worldを`Baseline(p)`で定義し、後方seek/reverse/loopとQ32.32 tempoを固定した。
  manifest seedへ一本化したPCG32、numeric entity tuple順、fixed `world.dict` layoutを追加した。
  proof manifest/input/expectedをrepo fixtureへ置いてJCS SHA-256でpinし、water decay、dead entity no-op、
  dual-trigger graph merge、2-blob入力、60秒DJ transportを機械判定可能にした。
- 反映先: 上記5文書、`fixtures/world/`。詳細な破壊シナリオとpatch auditは`WORLD_REVIEW_F.md`を正とする。
- 棄却理由: —

### R-045〜R-046 — World operator UIのschema整合監査

- status: `adopted / patched / frozen`
- source: プロジェクトオーナーの正典画像レビュー
- priority: P0×1 / P1×1
- 対象: `fishvj-world-operator-master-v1.png`、`PERFORMANCE_MAP_V0 §6`、
  `WORLD_SOURCE_V0 §3.5`、`FISHVJ_INSTRUMENT_V2 §10`
- 採用内容: continuous deckからPLAY/CUE/LOOP、jog ring、cue points、BPM/SYNCを除き、
  `CONTINUOUS · VJ ONLY / AUTO-RUN · 1.00× / NO SEEK · NO CUE · NO LOOP`へ置換した。
  bounded deckはtime scaleを`0.50–2.00×`へ直し、`STATE SEEK · BASELINE(p)`を明示した。
- 反映先: `docs/design/FISHVJ_WORLD_UI_VISUAL_CONTRACT.md`、同正典PNG、本書§10。
- 棄却理由: —

## 判断履歴

| 日付 | ID | 判断 | コメント |
|---|---|---|---|
| 2026-07-18 | R-001〜R-009 | 起票 | 設計管理者による初回レビュー。すべてオーナー判断待ち |
| 2026-07-18 | R-001〜R-009 | adopted | 全件採用。R-001/R-008はオーナー修正、R-004は指定方針で反映 |
| 2026-07-18 | R-010〜R-011 | 起票 | Claude追加レビュー。条件付きadopt推奨、オーナー判断待ち |
| 2026-07-18 | R-010〜R-011 | adopted | 条件付き採用。R-010は10分timebox/OFF/固定数式、R-011は事前未完了なら無条件drop |
| 2026-07-18 | R-012 | 起票 | Claude追加レビュー。範囲限定adopt推奨、オーナー判断待ち |
| 2026-07-18 | R-012 | adopted | 推奨どおり採用。有界mix/max+clamp、10分timebox、OFF、stock Afterimage fallback |
| 2026-07-18 | 設計フェーズ | completed | R-001〜R-012の判断・反映完了。`docs/GOAL.md` を実装開始ゲートとして作成 |
| 2026-07-18 | R-013〜R-018 | 起票 | 個体別アニメーション、ライブ素材、透過品質、操作体験、Codex app-server、iPhone遠隔マイクを追加レビュー。オーナー判断待ち |
| 2026-07-18 | 設計フェーズ | reopened | 追加要件の採否確定まで設計レビューを再開。`docs/GOAL.md` の実装開始ゲートは閉じたまま |
| 2026-07-18 | R-019 | 起票 | 参考画像の高彩度・高コントラスト表現を、軽量な最終カラーグレーディングとして追加レビュー。オーナー判断待ち |
| 2026-07-18 | R-020〜R-021 | 起票 | 魚種図鑑UIと、魚体に合う4種類の泳動プリセットを追加レビュー。オーナー判断待ち |
| 2026-07-18 | R-022 | 起票 | 既存の2.5DカメラとFeedbackを組み合わせた無限落下プリセットを追加レビュー。オーナー判断待ち |
| 2026-07-18 | R-023〜R-024 | 起票 | 完成静止画と実時間レンダーの差、および魚体変形に必要な分割Plane規格を追加レビュー。オーナー判断待ち |
| 2026-07-18 | R-013〜R-024 | 判断 | R-017/R-018を棄却、その他を推奨どおり採用。プロジェクトオーナーの `/goal` 指示により実装開始 |
| 2026-07-18 | Milestone 1 | implemented | 透過8魚種アトラス、最大2,000個体、4泳動、4色プリセット、音声入力、INFINITE DIVE、ライブ操作UIを実装 |
| 2026-07-18 | R-025〜R-027 | adopted / implemented | 装飾円削除、4 SWARMモーフ、個体泳動、独立FISH SIZE、VORTEX層圧縮を実装し、2,000匹 + DIVEで60fpsを確認 |
| 2026-07-18 | R-028 | adopted / implemented | MANDALA / FREE SWIM、自由遊泳4スタイル、SCHOOL RUSHを実装し、2,000匹で60fpsを確認 |
| 2026-07-18 | R-029 | adopted / implemented | 魚種別の移動速度・尾振り周期・上下揺れを分離し、4スタイルと2,000匹最速状態をE2E確認 |
| 2026-07-21 | Z-01 | adopted | DJ/VJ 2文法を維持し、WorldSourceを新source種別として増築。物理multi-surfaceは契約のみ |
| 2026-07-21 | R-030〜R-037 | adopted / patched | World設計を一回攻撃監査。P0×6・P1×2を全件反映し、active P0/P1を0件へ閉じた |
| 2026-07-22 | R-038〜R-044 | adopted / patched | Fable独立監査P0×1・P1×4・P2×2を全件反映し、fixture hash再計算後active P0/P1を0件へ閉じた |
| 2026-07-22 | R-045〜R-046 | adopted / patched / frozen | World operator UIのcontinuous transportとBPM表記を修正し、正典画像v1をfreeze |
