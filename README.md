# 🚀 Hermes Hub

个人 AI 应用集合平台 — 管理应用、连接 AI 模型、一站式访问。

## ✨ 功能特性

- 📱 **应用管理** — 添加、编辑、删除应用，支持自定义图标和分类
- 💬 **AI 对话** — 支持多个 AI 模型（MiMo、Hermes、GPT、Claude 等）
- 🔗 **连接管理** — 连接 Hermes Agent 和 OpenClaw，统一管理
- 🌐 **网页访问** — 所有应用一键打开
- 📲 **移动适配** — 响应式设计，支持手机浏览器和 Android APK

## 🛠️ 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Pinia
- **后端**: Node.js + Express + TypeScript + SQLite
- **移动**: Capacitor (Android)

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

- Java JDK 17+
- Android Studio 或 Android SDK
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
│   │   ├── components/    # 通用组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── views/         # 页面组件
│   │   ├── types/         # TypeScript 类型
│   │   └── router/        # 路由配置
│   ├── android/           # Capacitor Android 项目
│   └── build-apk.sh       # APK 构建脚本
├── server/                 # Node.js 后端
│   ├── src/
│   │   ├── index.ts       # Express 服务器
│   │   ├── database.ts    # SQLite 初始化
│   │   └── routes/        # API 路由
│   └── .env               # 配置文件
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
