# HidariPunch · YouTube 日中直播字幕

Chrome 插件：本地识别日语直播，字幕显示在播放器下方；可选使用 DeepSeek 翻译成简体中文。默认仅识别，无需 API Key。

**音频 → 本机 whisper.cpp / Kotoba-Whisper → 日语字幕 → 可选 DeepSeek 中文字幕。**

## Windows 一键配置

1. 下载本仓库 ZIP 并解压到固定目录，双击 **`setup.cmd`**。
2. 脚本自动准备 Node.js 22（若已有则复用）、下载并校验模型和运行库，检查实际本地推理。优先尝试 Vulkan + Kotoba v2.0 Q5；验证失败则回退 CPU + base。
3. 安装完成后，本地服务自动启动。**观看时保留这个终端窗口**，按 Ctrl+C 停止；以后双击 **`start.cmd`** 即可启动。
4. Chrome 打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择本项目文件夹。
5. 刷新 YouTube 视频/直播页并播放声音，点击插件图标 →「检查本地服务」→「开始识别」。

Chrome 扩展加载需要手动完成；脚本不会修改浏览器安全设置、安装显卡驱动或注册开机启动。支持 Windows x64、Chrome 116+；首次配置需要联网。无 GPU 加速时 CPU 识别速度取决于硬件。

首次下载可能较慢：Kotoba Q5 约 538 MB，base 约 148 MB，另有运行库。所有下载、本机配置、日志都在 `.local/`，不包含在 Git 仓库中。

如需固定 CPU 或只安装不启动：

```powershell
.\setup.cmd -Backend cpu
.\setup.cmd -NoStart
```

网络需要代理时，在终端设置自己的代理地址再执行安装：

```powershell
$env:HIDARI_DOWNLOAD_PROXY = 'http://127.0.0.1:YOUR_PROXY_PORT'
.\setup.cmd
```

请替换 `YOUR_PROXY_PORT`。下载优先使用官方仓库；模型直连失败时会尝试 hf-mirror.com，并检查同一模型哈希。

## 启用中文翻译

打开插件，勾选「启用中文翻译」，填写自己的 **DeepSeek API Key**，保留默认翻译模型或填写账户支持的模型，再停止并重新开始识别。Key 只在自己的浏览器中配置，不需要写入源文件。

默认 Key 存在浏览器会话存储中；可选「在本机保存密钥」会未加密地写入扩展本地存储。仅识别模式即使存在 Key，也不会调用 DeepSeek。翻译 API 单独计费。

翻译时附带最近 3 段已完成的日语原文和译文，作为指代、衔接与术语的参考，要求模型只输出当前段译文、不重复历史内容。局部识别错误尽量保留可理解部分，仅对无法理解的片段标注「原文不明」。上下文仅保存在当前识别会话的内存中，停止、重新启动或切换视频时清空，不写入文件或浏览器存储。启用翻译时，这些历史文本也会随当前段发送给 DeepSeek，增加少量输入用量。

## 字幕位置与更新

拖住字幕面板标题栏即可移动为浮层；也可选中标题栏后用方向键微调。位置保存在本机，窗口变小时自动限制在可见范围内；点击「复位」回到播放器下方。

本地服务运行时，点击插件里的 **「一键更新」**，会从本仓库 `main` 更新源码并重新加载扩展。更新前会停止识别；更新完成后请重新启动 `start.cmd`，再刷新 YouTube 页面。已有旧版服务没有更新接口时，先双击 **`update.cmd`** 更新一次，再重启服务。

`update.cmd` 也可独立用于以后更新。Git 安装仅允许干净的 `main` 分支快进更新，发现本地源码改动会停止；ZIP 安装会校验下载的源码，并在 `.local/update-backups/` 备份旧源码。两种方式均保留 `.local`、模型和浏览器中保存的 Key、设置与字幕位置。更新不会卸载扩展或清除浏览器存储。

更新只获取固定仓库的源码，不更新模型、第三方识别运行库或显卡驱动。更新按钮需要由 `start.cmd` 启动的新版 Node 服务；直接运行 whisper-server.exe 时请使用 `update.cmd`。服务对外仍只绑定本机端口 8080，内部模型服务使用派生的本机端口。

## 手动运行与模型切换

已有 Node.js 22+：

```powershell
npm run local:setup -- kotoba-v2
npm run local:setup:vulkan
npm run local:start:vulkan
```

CPU 轻量方案：

```powershell
npm run local:setup -- base
npm run local:start -- base cpu
```

服务运行后切换模型：`npm run local:switch -- kotoba-v2` 或 `npm run local:switch -- base`（需先下载对应模型）。默认端口 8080，可用 `HIDARI_LOCAL_PORT` 修改，插件中填写相同端口。

Vulkan 使用兼容配置关闭 Flash Attention 和 cooperative matrix，运行时日志应出现 `using Vulkan0 backend`。GPU 能被检测到不等于实际推理成功；一键配置会额外发起一次本地推理检查。更多方案见 [本地识别说明](docs/LOCAL_ASR.md)。

## 隐私与限制

- 只有点击开始后才捕获当前 YouTube 标签页的声音，不使用麦克风。标签页广告等声音也会被捕获。
- 音频仅发往 `127.0.0.1` 的本地服务。只有启用翻译时，日语文字才会发给 DeepSeek。
- 字幕历史仅存在当前页面内存中，最近 60 条，可清空。停止识别不等于退出本地模型服务。
- 默认采集 5 秒后进行识别；可选 3 / 8 秒。模型推理耗时之外仍有采集延迟；过短片段可能截断词句。
- 仅有静音能量过滤，尚无完整 VAD 或说话人区分；翻译使用最近 3 段文本上下文，但音频识别仍按段独立处理，音乐、多人说话、人名等可能识别错误。
- 普通/剧场模式下在播放器下方显示；YouTube 原生全屏、Shorts、嵌入式播放器和移动站不支持。
- 当前是开发者模式安装，尚未发布到 Chrome Web Store。

## 运行库来源

CPU 运行库来自 [whisper.cpp 官方发行包](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.8.3)，校验 SHA-256。Vulkan 运行库为 [社区 MinGW 构建](https://github.com/nyancodex/whisper-server-vulkan-windows)，固定 Git blob 并校验内容，不运行其 GUI 安装器。

Kotoba 模型来自 [Kotoba 官方 GGML 仓库](https://huggingface.co/kotoba-tech/kotoba-whisper-v2.0-ggml)，校验 SHA-256；标准 Whisper 模型校验官方公布的哈希。第三方模型与运行库遵循各自许可证，不随源码打包分发。

## 开发与发布检查

扩展无需构建，也无需安装 npm 依赖：

```powershell
npm run check
npm test
npm run check:publish
```

`check:publish` 检查 Git 暂存区，拒绝本机运行目录、常见密钥文件、Token 格式和个人路径。它是辅助检查，不能替代人工审核。默认忽略 `.local/`、模型、音频、日志、环境文件、凭据及本机验证记录。
