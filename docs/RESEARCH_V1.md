# FishVJ — VJ / 映像楽器 領域調査 RESEARCH_V1

> status: research snapshot / implementation decisionではない
>
> 基準日: **2026-07-20**
>
> 対象repo: `buildinpublicjp-debug/fishvj@2275308460f48d4031fa550fafc80e7b2611f900`
>
> 目的: VJ parity baseline、H-01〜H-08の生死、v0技術リスクの判定

## 読み方と情報規律

- 外部リンクは、別の日付を明記したものを除き **2026-07-20アクセス**。
- `verified` = 公式doc、公式リリース、仕様、または固定commitのsourceで確認。
- `sandbox-measured` = 本調査環境で実測。機材・入力・手順を併記する。
- `estimated` = 出典値を明示した算術、または明示した仮定に基づく見積り。
- `unverified` = 一次情報または実機で確認できなかった。空欄を意味し、「機能がない」という断定ではない。
- 製品matrixの `●` はverified native、`◐` はverifiedだが上位edition/add-on/patch構築が必要、`—` は公式資料で対象外が明示、`?` はunverified、`L` はlegacy扱い。
- 「存在しない」の全世界証明は行わない。差別化判定の母集団は本書で調査した市販品・公式資料に限定する。

---

# 0. Executive verdicts

## 0.1 H-01〜H-08 生死表

| H | verdict | 判定根拠 |
|---|---|---|
| **H-01** DJ筋肉記憶互換で映像を弾ける市販製品は存在しない | **死亡** | Serato Video、MixEmergency、VirtualDJ、rekordbox、djay Proは、2 deck、cue、scratch/seek、video crossfaderをDJ transportへ接続済み。特にSeratoはchannel fader/crossfaderの映像連動を公式に説明し、MixEmergencyはvideo scratchingを製品目的として明示する。(verified: [Serato Video](https://support.serato.com/hc/en-us/articles/204211070-Serato-Video-101), [Serato fader link](https://support.serato.com/hc/en-us/articles/202538870-Using-Serato-Video-in-Demo-Mode), [MixEmergency manual](https://www.inklen.com/mixemergency/manual/viewall/), accessed 2026-07-20) |
| **H-02** ライブ中prompt生成で素材が湧く市販VJ楽器は存在しない | **死亡** | HeavyM 2.15はapp内promptからFull HD画像と4秒loopを生成し、画像は数秒、動画は2分未満と公称。Magic 2.5はpromptでISF generator/effectを生成・編集。VirtualDJはVisuals内にAI video loop生成を持つ。(verified: [HeavyM 2.15, published 2025-12](https://www.heavym.net/heavym-2-15-update/), [Magic 2.5 guide](https://magicmusicvisuals.com/downloads/Magic_UsersGuide.html), [VirtualDJ Visuals](https://virtualdj.com/manuals/virtualdj/interface/mixer/video/visuals.html), accessed 2026-07-20) |
| **H-03** realtime diffusionは研究demo止まり、512px/十数fpsで製品化されていない | **死亡** | Kreaは2025-08からcommercial realtime videoを提供。Daydream ScopeはVJ tool連携込みの市販/open-source desktop appで、RTX 4090 24GBを推奨。研究値もStreamDiffusion v1の512² img2img 93.897fps/RTX 4090、v2の14B 58.28fps/4×H100まで進んでいる。ただしconsumer Macで同水準という意味ではない。(verified: [Krea Realtime, 2025-08-27](https://www.krea.ai/blog/announcing-realtime-video), [Daydream Scope](https://daydream.live/scope), [StreamDiffusion benchmark](https://pypi.org/project/streamdiffusion/), [StreamDiffusionV2](https://streamdiffusionv2.github.io/), accessed 2026-07-20) |
| **H-04** 写真→depth→2.5D parallaxはVJソフトの標準機能には基本ない | **条件付き生存** | 調査したclip-centric VJ製品の標準workflowとして「単眼depth生成→depth displacement」は確認できない。一方TouchDesigner、Wire、Magic、Synesthesia等ではshader/nodeとして構築可能で、競合不能な機能ではない。大parallaxではdisocclusionが生じ、layered depth/inpaintingが必要。(verified within surveyed set: product matrix §1; [3D Photography paper, 2020](https://arxiv.org/abs/2004.04727)) |
| **H-05** H.264長GOPはframe random access不能で、scratchにはframe stack必須 | **死亡** | delta frame単体からはdecode開始できずkey frameからforward decodeが必要、という前半は正しい。しかし解法はfull frame stackだけではなく、keyframe index + forward decode + rolling cache、短GOP/intra codec、静止画sequenceもある。「frame stack必須」は偽。(verified: [WebCodecs §VideoDecoder](https://www.w3.org/TR/webcodecs/), [codec registry](https://www.w3.org/TR/webcodecs-codec-registry/), 2026-01/02) |
| **H-06** ブラウザ内背景除去は実用品質で動く | **条件付き生存** | IMG.LYとTransformers.jsで完全client-side実行は成立する。だがM1/16GBのwarm inferenceは本調査で約2.7〜2.8秒/1024²で、live frame-rateではない。髪・半透明・非人物の品質は未評価。IMG.LY実装はAGPLまたは商用license。(verified: [IMG.LY repo](https://github.com/imgly/background-removal-js), [Transformers.js](https://huggingface.co/docs/transformers.js/main/index); sandbox-measured: §5.1) |
| **H-07** FLX4はclass compliantでWeb MIDI直結できる | **条件付き生存** | 公式はdriver不要/class compliantを明記し、通常MIDIはWeb MIDIで読める。ただしMixxxは200msごとに12-byte SysEx keepaliveを送る。ブラウザ側はsecure context、MIDI permission、さらに`sysex:true`許可が必要。class compliantは「Web MIDI無条件動作」と同義ではない。(verified: [FLX4 official](https://www.pioneerdj.com/en/product/dj-controllers/ddj-flx4/), [Web MIDI spec](https://www.w3.org/TR/webmidi/), [Mixxx source](https://github.com/mixxxdj/mixxx/blob/cad6179f05405e9b6dc88fa29fd95c0e6734f365/res/controllers/Pioneer-DDJ-FLX4-script.js#L174)) |
| **H-08** FLX4 padはvelocity非対応の可能性が高い | **生存** | 公式MIDI listはpad/buttonのOFF=`0x00`、ON=`0x7F`を示し、Mixxx mappingもpressを`0x7F`で判定する。連続velocityは観測されない。(verified: [official MIDI message list](https://downloads.support.alphatheta.com/software_info/dj-controllers/DDJ-FLX4/DDJ-FLX4_MIDI_message_List_J1.pdf), [Mixxx mapping](https://github.com/mixxxdj/mixxx/blob/cad6179f05405e9b6dc88fa29fd95c0e6734f365/res/controllers/Pioneer-DDJ-FLX4.midi.xml#L1252); bench confirmation still required) |

## 0.2 結論だけ

1. **DJ controllerで映像を弾くこと自体は差別化にならない。** これはparityである。(verified: §2)
2. **app内AI prompt生成も差別化にならない。** HeavyM/Magic/VirtualDJが先行済み。(verified: §2, §6)
3. 生き残る候補は、調査母集団内では **空間周波数EQ**、**決定論replay**、**depth付き素材をframe-addressable instrumentへ変換する一連の契約** の3本。(verified within surveyed docs; uniqueness outside surveyed set unverified)
4. frame stackを4秒/120f/1080p/RGBA8で全保持すると **995.328MB decimal / 949.219MiB**。1B/px GPU圧縮なら **248.832MB / 237.305MiB**、縦横halfなら **62.208MB / 59.326MiB**。(sandbox-measured arithmetic: §3.2)
5. FLX4は入力分解能自体は十分だが、Web直結の最大リスクは**SysEx permission + keepaliveの実機挙動**である。(verified source / bench-required: §4)

---

# 1. Parity matrix + minimum parity list

## 1.1 現役性

| 製品 | 2026-07-20時点の扱い | 根拠 |
|---|---|---|
| Resolume Avenue/Arena + Wire | active | 7.27.1が2026-07-17公開。(verified: [download](https://www.resolume.com/download/)) |
| TouchDesigner | active | official build 2025.33070、2026-07-16更新。(verified: [User Guide](https://derivative.ca/UserGuide/Main_Page)) |
| VDMX | active | VDMX6、Metal移行、新価格を2026年に告知。(verified: [official blog](https://vdmx.vidvox.net/blog)) |
| CoGe | **legacy** | 公式で確認できた最後の明確なreleaseは1.7、2016-04-27。current compatibility/販売はunverified。(verified date: [CoGe 1.7 release](https://imimot.com/blog/coge-1-7-released-bulletproof-edition/)) |
| Modul8 | activeだがmacOS制約あり | v3、M-seriesはRosetta、macOS Tahoe compatibility記述にページ間差異あり。(verified: [FAQ](https://www.garagecube.com/modul8/faq/); exact Tahoe status unverified) |
| GrandVJ | active | GrandVJ 2.7 feature page、現行shopあり。(verified: [product](https://vj.arkaos.com/grandvj/about), [shop](https://vj.arkaos.com/cart)) |
| Magic Music Visuals | active | v2.5 current guide、AI ISF promptingあり。(verified: [guide](https://magicmusicvisuals.com/downloads/Magic_UsersGuide.html)) |
| Millumin | active | v5 current product/pricing。(verified: [v5](https://www.millumin.com/v5/)) |
| HeavyM | active | 2.15 AI release、2026 help更新。(verified: [release](https://www.heavym.net/heavym-2-15-update/)) |
| Synesthesia | active | current Standard/Pro pricingとshader workflow。(verified: [pricing](https://synesthesia.live/pricing)) |
| MadMapper | active、追加対象 | 6.1.3 releaseが2026-06-26、mapping分野の上位現役。(verified: [official forum/releases](https://forum.garagecube.com/viewforum.php?f=20)) |

## 1.2 機能matrix

`clip`欄は公式に名指しされた主要codec/pathのみ。OS codec fallbackを「全codec対応」とは数えない。

| 製品 | clip / codec | layer / blend | quant / BPM / audio | FX | MIDI / preset | camera | NDI / Syphon / Spout | output補正 | preview / program | record | 生成系 | AI | 価格 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Resolume Avenue/Arena + Wire** | ● DXV3, H.264, ProRes, PhotoJPEG, MOV/MP4等 | ● unlimited相当 | ● Beat Snap, BPM sync, FFT | ● clip/layer/group/master、momentary trigger可 | ● learn; preset/controller templates | ● capture cards/webcam | ● NDI/Syphon/Spout I/O | ◐ Arena: corner pin/mapping/edge blend | ● preview + fullscreen/advanced output | ● live record, default DXV3 | ◐ Wire node/ISF/generator | ◐ MCP natural-language control。素材生成ではない | Avenue **€299** / Arena **€799** / Wire **€399** |
| **TouchDesigner** | ● Movie File In: H.264/H.265/HAP等はplatform依存 | ◐ TOP networkで任意構築 | ◐ Audio CHOP/BPM・quantはpatch | ● node/GLSL/COMP全域 | ● MIDI In/Out、presetはpatch | ● Video Device In | ● NDI; Syphon/Spout platform別 | ◐ Kantan/Paletteまたはpatch | ◐ custom multi-window | ● Movie File Out | ● node/GLSL/Python | ? first-party live prompt feature unverified | Non-Commercial **$0** / Commercial **$600** / Pro **$2,200** |
| **VDMX6** | ● HAP/AVFoundation系 | ● unlimited layer/compositor | ● optional quantization、audio analysis/BPM | ● per-layer/chain/master | ● MIDI/OSC/DMX、workspace preset | ● capture/live | ● Syphon/NDI; SpoutはWindows非対応 | ● perspective correction/masks | ● preview + output | ● record | ● ISF/QC/Vuo/FFGL | ? | **$199** / Plus **$349** |
| **CoGe 1.7** | L QuickTime-era | L layer/mixer | L BPM/audio | L | L MIDI/OSC | L | L Syphon-era | ? | L | ? | L Quartz Composer | — | current price **unverified** |
| **Modul8 v3** | ● H.264/HAP、FFmpeg/AVFoundation | ● 10 layer、A/B crossfader | ◐ sound analysis; launch quant unverified | ● layer/master/module | ● MIDI/DMX、micromodul8 preset | ● AVFoundation/Blackmagic | ● NDI/Syphon | ◐ MadMapper連携、単体mapping限定 | ● preview + fullscreen | ● direct-to-disk record | ● Python modules/QC | ? | 2 computers **€299 + tax** |
| **GrandVJ 2.7** | ● FFmpeg/QuickTime path、HAP/DXVはrelease support | ● mixer/deck layer、A/B | ● beat sync、TrackDJ/Pro DJ Link/timecode | ● video FX/transitions | ● MIDI learn、DJ controller/TrackDJ | ● live inputs | ● NDI I/O; Syphon/Spout | ◐ XT/VideoMapper | ● independent preview/browser preview | ? | ◐ generators/FFGL | ? | GrandVJ **£260** / XT **£350** |
| **Magic 2.5** | ● movie/image/3D、export H.264/ProRes/MJPEG/PNG seq | ● node compositor | ◐ audio/MIDI/OSC reactive; clip quantなし | ● node/FFGL/ISF | ◐ Performer: MIDI/OSC learn | ◐ Performer: multiple capture/IP | ◐ Performer: Syphon/Spout; NDI unverified | — dedicated mappingなし | ● preview/output | ◐ offline export、live record unverified | ● GLSL/ISF/module graph | ● prompt→ISF生成/編集 | Studio **$44.95** / Performer **$79.95** |
| **Millumin 5** | ● media/sequencer、codecはAVFoundation系 | ● layer/timeline | ◐ timeline/timecode、audio; beat launch unverified | ● layer/custom effect | ● MIDI/OSC/DMX | ● cameras/capture | ● NDI/Syphon I/O | ● perspective/mesh/mask/edge output | ● monitor/output | ? native capture unverified | ◐ custom effect/shader | ? | 7d **€29** / 30d **€69** / year **€199** / lifetime **€399** |
| **HeavyM 2.15** | ● H.264/H.265/ProRes、image/GIF | ● groups/players | ● audio analysis、Ableton Link、sequencer | ● group/master shader | ● MIDI; OSC/DMX edition別 | ● webcam/DeckLink | ◐ Syphon/Spout全edition、NDI Pro | ◐ Pro: warp/edge blend/multi-output | ● canvas/output setup | ◐ Pro+: video export | ● generative shader | ● prompt→Full HD image/4s loop | Live **€199** / Pro **€439** / Pro+ **€539** |
| **Synesthesia** | ● media/live camera input | ◐ scene + media layers | ● audio reactive、MIDI | ● scene shader/effect | ● MIDI I/O | ● | ◐ Pro: Syphon/Spout/NDI/OSC | — dedicated mappingなし | ● output | ? | ● shader IDE、Shadertoy/ISF import | ? | Standard **$199** / Pro **$399** |
| **MadMapper 6.1** | ● movie/image/material/montage | ● surfaces/layers | ◐ timeline/timecode、audio track; beat launch unverified | ● surface FX/master/material | ● MIDI/OSC/DMX | ● camera/Blackmagic | ● NDI/Syphon/Spout | ● 3D calibration、warp、multi-output、mapping | ● input/output preview | ● v6 native timeline export | ● material/generative shader | ? | current price **unverified** |

### Matrix出典

- Resolume: (verified: [feature/pricing](https://www.resolume.com/software/avenue-arena), [clips/Beat Snap](https://www.resolume.com/index.php/support/en/7/clips), [video/codecs](https://www.resolume.com/support/en/video), [advanced output](https://www.resolume.com/support/advanced-output), [recording](https://www.resolume.com/support/recording), [Wire](https://www.resolume.com/software/wire))
- TouchDesigner: (verified: [Movie File In TOP/codecs](https://docs.derivative.ca/Movie_File_In_TOP), [Movie File Out TOP/record](https://docs.derivative.ca/Movie_File_Out_TOP), [projection mapping](https://docs.derivative.ca/Projection_Mapping), [Syphon/Spout](https://docs.derivative.ca/Syphon_Spout_In_TOP), [licensing](https://docs.derivative.ca/Licensing), accessed 2026-07-20)
- VDMX: (verified: [feature page](https://vdmx.vidvox.net/), [VDMX6 pricing, 2026](https://vdmx.vidvox.net/blog))
- Modul8: (verified: [v3 FAQ/codecs](https://www.garagecube.com/modul8/faq/), [manual/modules](https://www.garagecube.com/documentation/modul8/modules_manual/), [price](https://www.garagecube.com/buy-try-modul8/))
- GrandVJ: (verified: [features](https://vj.arkaos.com/grandvj/about), [price](https://vj.arkaos.com/cart))
- Magic: (verified: [v2.5 guide](https://magicmusicvisuals.com/downloads/Magic_UsersGuide.html), [price](https://magicmusicvisuals.com/purchase))
- Millumin: (verified: [v5/pricing](https://www.millumin.com/v5/), [output](https://help.millumin.com/v4/display/outputs/), [media inputs](https://help.millumin.com/docs/playback/medias/))
- HeavyM: (verified: [features](https://www.heavym.net/heavym-software/), [edition matrix](https://www.heavym.net/elementor-140526/), [price](https://get.heavym.net/), [AI release](https://www.heavym.net/heavym-2-15-update/))
- Synesthesia: (verified: [pricing/features](https://synesthesia.live/pricing), [user guide](https://www.synesthesia.live/resources/synesthesia-user-guide.pdf))
- MadMapper: (verified: [features](https://www.garagecube.com/madmapper/), [v6 release](https://forum.garagecube.com/viewtopic.php?f=20&t=36371))

## 1.3 Minimum parity list

判定規則: active 10製品（CoGeを除外）のうち、公式資料で3本以上に存在する機能。TouchDesignerのようにpatch構築が必要な場合も「実現能力」には数えるが、受入時はnativeとcustomを分離すべきである。

| minimum parity機能 | 確認本数 | 確認例 | parity判定 |
|---|---:|---|---|
| clip/stillのload・loop・seek・speed/direction | ≥9 | Resolume, VDMX, Modul8, GrandVJ, Millumin, HeavyM | **必須** |
| 2系統以上のlayer、opacity、blend/composite | ≥9 | Resolume, VDMX, Modul8, HeavyM | **必須** |
| clip/scene triggerとtransition | ≥8 | Resolume, VDMX, GrandVJ, HeavyM, Millumin | **必須** |
| BPM/audio analysisによるparameter modulation | ≥8 | Resolume FFT, VDMX audio analysis, HeavyM, Synesthesia, Magic | **必須** |
| beat/quantized launchまたは同等のbeat snap | ≥3 | Resolume Beat Snap, VDMX optional quantization, GrandVJ beat sync | **必須候補**。launch粒度は製品差あり |
| clip/layer/masterに置けるFX chain | ≥8 | Resolume, VDMX, HeavyM, Magic, Millumin | **必須** |
| MIDI learn/mapping | 10 | active全製品で確認 | **必須** |
| live camera/capture input | ≥9 | Resolume, VDMX, TD, HeavyM, Synesthesia | **必須** |
| external fullscreen/programと手元preview | ≥8 | Resolume, VDMX, GrandVJ, Modul8, Millumin | **必須** |
| Syphon/Spout/NDIの少なくとも1つ | ≥9 | Resolume, TD, VDMX, HeavyM, MadMapper | **必須**。Web単体での直接提供可否は別問題 |
| corner pin/warp/projection mapping | ≥6 | Arena, VDMX, Millumin, HeavyM Pro, MadMapper, GrandVJ XT | **上位parity** |
| output recordまたはoffline export | ≥6 | Resolume, Modul8, Magic, HeavyM, MadMapper | **必須候補**。live captureとoffline renderを分ける |
| shader/generator/node拡張 | ≥8 | Wire, TD, VDMX ISF, Magic ISF, HeavyM, Synesthesia | **必須** |
| AI生成 | 2本以上だが3本未満を確実に確認 | HeavyM, Magic。VirtualDJはDJ製品側で確認 | **minimum parity外。ただし差別化不可** |

controller preset、preview/programの厳密なbroadcast二重系、master/momentary FXの操作形は製品間で定義差が大きく、単一のminimumへ潰さない。(verified matrix / exact common denominator unverified)

---

# 2. DJ×映像 脅威表 + 差別化再スコープ

## 2.1 脅威表

| 製品 | jog / scratch | hot cue / transport | EQ / channel fader | crossfader | 映像専用機能 | 遅延情報 | threat |
|---|---|---|---|---|---|---|---|
| **Serato Video** | ● Serato deckのscratch/seekがvideoへ従属 | ● cue/loop/transport連動 | ◐ channel faderをvideoへlink可。EQはaudioであり空間周波数映像EQではない | ● audio/video link・unlink | transitions, video FX, text, dual decks | 公称ms **unverified** | **高** |
| **MixEmergency 3.5.4** | ● 「mix and scratch video」が主目的。slow scratch frame blendingあり | ● Serato control/data連携 | ◐ Serato mixer連動。映像EQの公式記述なし | ● | HAP/ProRes/H.264/H.265、Syphon、record、delay compensation | delay compensation機構はverified、既定ms **unverified** | **最高** |
| **VirtualDJ** | ● audio deckと同じscratch/seek | ● hot cue/loop/beat transport | ◐ volume fader video link。3-band visual EQなし | ● manual/linked/smart video crossfader | video FX/transitions/camera/shader/slideshow、prompt AI loops | 公称ms **unverified** | **最高** |
| **rekordbox 7 Video** | ● player transport/jogにvideoが従う | ● cue/play/loop系 | ◐ mixer/video transition。映像EQなし | ● video crossfader/transition | text/image/camera、video deck | 公称ms **unverified** | **高** |
| **djay Pro** | ● two video decksのdeck transport | ● cue/loop/standard deck control | ◐ audio/video split、映像EQなし | ● separate video crossfader | video FX, overlays, deck/main preview | 公称ms **unverified** | **高** |
| **Mixxx** | — official current feature/manualにvideo mixing subsystemなし | audioのみ | audioのみ | audioのみ | — | — | **低** |

### 一次情報

- Serato Videoは現行support記事とpurchase導線が残り、終売は確認されない。(verified: [Serato Video 101](https://support.serato.com/hc/en-us/articles/204211070-Serato-Video-101), [supported codecs](https://support.serato.com/hc/en-us/articles/202305724-Serato-Video-supported-formats-and-codecs), accessed 2026-07-20)
- MixEmergencyは現行manual 3.5.4とrelease notesを維持。(verified: [manual](https://www.inklen.com/mixemergency/manual/viewall/), [release notes](https://www.inklen.com/mixemergency/releasenotes))
- VirtualDJはdual video source、video fader link、video FX、AI Visualsを公式manualに記載。(verified: [video mixer](https://virtualdj.com/manuals/virtualdj/interface/mixer/video.html), [AI Visuals](https://virtualdj.com/manuals/virtualdj/interface/mixer/video/visuals.html), [native video effects](https://virtualdj.com/manuals/virtualdj/appendix/nativeeffects.html))
- rekordbox 7.0.5 Video Operation GuideはVideo機能をCreative planで提供。rekordbox自体は7.2.16が2026-07-09公開。(verified: [Video guide PDF](https://cdn.rekordbox.com/files/20241203185046/rekordbox7.0.5_video_operation_guide_EN.pdf), [download](https://rekordbox.com/en/download/))
- djay Proはtwo video decks、main/deck preview、effects/overlays、audio/video splitを公式manualに記載。H.264/MPEG-4は最大1080p30。(verified: [djay video manual](https://help.algoriddim.com/user-manual/djay-pro-mac/mixing-basics/videos))
- Mixxxの「videoなし」はcurrent official feature list全体にvideo outputが存在しないことからのscope判定であり、absenceの絶対証明ではない。(verified-by-scope: [Mixxx features](https://mixxx.org/features/), accessed 2026-07-20)

## 2.2 H-01の最終判定

**死亡。** 「DJの筋肉記憶が映像へ通る」は市場に既に複数存在し、featureではなくbaselineである。ジョグ、cue、crossfaderだけを製品conceptの芯にするとSerato Video/MixEmergency/VirtualDJの部分集合になる。(verified: threat table)

EQについてのみ空白が残る。調査した公式資料では、DJ mixerのLOW/MID/HIGHを「映像の大形状/構造/細部」という空間周波数bandへ意味的に割り当てる市販機能は確認できなかった。(verified within surveyed docs; global uniqueness unverified)

## 2.3 生き残る差別化主張の再スコープ

| 再スコープ | 生存度 | 言える範囲 | 禁止する過大主張 |
|---|---|---|---|
| **空間周波数EQ instrument** | **強** | 「調査したDJ-video製品の公式機能では、audio EQ gestureをlow/mid/high spatial-frequency visual decompositionへ直接対応させる例を確認できない」 | 「世界初」「競合ゼロ」は追加特許/製品調査なしには言わない |
| **決定論replayを持つ映像楽器** | **強** | 入力event、seed、clock/audio envelopeから同じ演奏状態を再生・検証する契約は、調査したVJ/DJ-video manualに見当たらない | 単なるoutput録画をreplayと呼ばない |
| **prep済み2.5D assetをscratch可能なdeckへする** | **中〜強** | depth/alpha/frame-addressabilityを一体の素材契約にする。写真depth自体ではなく「DJ transportで破綻しない2.5D instrument slot」が主張 | 写真→depth単体を独自機能としない。TD/shaderで再現可能 |

AI生成はこの3案の供給源にはなれるが、AI生成そのものを差別化の主語にしない。(verified: H-02/H-03死亡)

---

# 3. Frame access tech sheet

## 3.1 WebCodecsでのseek/random access

WebCodecsはcontainer demuxerではない。MP4/WebM等からsample、timestamp、key/delta種別、byte offsetを取り出す処理は別途必要。(verified: [WebCodecs codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection), accessed 2026-07-20)

seekの実務手順:

1. target timestamp以前の最近傍key frameをindexから探す。
2. `VideoDecoder.reset()`または再configureする。
3. 最初に`type:"key"`の`EncodedVideoChunk`をenqueueする。
4. key frameからtargetまでdelta chunksを順にdecodeし、target以前を捨てる。
5. reverse/scratchでは直近decoded framesをring cacheし、cache外へ出た時だけ前のkey frameへ戻る。

decoder reset/flush後にdelta chunkから開始すると`DataError`となる仕様である。(verified: [WebCodecs WD, 2026-01-29](https://www.w3.org/TR/webcodecs/))

したがってlong-GOP H.264のseek cost上限は概ね「直前key frameからtargetまでのdecode枚数」。GOP=60なら最悪約59 delta frames、GOP=250なら最悪約249 framesをforward decodeする。(estimated arithmetic; actual GOP/decoder throughput must be measured per asset/device)

## 3.2 H-05メモリ検算

前提:

- 1920×1080
- 30fps
- 4秒 = 120 frames
- MBは10進、MiBは2進
- 「half-res」は幅と高さを各1/2、したがってpixel数1/4

| 保持形式 | 式 | bytes | 10進 | 2進 |
|---|---:|---:|---:|---:|
| RGBA8 | 1920×1080×4×120 | **995,328,000** | **995.328MB ≈ 0.995GB** | **949.219MiB** |
| 1 byte/pixel | 1920×1080×1×120 | **248,832,000** | **248.832MB** | **237.305MiB** |
| half each axis, 1 byte/pixel | 960×540×1×120 | **62,208,000** | **62.208MB** | **59.326MiB** |
| RGBA8 single frame | 1920×1080×4 | **8,294,400** | **8.2944MB** | **7.910MiB** |

(sandbox-measured arithmetic: Node.js integer calculation, Apple M1 host, 2026-07-20)

`1 byte/pixel`は「圧縮率」ではなく8 bits/pixelの固定仮定。BC3/BC7/ASTC 4×4等のblock formatに近いが、alpha、format support、qualityは別条件。(estimated model; exact format support unverified)

結論: full 1080p RGBA stackは16GB machineのv0には重い。H-05の正しい縮約は「full stack必須」ではなく、**bounded cache容量、GOP長、decoder throughput、reverse access幅の4値を同時に契約する必要がある**。(derived verdict)

## 3.3 GPU compressed texture / KTX2

| 項目 | 判定 |
|---|---|
| KTX2/Basis | KTX2はGPU texture container、Basis Universalはruntimeで端末対応formatへtranscodeできる。(verified: [Khronos KTX](https://www.khronos.org/ktx/), [KTX2 spec](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html)) |
| WebGL2 upload | `compressedTexImage2D`/texture array経路は存在するが、ASTC/S3TC等はextension依存。(verified: [MDN compressed formats](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Compressed_texture_formats)) |
| macOS/Chrome | Apple M1でのexact extension setは本調査で未採取。(unverified; bench-required) |
| runtime upload | transcode後block dataのuploadは可能。ただし動画の各frameをKTX2として持つ場合、container index、transcode、GPU residency管理は自前。(verified capability / system throughput unverified) |
| frame stack適性 | 120独立textureならrandom accessはO(1) indexにできるが、GPU memoryは§3.2、初回transcode/upload spikeは別途発生。(estimated) |

## 3.4 HAP/DXVのbrowser利用

- HAPはopen-source、GPU compressed textureを直接得られることが価値。AVFoundation/FFmpeg/DirectShowのnative統合経路は公式にある。(verified: [HAP official](https://hap.video/), [developer page](https://hap.video/developers))
- DXVはResolume専用GPU accelerationで、他software再生では同じ性能利益を保証しない。(verified: [Resolume DXV](https://www.resolume.com/support/en/rendering-to-dxv))
- 2026-02 WebCodecs codec registryのvideo entriesはAV1、H.264、HEVC、VP8、VP9。HAP/DXVはない。(verified: [W3C registry](https://www.w3.org/TR/webcodecs-codec-registry/))
- HAPはFFmpeg/WASMを自前統合する理論経路があるが、「browserでHAP MOVをdemux→decode→compressed texture uploadする保守中のproduction package」は本調査で確認できない。(unverified)
- DXVのbrowser/WASM production decoderは確認できない。(unverified)

判定: HAP/DXVはnative VJの強い先例だが、Web v0の即時採用経路ではない。

## 3.5 静止画sequence

| 方式 | random access | storage | decode/upload | 判定 |
|---|---|---|---|---|
| PNG sequence | frame単位O(1) | 最大 | lossless、alpha可 | 品質基準/短stack向け |
| WebP sequence（独立file） | frame単位O(1) | 中 | browser native decode、alpha可 | 実機decode p95未計測 |
| AVIF sequence（独立file） | frame単位O(1) | 小になりやすい | browser nativeだがdecode costはdevice依存 | 実機decode p95未計測 |
| sprite atlas | UV index O(1) | texture上限とpadding制約 | upload回数を減らせる | 120×1080pには非現実的 |

(verified capability: browser image formats; performance `unverified`)

比較に必要なbenchは、同一120-frame sourceを960×540/1920×1080でWebP/AVIF/PNGへ変換し、cold fetch、warm `createImageBitmap`、GPU uploadを分離してp50/p95/最大memoryを取ること。値を採っていないため本書では創作しない。

---

# 4. DDJ-FLX4 暫定MIDI map + bench-required

## 4.1 source baseline

- AlphaTheta/Pioneer公式: [DDJ-FLX4 MIDI message list](https://downloads.support.alphatheta.com/software_info/dj-controllers/DDJ-FLX4/DDJ-FLX4_MIDI_message_List_J1.pdf)。(verified, accessed 2026-07-20)
- Mixxx main fixed commit: [`cad6179f05405e9b6dc88fa29fd95c0e6734f365`](https://github.com/mixxxdj/mixxx/tree/cad6179f05405e9b6dc88fa29fd95c0e6734f365/res/controllers), commit date 2026-07-18。(verified: git commit)
- source size: XML **3,851 LOC** + JS **1,146 LOC** = **4,997 LOC**。(sandbox-measured: `wc -l`)

MIDI status byteはhexで記す。`0xB0/0x90`がdeck 1、`0xB1/0x91`がdeck 2の基本。mixer共通controlは主に`0xB6`。

## 4.2 暫定MIDI map

| control | deck 1 | deck 2 | encoding / range | 判定 |
|---|---|---|---|---|
| Jog top, vinyl on | `B0 22 vv` | `B1 22 vv` | center `0x40`; right `0x41…`, left `0x3F…`; JSは`vv-64` | 7-bit relative |
| Jog top, vinyl off | `B0 23 vv` | `B1 23 vv` | 同上 | 7-bit relative |
| Jog side | `B0 21 vv` | `B1 21 vv` | 同上 | 7-bit relative |
| Shift+jog search | `B0 29 vv` | `B1 29 vv` | `(vv-64)×150`はMixxx側scale | hardwareは7-bit relative |
| Jog touch | `90 36 vv` | `91 36 vv` | press nonzero / release zero | Note-style gate |
| Shift+jog touch | `90 67 vv` | `91 67 vv` | press/release | Note-style gate |
| Tempo fader MSB | `B0 00 mm` | `B1 00 mm` | MSB | 14-bit pair |
| Tempo fader LSB | `B0 20 ll` | `B1 20 ll` | `value=(mm<<7)+ll`, 0…16383 | **14-bit** |
| Channel fader MSB/LSB | `B0 13 mm` / `B0 33 ll` | `B1 13 mm` / `B1 33 ll` | 0…16383 | **14-bit** |
| Crossfader MSB/LSB | colspan | `B6 1F mm` / `B6 3F ll` | 0…16383 | **14-bit** |
| Trim MSB/LSB | `B0 04` / `B0 24` | `B1 04` / `B1 24` | 0…16383 | **14-bit** |
| EQ HIGH MSB/LSB | `B0 07` / `B0 27` | `B1 07` / `B1 27` | 0…16383 | **14-bit** |
| EQ MID MSB/LSB | `B0 0B` / `B0 2B` | `B1 0B` / `B1 2B` | 0…16383 | **14-bit** |
| EQ LOW MSB/LSB | `B0 0F` / `B0 2F` | `B1 0F` / `B1 2F` | 0…16383 | **14-bit** |
| Filter MSB/LSB | `B6 17` / `B6 37` | `B6 18` / `B6 38` | 0…16383 | **14-bit** |
| Headphone mix MSB/LSB | colspan | `B6 0C` / `B6 2C` | 0…16383 | **14-bit** |
| CUE | `90 0C vv` | `91 0C vv` | 0/127 | button |
| PLAY/PAUSE | `90 0B vv` | `91 0B vv` | 0/127 | button |
| Hotcue pads 1…8 | `97 00…07 vv` | `99 00…07 vv` | OFF=0, ON=127 | **velocityなし** |
| Shift hotcue pads | `98 00…07 vv` | `9A 00…07 vv` | OFF=0, ON=127 | **velocityなし** |
| pad LED | inputと対応するstatus/noteへoutput | 同左 | Mixxxは0/127 | on/off verified、色数unverified |
| keepalive/query | colspan | `F0 00 40 05 00 00 04 05 00 50 02 F7` | 12 bytes、Mixxxは200ms間隔 | SysEx |

`colspan`はMarkdown表現上の略で、単一mixer共通messageを意味する。

(verified: [Mixxx XML](https://github.com/mixxxdj/mixxx/blob/cad6179f05405e9b6dc88fa29fd95c0e6734f365/res/controllers/Pioneer-DDJ-FLX4.midi.xml#L182), [Mixxx jog/tempo JS](https://github.com/mixxxdj/mixxx/blob/cad6179f05405e9b6dc88fa29fd95c0e6734f365/res/controllers/Pioneer-DDJ-FLX4-script.js#L598), [Mixxx keepalive](https://github.com/mixxxdj/mixxx/blob/cad6179f05405e9b6dc88fa29fd95c0e6734f365/res/controllers/Pioneer-DDJ-FLX4-script.js#L174))

## 4.3 Class compliant / Web MIDI

公式のclass compliant記述は「audio driver installation不要」を保証する。MIDI deviceとしてOSに列挙され、通常channel messageをWeb MIDIで読む見込みは高い。(verified: [official product](https://www.pioneerdj.com/en/product/dj-controllers/ddj-flx4/))

しかしkeepalive/queryはSysExである。Web MIDIは:

- secure context必須
- `navigator.requestMIDIAccess()`でuser permission必須
- SysExには`requestMIDIAccess({sysex:true})`と追加許可が必要
- SysExが拒否されるとrequest全体が`NotAllowedError`

(verified: [Web MIDI spec](https://www.w3.org/TR/webmidi/), [MDN Web MIDI, updated 2026-05-15](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API))

よってH-07は「USB接続 + Chromium/Firefox系 + HTTPS/localhost + MIDI/SysEx許可 + keepalive実機合格」の条件付き生存。

## 4.4 Bench-required list

| ID | 実機でしか確定しない項目 | 手順 | pass条件 |
|---|---|---|---|
| F-B01 | Web MIDI port列挙 | USB接続→Chromeで`inputs/outputs` dump | 1 input + 1 output、name/manufacturer保存 |
| F-B02 | SysEx permission | `sysex:false/true`を別origin/profileで試す | true時keepalive送信可、拒否時のfallback挙動を記録 |
| F-B03 | keepalive必須性 | 送信なし/200ms/500msで5分ずつ操作 | disconnect/入力停止時刻を測る |
| F-B04 | jog rate/jitter | 最大速度で左右10秒、`event.timeStamp`保存 | event rate p50/p95/max gapを確定 |
| F-B05 | jog touch release | touch/release 100回raw dump | note-on velocity0かnote-offかを確定 |
| F-B06 | 14-bit順序 | tempo/EQ/faderを端から端へ10回 | MSB/LSB順、欠落、endpoint 0/16383を確定 |
| F-B07 | pad velocity | 強弱を変え各pad 100打 | unique velocity setが`{127}`か確認 |
| F-B08 | LED capability | value 0/1/63/127、note/statusを限定送信 | 色数、brightness、safe update rate |
| F-B09 | latency | MIDI event→canvas photodiodeまたは240fps camera | p50/p95 end-to-endを測定 |
| F-B10 | reconnect | cable抜差し、sleep復帰、browser reload各10回 | port statechangeと自動復旧条件 |
| F-B11 | firmware差 | firmware version記録 | 本表のraw messageと差分0 |

---

# 5. Prep pipeline tech sheet

## 5.1 Browser内背景除去

| 候補 | 実行系 | model/weight | license | 判定 |
|---|---|---|---|---|
| `@imgly/background-removal` 1.7.0 | ONNX Runtime Web / WASM中心、client-side | ISNet quantized約40MB、fp16約80MB | AGPLまたは商用 | 最短導入経路。ただしlive frame-rateではない |
| Transformers.js | ONNX Runtime、WASM default / `device:"webgpu"` option | model依存 | library Apache-2.0、model別 | segmentation/depthを同一runtimeへ寄せられる |

(verified: [IMG.LY repo](https://github.com/imgly/background-removal-js), npm package metadata 2026-07-20, [Transformers.js](https://huggingface.co/docs/transformers.js/main/index))

### M-series Mac sandbox測定

環境:

- Apple M1、7-core GPU、16GB RAM。(sandbox-measured: `system_profiler`)
- Chrome 150、cross-origin isolated local page。
- `@imgly/background-removal@1.7.0`、1024×1024 synthetic foreground/background PNG、同一入力3回。
- device pathはlibrary default。WebGPUを明示していないため**WASM/CPU系のprep benchmark**であり、WebGPU benchmarkではない。
- synthetic imageなのでquality benchmarkではない。

| model | cold | warm 1 | warm 2 |
|---|---:|---:|---:|
| `isnet_quint8` 約40MB | **10,938ms** | **2,847ms** | **2,765ms** |
| `isnet_fp16` 約80MB | **14,844ms** | **2,740ms** | **2,768ms** |

(sandbox-measured: browser `performance.now`, 2026-07-20)

この値から言えるのは、browser prepが「秒オーダーで成立」することだけ。hair edge、透明物、魚、low contrast、実写人物のmask qualityは未測定。(unverified)

H-06判定: **offline/prep用途なら生存、live 30fps用途なら死亡。**

## 5.2 単眼depth: browser vs local prep

| 項目 | browser | local Python / MPS |
|---|---|---|
| runtime | Transformers.js + ONNX Runtime Web + WebGPU/WASM | PyTorch MPS、Depth Anything V2/MoGe |
| model | depth-estimation pipelineあり | Depth Anything V2 Small 24.8M / Base 97.5M / Large 335.3M |
| input | model wrapper依存 | Depth Anything V2 default `518` |
| license | model別 | DA-V2 Small Apache-2.0、Base/Large/Giant CC-BY-NC-4.0; MoGe code MIT |
| speed on this M1 | **unverified** | **unverified** |
| operational fit | download/cache/experimental WebGPUの影響 | prepが分オーダー許容なら成立性が高い |

(verified: [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2), [Transformers.js](https://huggingface.co/docs/transformers.js/main/index), [MoGe](https://github.com/microsoft/MoGe))

commercial asset pipelineではmodel licenseが性能と同格のgate。特にDA-V2 Base/Largeはnon-commercialであり、Smallまたは別modelを選ばない限りcommercial利用を前提にできない。(verified: model repo licenses)

## 5.3 2.5D parallaxとartifact

単一RGB + depthをmesh/point displacementする方式は、小さいview translationなら成立する。元画像で隠れていた領域は色情報を持たないため、視点移動が大きいと輪郭の裂け、stretch、holeが必ず出る。(verified geometric consequence)

2020年の3D Photographyは、これを解くためLayered Depth Imageを作り、occluded regionのcolorとdepthをinpaintする。(verified: [Shih et al., CVPR 2020](https://arxiv.org/abs/2004.04727))

| parallax条件 | 必要処理 | 判定 |
|---|---|---|
| 小振幅、短時間、背景が単純 | depth displacement + edge dilation | v0成立 |
| 中振幅、foreground輪郭が明瞭 | alpha/depth layer分離 + hidden background fill | prep追加が必要 |
| 大振幅、camera orbit、複雑occlusion | layered depth + color/depth inpainting、または真3D | 単純2.5Dでは不成立 |

H-04判定: 「VJ標準機能ではない」は条件付き生存。ただし技術自体は既知で、差別化はdepth推定ではなくasset contractと演奏挙動側に置かないと弱い。

---

# 6. AI生成 tech sheet

## 6.1 Local realtime / near-realtime

| 系統 | 公称値 | hardware / 条件 | 製品状態 | 判定 |
|---|---:|---|---|---|
| StreamDiffusion v1 | txt2img **106.16fps** / img2img **93.897fps** | RTX 4090、SD-Turbo、1 step、sample 512×512 | open-source pipeline | throughput値。display end-to-end p95ではない |
| StreamDiffusion v1 LCM | txt2img **38.023fps** / img2img **37.133fps** | RTX 4090、4 steps | open-source pipeline | 512² class |
| StreamDiffusionV2 14B | **58.28fps** 1-step / **31.62fps** 4-step | **4×H100**、TTFF <0.5s | research + open-source | consumer GPU値ではない |
| StreamDiffusionV2 1.3B | **64.52fps** 1-step / **61.58fps** 4-step | **4×H100** | research + open-source | 同上 |
| Krea Realtime 14B | **11fps**、first frames約**1s** | **single NVIDIA B200**, 4 steps | commercial web product/model | productized |
| Daydream Scope | fps/resolution public tableなし | best experience **RTX 4090 24GB+** | free/open-source desktop + cloud | OSC/MIDI/DMX/Syphon/Spout/NDIまで製品化 |

(verified: [StreamDiffusion package benchmark](https://pypi.org/project/streamdiffusion/), [StreamDiffusionV2](https://streamdiffusionv2.github.io/), [Krea Realtime 14B, 2025-10-20](https://www.krea.ai/blog/krea-realtime-14b), [Daydream Scope](https://daydream.live/scope))

H-03は死亡。ただしFishVJ現行基準機のM1 AirはNVIDIA/CUDAを持たず、上記local realtime値を移植可能とは言えない。(sandbox-measured hardware / local MPS realtime unverified)

## 6.2 Hosted generation

Krea APIの表示時間はSLA/p50/p95ではなくmodelごとのnominal durationとして扱う。

| model | nominal generation | unit price | 5秒clip/image 1件 |
|---|---:|---:|---:|
| Flux image | **4s** | **$0.04/image** | $0.04 |
| Flux 1.1 Pro image | **11s** | **$0.06/image** | $0.06 |
| Nano Banana 2 image | **15s** | **$0.06/image** | $0.06 |
| Runway Gen-4.5 | **2min** | **$0.12/output sec** | **$0.60** |
| Kling 2.6 | **3min** | **$0.07/output sec** | **$0.35** |
| Sora 2 | **4min** | **$0.10/output sec** | **$0.50** |
| Veo 3.1 | **4min** | **$0.20/output sec** | **$1.00** |
| Wan 2.5 | **3min** | from **$0.05/output sec** | from **$0.25** |

(verified: [Krea API pricing/nominal times](https://www.krea.ai/features/api), accessed 2026-07-20)

public p50/p95、queue-time SLAは確認できない。(unverified) APIはasync jobで、2〜5秒pollまたはwebhookを公式推奨。(verified: same source)

### 「注文着弾」型の包絡

公開値から固定できる包絡:

- image slot: nominal **4〜15秒**のfast tier。(verified)
- high-quality short video slot: nominal **2〜5分**。(verified)
- p95は非公開なので、「数秒〜数十秒で必着」という保証は現時点で置けない。(unverified)

60分setの変動費:

| cadence | count | model | cost |
|---|---:|---|---:|
| 30秒ごとimage | 120 | Flux $0.04 | **$4.80** |
| 10秒ごとimage | 360 | Flux $0.04 | **$14.40** |
| 5秒ごとimage | 720 | Flux $0.04 | **$28.80** |
| 2分ごと5秒video | 30 | Runway $0.60 | **$18.00** |
| 5分ごと5秒video | 12 | Veo 3.1 $1.00 | **$12.00** |

(estimated arithmetic from verified Krea unit prices; retries/failures/network cost excluded)

Krea Basic以上はgenerated contentのcommercial licenseを明記。一方modelごと、自前hosting、API、venue/public performanceの法的条件は同一ではない。live上映の包括的ToS判定は本調査では未完。(verified: [Krea pricing](https://www.krea.ai/pricing); venue/public-performance clause unverified)

## 6.3 市販VJ内prompt生成

| 製品 | promptの出力 | latency | live中利用 |
|---|---|---:|---|
| HeavyM 2.15 | Full HD image、4秒seamless loop video | image数秒、video 2分未満 | app内生成、server処理 |
| Magic 2.5 | ISF generator/effect source code/module | public p50/p95 unverified | app内で生成・既存module編集 |
| VirtualDJ Visuals | AI video loops / audio-reactive visual | public p50/p95 unverified | Visuals panel内 |

(verified: [HeavyM](https://www.heavym.net/heavym-2-15-update/), [Magic](https://magicmusicvisuals.com/downloads/Magic_UsersGuide.html), [VirtualDJ](https://virtualdj.com/manuals/virtualdj/interface/mixer/video/visuals.html))

H-02は死亡。生き残るのは「生成がある」ではなく、生成物がalpha/depth/frame access/replay contractを満たし、その場で演奏対象になるところまでを一単位にする主張。

---

# 7. Web platform notes

## 7.1 Capability表

| capability | 2026-07-20判定 | 制約 |
|---|---|---|
| Web MIDI | **条件付き成立** | secure context、user permission、Permissions-Policy。SysExは別許可。MDNはLimited availability。(verified: [W3C](https://www.w3.org/TR/webmidi/), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)) |
| FLX4 SysEx | **条件付き成立** | `requestMIDIAccess({sysex:true})`必須。拒否時はSysEx send不可。keepalive必須性はbench待ち。 |
| multi-display fullscreen | **Chromium中心で成立** | Window Management APIはChrome 100から、secure context、`window-management` permission、Limited/Experimental。`requestFullscreen({screen})`あり。(verified: [Chrome](https://developer.chrome.com/docs/capabilities/web-apis/window-management), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API)) |
| window/screen capture | **成立、無人再開不可** | `getDisplayMedia()`は毎回user source selection、permission永続化禁止、transient activation必須。(verified: [W3C Screen Capture](https://www.w3.org/TR/screen-capture/)) |
| MediaRecorder | **成立、品質上限は契約不能** | `isTypeSupported()`はBlob生成能力のみで実record成功を保証しない。bitrateはhintで、超過/未達あり。hardなresolution/quality上限はUA依存。(verified: [W3C MediaStream Recording](https://www.w3.org/TR/mediastream-recording/)) |
| WebCodecs | **frame-level decode成立** | demuxer別途、codec/hardware supportはUA/OS依存。seekはkey frame制約。(verified: [WebCodecs](https://www.w3.org/TR/webcodecs/)) |
| three.js WebGPURenderer | **experimental** | WebGPU優先、WebGL2 fallback。ただし`ShaderMaterial`/`RawShaderMaterial`/`onBeforeCompile`非対応、EffectComposer非対応でTSL/node postへ移植が必要。(verified: [three.js manual](https://threejs.org/manual/en/webgpurenderer)) |
| three.js WebGLRenderer | **継続可能** | WebGL2 rendererはmaintained、pure WebGL2 appのrecommended choice。大規模新機能はWebGPU側へ集中。(verified: same source) |

Web MIDI browser coverageのexact version表はMDN/caniuseと各vendor実装で変動する。Safari desktop/iOSは本調査時点のsupport tableで未対応、Chrome/Edge/Firefox desktopは対応とされるが、最終受入は対象browser実機で行う。(verified: [MDN limited availability](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API); exact target versions unverified)

## 7.2 WebGPU判断材料

現行FishVJはcustom `ShaderMaterial`と`EffectComposer`系postを持つ。three.js公式は、WebGPURenderer移行時にこの2つをそのまま使えないと明記する。(verified: [WebGPURenderer migration](https://threejs.org/manual/en/webgpurenderer))

従ってWebGPUはrenderer名の交換ではなくshader/post stackの移植案件。v0のframe access、MIDI、2.5D成立性を証明する前提にはならない。一方、将来compute/TSLへ寄せる選択肢は残る。(derived implication; implementation proposalではない)

## 7.3 Pro DJ Link reference

Deep-Symmetry `beat-link`はPioneer Pro DJ Link networkと通信するJava libraryで、将来producer実装時の一次source候補。(verified: [GitHub](https://github.com/Deep-Symmetry/beat-link), accessed 2026-07-20)

公式network setupは最大6 playerのBEAT SYNC等を説明するが、protocol implementation detailsは公式公開資料だけでは不足する。(verified: [PRO DJ LINK Setup Guide](https://cdn.rekordbox.com/files/20251117092919/PRODJLINK_SetupGuide_ver2_en.pdf); packet contract unverified)

---

# 8. Design implications

本節は実装案ではなく、後続instrument docで**何を決定項目にしなければならないか**を判定から逆算する。

| 調査判定 | instrument docへ効く決定 | 根拠 |
|---|---|---|
| H-01死亡 | DJ modeのjog/cue/crossfaderは「独自性」ではなくparity acceptanceへ置く。差別化文は空間周波数EQ等へ限定する | [§2](#2-dj映像-脅威表--差別化再スコープ) |
| H-02死亡 | AI prompt boxの有無をconceptの主語にしない。生成物が演奏可能になるまでのasset contractを判定対象にする | [§6.3](#63-市販vj内prompt生成) |
| H-03死亡 | realtime AIを「未来技術」として排除しない。一方、M1 local dependency、GPU最低要件、cloud dependencyを別々に記述する | [§6.1](#61-local-realtime--near-realtime) |
| H-04条件付き | 2.5Dの受入はdepth生成成功だけでなく、許容parallax、disocclusion、inpainting有無で定義する | [§5.3](#53-25d-parallaxとartifact) |
| H-05死亡 | video deckの媒体契約は「full stack必須」ではなく、GOP、cache、reverse幅、decode p95、memory ceilingを数値化する | [§3](#3-frame-access-tech-sheet) |
| H-06条件付き | background removalはprep機能として評価し、live 30fps機能と混同しない。model/license/quality setを固定する | [§5.1](#51-browser内背景除去) |
| H-07条件付き | controller acceptanceにはnormal MIDIだけでなくSysEx permission、keepalive、reconnect、latency benchを含める | [§4.4](#44-bench-required-list) |
| H-08生存 | pad input contractはbinary。velocity表現を前提にしない | [§4.2](#42-暫定midi-map) |
| parity matrix | 後続受入基準はclip/layer/FX/MIDI/camera/preview/output/record/generatorをminimum parityとして明示する | [§1.3](#13-minimum-parity-list) |
| Web platform | target browser/OSを明示し、multi-display、capture、recordingをpermission/UA依存機能として扱う | [§7.1](#71-capability表) |

## 8.1 後続docへそのまま渡せる数値

| field | fixed value / range | status |
|---|---|---|
| 1080p RGBA8 frame | 8,294,400B / 7.910MiB | sandbox-measured arithmetic |
| 4s/30fps RGBA8 stack | 995,328,000B / 949.219MiB | sandbox-measured arithmetic |
| 4s/30fps 1B/px stack | 248,832,000B / 237.305MiB | sandbox-measured arithmetic |
| half-each-axis 1B/px stack | 62,208,000B / 59.326MiB | sandbox-measured arithmetic |
| FLX4 jog turn | 7-bit relative、center 64 | verified source |
| FLX4 tempo/EQ/faders | 14-bit MSB/LSB | verified source |
| FLX4 pads | 0/127 binary | verified source、bench confirmation pending |
| FLX4 keepalive | 12-byte SysEx、Mixxx interval 200ms | verified source、necessity pending |
| browser bg removal warm M1 | 約2.7〜2.8s/1024² synthetic | sandbox-measured、quality外 |
| hosted fast image | nominal 4〜15s、$0.04〜$0.06/image | verified Krea display values |
| hosted short video | nominal 2〜5min、$0.05〜$0.20/output-sec主要例 | verified Krea display values |
| local realtime reference | 512² img2img 93.897fps/RTX4090; 14B 58.28fps/4×H100 | verified benchmark、FishVJ machine非該当 |

## 8.2 未検証を空欄のまま渡す項目

以下は回答を創作せず、benchまたは追加一次資料が出るまで`unverified`:

- FLX4の実Web MIDI port name、SysEx keepalive必須性、MIDI→photon p50/p95、LED色数。
- Apple M1/ChromeのWebGL compressed texture extension setとKTX2 transcode/upload p95。
- WebP/AVIF 120-frame sequenceのcold/warm decode・GPU upload p50/p95。
- Depth Anything/MoGeのこのM1上の処理時間と実素材品質。
- Hosted AIのqueue込みp50/p95およびvenue/public performanceに対する包括的license判断。
- CoGeの2026 current sale/support、MadMapper current purchase price、各製品の公開end-to-end input latency。

---

## 最終判定

FishVJの次工程で守るべき境界は明確になった。

- **VJ/DJ parity**: clip、layer、FX、MIDI、camera、preview/output、record、generator。DJ modeではjog/cue/crossfaderもparity。
- **死んだ主張**: 「DJ controller映像楽器がない」「live prompt VJがない」「realtime diffusionは研究demoだけ」「frame stackが唯一解」。
- **生き残る主張候補**: 空間周波数EQ、決定論replay、depth/alpha/frame-accessを含む演奏素材contract。
- **v0の硬いrisk**: 約1GBのfull RGBA stack、WebCodecsのkeyframe再decode、FLX4 SysEx permission/keepalive、2.5D disocclusion、prep model/license、WebGPU renderer移植非互換。

この判定を越えて、UI配置、実装方式、milestone採否を本書では決めない。
