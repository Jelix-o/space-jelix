# 🚀 Space Jelix

> **v1.0** — [GitHub Releases](https://github.com/Jelix-o/space-jelix/releases)

个人 AI 应用集合平台 — 管理应用、AI 对话、终端连接、一站式访问。

## ✨ 功能特性

- 🔐 **登录认证** — JWT 单密码认证，保护数据安全
- 📱 **应用管理** — 添加、编辑、删除应用，支持自定义图标和分类
- 💬 **AI 对话** — 支持多个 AI 模型（MiMo、Hermes、GPT、Claude 等），会话管理
- 🖥️ **终端连接** — SSH 终端管理，支持密码/密钥认证，内置网页终端
- 🎨 **AI 生图** — 支持 DALL-E、GPT-Image、Flux 等生图模型
- ⚙️ **服务商管理** — 配置多个 AI 服务商和模型列表
- 🌐 **内置浏览器** — 应用内 iframe 打开外部链接
- 📲 **Android APK** — 全面屏适配、原生状态栏、键盘弹起处理、返回键多层回退

## 🛠️ 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Pinia + Vue Router
- **后端**: Node.js + Express + TypeScript + SQLite (node:sqlite)
- **移动**: Capacitor 8 (Android)，支持 edge-to-edge 全面屏
- **部署**: Nginx 反向代理 + Cloudflare DNS

## 🚀 快速开始

### 1. 启动后端

```bash
cd server
npm install
npm run dev
# 后端运行在 http://localhost:3002
```

### 2. 启动前端

```bash
cd client
npm install
npx vite --host 0.0.0.0
# 前端运行在 http://localhost:5173
```

### 3. 访问

打开浏览器访问 `http://localhost:5173`

## 📱 构建 Android APK

### 前置条件

- Java JDK 21+
- Android SDK (platform-tools, platforms;android-35, build-tools;35.0.0)
- Node.js 18+

### 构建步骤

```bash
cd client
chmod +x build-apk.sh
./build-apk.sh
```

APK 输出路径: `client/android/app/build/outputs/apk/debug/app-debug.apk`

## 📁 项目结构

```
hermes-hub/
├── client/                 # Vue 3 前端
│   ├── src/
│   │   ├── api/           # API 客户端
│   │   ├── components/    # 通用组件 (AppSelect, BrowserOverlay, ConfirmDialog, ModelSheet)
│   │   ├── composables/   # 组合式函数 (useBackButton, useBrowser, useConfirm, useContextMenu,
│   │   │                   #   useKeyboardInset, useModalLock, useNativeBackClose, useToast)
│   │   ├── stores/        # Pinia 状态管理 (apps, chat, connections, providers)
│   │   ├── utils/         # 工具函数 (nativeAppearance, openUrl)
│   │   ├── views/         # 页面组件 (Home, Chat, ChatSession, Connections, Terminal,
│   │   │                   #   Generate, Settings, AppDetail)
│   │   ├── types/         # TypeScript 类型定义
│   │   └── router/        # 路由配置
│   ├── android/           # Capacitor Android 项目
│   └── build-apk.sh       # APK 构建脚本
├── server/                 # Node.js 后端
│   ├── src/
│   │   ├── index.ts       # Express 服务器入口
│   │   ├── database.ts    # SQLite 数据库初始化
│   │   ├── auth.ts        # JWT 登录认证中间件
│   │   └── routes/        # API 路由 (apps, chat, hermes, providers, terminals, proxy)
│   └── .env               # 配置文件 (AUTH_PASSWORD, API keys)
├── DEPLOYMENT.md           # 部署指南和验收清单
└── README.md
```

## 🔧 API 端点

### 应用管理
- `GET /api/apps` — 获取应用列表
- `POST /api/apps` — 创建应用
- `PUT /api/apps/:id` — 更新应用
- `DELETE /api/apps/:id` — 删除应用

### AI 对话
- `GET /api/chat/models` — 获取可用模型
- `POST /api/chat/conversations` — 创建对话
- `POST /api/chat/conversations/:id/messages` — 发送消息

### 连接管理
- `GET /api/hermes/connections` — 获取连接列表
- `POST /api/hermes/connections` — 创建连接
- `POST /api/hermes/connections/:id/test` — 测试连接
- `DELETE /api/hermes/connections/:id` — 删除连接

## ⚙️ 配置

### 环境变量 (server/.env)

```env
PORT=3002
AUTH_PASSWORD=your-password        # 登录密码，未设置则跳过认证
MIMO_API_URL=http://127.0.0.1:8317/v1
MIMO_API_KEY=your-api-key
MIMO_MODEL=mimo-v2.5-pro
```

### 支持的 AI 模型

| 模型 | 提供商 | 环境变量 |
|------|--------|----------|
| MiMo V2.5 Pro | Xiaomi | MIMO_API_KEY |
| Hermes 3 | NousResearch | NOUS_API_KEY |
| GPT-4o | OpenAI | OPENAI_API_KEY |
| Claude Sonnet | Anthropic | ANTHROPIC_API_KEY |
| DeepSeek V3 | DeepSeek | DEEPSEEK_API_KEY |
| Qwen Plus | Alibaba | DASHSCOPE_API_KEY |

## 📄 License

MIT
