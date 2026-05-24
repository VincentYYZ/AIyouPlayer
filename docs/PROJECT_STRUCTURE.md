# AIyouPlayer · 项目结构

```
AIyouPlayer/
├── app/
│   ├── api/                       # Next.js Route Handlers
│   │   ├── chat/route.ts          # AI Agent SSE 入口
│   │   ├── search/route.ts        # 本地曲库关键词搜索
│   │   ├── tracks/scan/route.ts   # 全量扫描本地曲库
│   │   ├── audio/[...segments]/   # 本地音频静态服务（支持 Range）
│   │   └── bili/
│   │       ├── search/route.ts    # B 站视频搜索
│   │       ├── info/route.ts      # bvid -> cid/title
│   │       ├── convert/route.ts   # 创建/查询后台转换任务
│   │       └── danmaku/route.ts   # 拉取并解析弹幕
│   ├── components/
│   │   ├── chat/                  # ChatPanel / Composer / Message
│   │   ├── danmaku/DanmakuOverlay.tsx
│   │   ├── layout/AppShell.tsx
│   │   ├── library/LibraryPanel.tsx
│   │   ├── player/PlayerBar.tsx
│   │   ├── providers/AppProviders.tsx
│   │   ├── topbar/                # TopBar / ModeSwitch
│   │   └── ui/                    # GlassCard / IconButton / Pill
│   ├── context/
│   │   ├── AgentContext.tsx       # 聊天状态 + 转换任务跟踪
│   │   ├── DanmakuContext.tsx     # 弹幕开关 + 加载缓存
│   │   ├── ModeContext.tsx        # 本地 / 云端 模式
│   │   └── PlayerContext.tsx      # 播放队列与 audio 控制
│   ├── hooks/
│   │   └── useSSE.ts              # POST + text/event-stream 流式消费
│   ├── lib/
│   │   ├── audioLib.ts            # 本地曲库扫描 / 文件名解析 / 路径解析
│   │   ├── bili/
│   │   │   ├── api.ts             # 视频信息 / 搜索 / DASH / 弹幕
│   │   │   ├── download.ts        # DASH 流下载 + ffmpeg 转码
│   │   │   ├── headers.ts         # 公共 headers + cookie
│   │   │   ├── jobs.ts            # 内存任务队列与并发控制
│   │   │   └── wbi.ts             # WBI 签名
│   │   ├── env.ts                 # 环境变量解析
│   │   ├── parseTracks.ts         # ```tracks / ```added 代码块解析
│   │   └── types.ts               # 共享类型
│   ├── globals.css                # Aurora 渐变 + 玻璃拟态 token
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── .env.example
├── AGENTS.md
├── LICENSE                        # MIT
├── README.md
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## 数据流速览

### 本地模式
```
LibraryPanel/Composer
  → /api/search 或 /api/tracks/scan
  → audioLib.scanAudioLib / searchTracks
  → 返回 AudioTrack[]
  → PlayerContext.addToQueue / playTrack
  → <audio src="/api/audio/...">
```

### 云端模式
```
ChatPanel.send / LibraryPanel CloudLibrary
  → /api/bili/search 关键词检索
  → AgentContext.enqueueDownloads(bvids)
  → /api/bili/convert (POST) → bili/jobs 加入队列
  → 后台 jobs.runJob:
       getVideoInfo → getDashAudios → downloadAudio → (ffmpeg) → 写入音频库
  → /api/bili/convert (GET 轮询) 返回 ConvertJob.tracks
  → PlayerContext.addToQueue
  → 弹幕：DanmakuContext 拉 /api/bili/danmaku 缓存并按时间戳投影
```
