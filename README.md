# AIyouPlayer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-green)](https://nodejs.org/)

AI 驱动的音频伴侣：自然语言搜索本地曲库或 B 站云端，一键转音频，玻璃拟态 Aurora 风格界面。

## Features

- **双模式** — 本地曲库 / B 站云端，模式自由切换
- **AI Agent** — 通过对话告诉它你想听什么，由模型决定调用哪些 API
- **DASH 直流下载** — B 站云端模式下直连 CDN 音频流，可选 ffmpeg 转 320k MP3
- **后台任务队列** — 转换任务有并发控制与状态轮询
- **弹幕叠加** — 播放 B 站来源音频时同步显示弹幕
- **Aurora 玻璃拟态 UI** — 渐变背景 + 毛玻璃组件，支持移动端

## Tech Stack

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router) |
| 前端 | React 19 / TypeScript 5 |
| 样式 | Tailwind CSS 4 + CSS Variables |
| AI | @anthropic-ai/claude-agent-sdk（兼容 DeepSeek / Anthropic） |
| 音频 | 系统 `ffmpeg`（可选） |

## Getting Started

```bash
pnpm install        # 或 npm install
cp .env.example .env.local
pnpm dev            # http://localhost:3000
```

填好 `.env.local` 中的 `ANTHROPIC_BASE_URL` 与 `ANTHROPIC_API_KEY`。

## Project Structure

详见 [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)。简版概览：

- `app/api/*` — Route Handlers（聊天 SSE、本地搜索、B站搜索/info/convert/danmaku、音频流）
- `app/lib/*` — 后端领域逻辑（B站 API、DASH 下载、转码队列、本地曲库）
- `app/context/*` — 前端状态层（Mode / Player / Agent / Danmaku）
- `app/components/*` — 玻璃拟态 UI（顶栏、聊天、曲库、播放器、弹幕）

## Usage

### 本地模式
扫描 `AUDIO_LIB_DIR` 下的音频文件（默认 `~/Documents/aiyou-player`），支持 mp3/m4a/aac/ogg/wav/flac。

### 云端模式
1. 顶栏切换到 **云端**
2. 在 AI 聊天里描述想听什么，或在曲库面板搜索关键词
3. 点 **ADD** 触发后台下载 + ffmpeg 转码
4. 完成后自动加入播放队列；播放 B站来源音频时弹幕会自动叠加

## Notes

- B 站云端能力依赖公开 web 接口，请遵守目标平台的服务条款；不建议把本项目用于公开分发受版权保护的音频
- 转码需要系统 `ffmpeg`，缺失时会回退到 `.m4a`（浏览器原生可播）

## License

[MIT](LICENSE) — 允许商用、修改与再分发，请保留版权声明。
