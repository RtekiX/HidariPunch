# 日语直播的本地语音识别方案

本项目当前直接接入 **whisper.cpp HTTP 服务**，已支持官方 Kotoba-Whisper v2.0 Q5 GGML 模型。默认是无需 Key 的仅识别模式，日语原文直接显示为字幕。勾选「启用中文翻译」后才调用 DeepSeek。faster-whisper 尚未集成。

## 方案比较

| 方案 | 适用场景 | 硬件与取舍 | 当前插件 |
| --- | --- | --- | --- |
| whisper.cpp + 多语言 Whisper | Windows 本机部署；AMD / Intel 可考虑 Vulkan | C/C++，可用 CPU；Vulkan 需正确构建和驱动，具体速度实测 | 已接入 `/health`、`/inference` |
| faster-whisper | 已有 Python 环境，CPU 或 NVIDIA CUDA | CTranslate2；CPU 可用 int8；官方 GPU 路径主要为 NVIDIA CUDA，不应把 AMD 显卡配置成 CUDA | 未集成，需接口适配 |
| Kotoba-Whisper v2.0 Q5 | 专注日语，比较直播识别效果 | 使用官方 GGML 权重，由 whisper.cpp 执行；约 538 MB，比 base 更大，不保证 CPU 更快 | 已接入，名称 `kotoba-v2` |

## 试用 Kotoba-Whisper

```powershell
npm run local:setup -- kotoba-v2
npm run local:start -- kotoba-v2
```

现在不指定模型的 `local:setup` / `local:start` 默认使用 `kotoba-v2`。如果当前服务已经运行，可下载后通过以下命令切换，不必重新加载扩展；切换时会短暂暂停识别，若插件因请求中断停止，请重新点击开始识别：

```powershell
npm run local:switch -- kotoba-v2
```

回到原模型：`npm run local:switch -- base`。模型切换只影响当前服务，下次启动通过 `local:start -- 模型名` 选择。启动器的工作目录必须为 `.local`，这是模型切换相对路径的基准。

Kotoba 权重来自官方 `kotoba-tech/kotoba-whisper-v2.0-ggml` 仓库，选用 `ggml-kotoba-whisper-v2.0-q5_0.bin`，安装时校验仓库 LFS SHA-256。不需要 Python 或新的 API Key。模型卡标注 Apache 2.0 许可证。

模型速度取决于硬件、运行库与并发负载。Kotoba 比 base 更大，不能把“日语专用”理解成“在 CPU 上更快”。个人机器的性能记录、配置和测试音频不随仓库发布。

若下载需使用本机已有代理，可以仅在下载终端设置，例如：

```powershell
$env:HIDARI_DOWNLOAD_PROXY = 'http://127.0.0.1:YOUR_PROXY_PORT'
npm run local:setup -- kotoba-v2
```

请将 YOUR_PROXY_PORT 替换为自己的代理端口。此选项使用 Node.js 标准安装中 npm 自带的 HTTP 客户端，不修改系统代理；服务处理音频和本地模型推理均不经过下载代理。

whisper.cpp、faster-whisper 是推理引擎；`base`、`small`、`large-v3-turbo` 才是所加载的模型档位。同一个 Whisper 模型可以由不同引擎运行，但格式不一定相同。

## 给 AMD / Intel 用户的起点

- 先用多语言 `base`，验证音频捕获、本地识别、DeepSeek 翻译和字幕显示。
- 如果机器能跟上，尝试 `small`，比较日语人名和口语准确度。CPU 慢时降回 `base` / `tiny`。
- 显卡支持 Vulkan 时，尝试 whisper.cpp Vulkan。不要预先承诺某个模型“必定实时”；短片段处理耗时加翻译耗时最好小于音频分段长度，否则会跳过积压音频。
- `large-v3-turbo` 可以作为资源充足后的候选，需要更多内存和显存。不要默认下载最大模型。
- `.en` 为英语专用，不适合日语。本项目请求固定 `language=ja`、`translate=false`，先输出日语，再交给 DeepSeek 翻译。

## CPU 兼容版

在项目根目录执行：

```powershell
npm run local:setup -- base
npm run local:start -- base
```

默认下载位置 `.local/whisper`、`.local/models`。模型优先从 `ggerganov/whisper.cpp` 的 Hugging Face 仓库下载，连接失败时尝试 hf-mirror.com，并校验官方 README 列出的模型哈希。安装只在本项目内写文件，不会安装 Python、CUDA 或系统服务。若提示 DLL 缺失，请根据官方发行包要求安装 Microsoft Visual C++ x64 运行库。

端口被占用时，在启动终端设置（插件也须填写相同端口）：

```powershell
$env:HIDARI_LOCAL_PORT = '8081'
npm run local:start -- base
```

## Vulkan 版本（需编译工具）

一键配置提供社区 Vulkan 预编译运行库，并验证本地推理；来源见 README。以下保留从源码构建的备选步骤。

需要 Git、CMake、Visual Studio C++ 编译工具，以及 Vulkan SDK 和支持 Vulkan 的显卡驱动。当前项目没有自动安装这些系统工具。可在 Visual Studio 的开发者 PowerShell 中，按 whisper.cpp 官方说明构建，例如：

```powershell
git clone --branch v1.9.5 --depth 1 https://github.com/ggml-org/whisper.cpp.git .local/whisper-vulkan
cmake -S .local/whisper-vulkan -B .local/whisper-vulkan/build -DGGML_VULKAN=1
cmake --build .local/whisper-vulkan/build --config Release -j
$env:HIDARI_WHISPER_SERVER = (Resolve-Path .local/whisper-vulkan/build/bin/Release/whisper-server.exe).Path
npm run local:start -- base
```

`HIDARI_WHISPER_SERVER` 指向自编译的 exe 后，启动器不会附加 `--no-gpu`。检查 whisper.cpp 启动日志，确认实际选中的 GPU；不要仅凭能启动就认为正在 GPU 加速。若编译输出目录不同，请调整路径。

服务仅绑定 127.0.0.1。使用独立 whisper.cpp 服务时，也请显式设置 `--host 127.0.0.1`，无需开启 `--convert`：扩展已在浏览器内转换 WAV。

## 故障排查

- **检查本地服务失败**：确认 whisper-server 在运行，端口一致；Chrome 若提示本地网络访问，需允许扩展访问本机。健康检查成功仅表示服务就绪，不表示日语识别正确。
- **模型下载失败**：检查 GitHub / Hugging Face 连通性后重试；`.part` 是未完成的下载，脚本重试会重写它。也可手动将完整模型放到 `.local/models/ggml-base.bin`。
- **API Key 无效**：需 DeepSeek 开放平台的 API Key。旧 OpenAI Key 和聊天订阅不会自动变成 DeepSeek Key。
- **字幕落后 / 跳过片段**：换小模型、启用受支持的加速，或增加分段长度；播放直播时还应考虑其他应用的 GPU 占用。
- **无声音**：先检查 YouTube 自身音量；插件会通过 AudioContext 将捕获的声音重新播放。停止翻译应释放捕获并恢复标签页正常播放。
- **音乐被识别为文字**：低能量过滤无法识别音乐，必要时停止翻译。本版本还没有完整 VAD。
- **切换视频、关闭标签或点击停止**：停止捕获、丢弃待处理音频、取消请求；本地模型进程仍常驻，需在启动服务的终端 Ctrl+C 退出。

## 官方来源

- [whisper.cpp：CPU、Vulkan 与构建](https://github.com/ggml-org/whisper.cpp)
- [whisper.cpp HTTP 服务](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server)
- [faster-whisper：CPU int8 与 CUDA 要求](https://github.com/SYSTRAN/faster-whisper)
- [Kotoba-Whisper v2.0：日语模型与评测](https://huggingface.co/kotoba-tech/kotoba-whisper-v2.0)
- [DeepSeek：Chat Completions 参数与模型](https://api-docs.deepseek.com/api/create-chat-completion/)
