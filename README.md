# AI Audio & Chat 前后端部署指南

## 项目简介
- 前端：React + Vite，支持文本聊天与录音模式，音频转写流式展示与 TTS 播放。
- 后端：Node.js + Express，提供音频转录 `/api/audio/transcribe-stream` 与文本聊天 `/api/text/chat` 接口，支持 SSE 流式输出与 TTS 语音段落。

## 目录结构
- `src/` 前端源码
- `server/` 后端源码
- `vite.config.ts` 前端开发代理，将 `/api` 代理到后端 `http://localhost:3001`

## 运行环境
- Node.js ≥ 18（推荐 LTS）
- npm 或 pnpm
- FFmpeg（建议安装系统级，用于音频处理）
  - macOS：`brew install ffmpeg`
  - Windows：`choco install ffmpeg`
  - Linux(Ubuntu)：`sudo apt-get install ffmpeg`

## 后端配置
- 复制并编辑 `server/.env`，填写以下变量（示例为占位，不要使用真实密钥）：
```
# API Configuration
ASR_API_KEY=your_asr_key
ASR_BASE_URL=https://your-asr-endpoint
ASR_MODEL=Qwen2-Audio-7B-Instruct

TTS_API_KEY=your_tts_key
TTS_BASE_URL=https://your-tts-endpoint
TTS_MODEL=IndexTeam/IndexTTS-2
TTS_DEFAULT_VOICE=novel
TTS_DEFAULT_FORMAT=wav

LLM_API_KEY=your_llm_key
LLM_BASE_URL=https://your-llm-endpoint
LLM_MODEL=deepseek-ai/DeepSeek-V3-0324

# Server Configuration
PORT=3001
NODE_ENV=development

# Audio Processing
MAX_AUDIO_SIZE=31457280
AUDIO_CHUNK_DURATION=30

# Streaming Configuration
STREAM_TIMEOUT=30000
```
- 说明：
  - `MAX_AUDIO_SIZE` 单位为字节，示例 30MB。
  - 录音转写与 TTS 依赖外部 API，请按实际服务商配置 `*_API_KEY` 与 `*_BASE_URL`。

## 安装与启动（开发环境）
### 后端
```
cd server
npm install
npm run dev
```
- 启动地址：`http://localhost:3001`
- 健康检查：`GET /health`
- 核心接口：
  - `POST /api/audio/transcribe-stream`（multipart/form-data，字段 `audio`）
  - `POST /api/text/chat`（JSON：`message`, `history`）

### 前端
```
npm install
npm run dev
```
- 默认前端开发端口：Vite 5173
- 代理：`/api` → `http://localhost:3001`（见 `vite.config.ts`）

## 部署（生产环境）
### 后端部署
- 方式一：直接 Node 运行
```
cd server
npm install --production
npm run start
```
- 方式二：使用进程管理器（如 PM2）
```
pm install -g pm2
cd server
pm2 start src/index.js --name ai-audio-server
pm2 save
```
- 确保 `.env` 已正确配置并不对外泄露。

### 前端构建与部署
```
npm install
npm run build
```
- 构建产物位于 `dist/`，可部署到任意静态资源服务器（Nginx、CDN 等）。
- 生产环境需将 `/api` 反向代理到后端服务，如 Nginx：
```
location /api/ {
  proxy_pass http://localhost:3001/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 浏览器与安全
- 录音需安全环境：HTTPS 或 `http://localhost`。
- MediaSource 播放 TTS 需浏览器支持 `audio/webm;codecs=opus`（现代 Chrome/Edge/Firefox 均支持）。

## 常见问题
- 无法获取麦克风：请使用 HTTPS 或 `localhost`，并确保浏览器权限已允许麦克风。
- FFmpeg 找不到：安装系统级 FFmpeg 并确保在 `PATH` 中；或配置 `FFMPEG_PATH` 环境变量。
- 文本生成失败：后端会在控制台打印异常详情，同时通过 SSE 发送 `stream_error` 的 `details` 字段到前端。
- 音频过大：调整 `MAX_AUDIO_SIZE`，并重启后端使配置生效。

## 关键脚本
- 前端
  - `npm run dev` 本地开发
  - `npm run build` 生产构建
  - `npm run preview` 本地预览构建产物
- 后端
  - `npm run dev` 开发模式（nodemon）
  - `npm run start` 生产模式

## 接口摘要
- `POST /api/audio/transcribe-stream`
  - 请求：`FormData(audio=wav|mp3|m4a|flac|webm)`，可选 `history`
  - 响应：SSE，事件包括 `transcription_start`, `transcription_chunk`, `transcription_complete`, `chat_complete`, `tts_*`, `stream_error`
- `POST /api/text/chat`
  - 请求：`{ message, history }`
  - 响应：`{ response | output | summary }`

## 提示
- 不要将真实密钥提交到仓库；生产部署使用安全的密钥管理方式。
 
## Ubuntu 生产环境部署步骤（与测试环境一致版本）
- 目标：在 Ubuntu 上部署与本地测试一致的运行环境与依赖版本，避免兼容性问题。

### 1. 系统依赖安装
```
sudo apt-get update
sudo apt-get install -y build-essential python3 make g++ curl git ffmpeg nginx
```
- 说明：
- `build-essential / make / g++ / python3` 用于构建原生模块（如 `nodejieba`）。
- `ffmpeg` 用于后端音频处理。
- `nginx` 用于前端静态站点与反向代理。

### 2. 安装 Node.js 18（LTS）
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 18
nvm alias default 18
node -v
npm -v
```
- 使用 `Node.js 18` 可与本地测试环境保持兼容；后续依赖版本以锁文件为准。

### 3. 拉取代码并按锁文件安装依赖
```
# 进入部署目录（以 /opt 为例）
sudo mkdir -p /opt/ai-audio && sudo chown -R $USER:$USER /opt/ai-audio
cd /opt/ai-audio
# 将仓库代码复制或拉取到此目录

# 前端依赖按锁文件安装（确保版本一致）
npm ci

# 后端依赖按锁文件安装（仅生产依赖）
cd server
npm ci --only=production
```
- 说明：
- `npm ci` 使用锁文件安装，确保与测试环境的依赖版本完全一致。
- 后端使用 `--only=production` 跳过开发依赖（如 `nodemon`）。

### 4. 配置后端环境变量
```
cd /opt/ai-audio/server
cp .env .env.production
# 编辑 .env 或 .env.production，写入真实密钥与服务端点
nano .env
```
- 确认 `PORT=3001`、`MAX_AUDIO_SIZE=31457280` 等参数；保存后端口。

### 5. 启动后端服务（PM2）
```
npm install -g pm2
pm2 start src/index.js --name ai-audio-server
pm2 save
pm2 startup systemd
# 按提示运行生成的 systemd 命令，使 PM2 随系统启动
```
- 验证：
```
curl -f http://localhost:3001/health
```

### 6. 构建前端并部署到 Nginx
```
cd /opt/ai-audio
npm run build
sudo mkdir -p /var/www/ai-audio
sudo cp -r dist/* /var/www/ai-audio/
```
- 配置 Nginx：
```
# /etc/nginx/sites-available/ai-audio.conf
server {
  listen 80;
  server_name _;
  root /var/www/ai-audio;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://localhost:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}

sudo ln -sf /etc/nginx/sites-available/ai-audio.conf /etc/nginx/sites-enabled/ai-audio.conf
sudo nginx -t && sudo systemctl reload nginx
```

### 7. 开放端口与开机自启
```
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# 后端 3001 仅对本机访问，Nginx 通过反向代理转发；如需外部访问可显式开放：
# sudo ufw allow 3001/tcp
```
- PM2 已配置 `startup systemd`；Nginx 默认为 systemd 管理。

### 8. 生产环境验证
- 前端访问：`http://<服务器IP>/`，可正常加载页面。
- 文字聊天：前端走 `/api/text/chat` 通过 Nginx 代理到后端。
- 录音与转写：前端走 `/api/audio/transcribe-stream` 代理到后端；浏览器需 HTTPS 或 `localhost`，生产环境建议配置 TLS。

### 9. 版本一致性建议
- 保持 Node.js 主版本为 18 并使用 `npm ci`；如需升级，先在测试环境验证，再更新生产。
- 使用同一套 `.env` 模板；密钥通过安全方式注入（不写入仓库）。
- 如需锁定 PM2 版本：`npm i -g pm2@5`（示例），先在测试环境确认。
