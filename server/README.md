# AI Audio Transcription Server

基于 Node.js 的音频转录服务器，支持流式输出，严格参考 Python 实现。

## 功能特性

- 🎤 音频文件上传和转录
- 🔄 流式转录输出 (Server-Sent Events)
- ✂️ 音频自动分割 (30秒片段)
- 📝 支持多种音频格式 (WAV, MP3, M4A, FLAC)
- 🌐 RESTful API 接口
- ⚡ 高性能异步处理

## 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置必要的配置：

```env
# API 配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=http://117.50.199.239:8000/v1
QWEN_MODEL=Qwen2-Audio-7B-Instruct

# 服务器配置
PORT=3001
NODE_ENV=development

# 音频处理
MAX_AUDIO_SIZE=10485760  # 10MB
AUDIO_CHUNK_DURATION=30   # 30秒

# 流式配置
STREAM_TIMEOUT=30000    # 30秒
```

### 3. 启动服务器

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

## API 接口

### 健康检查

```http
GET /health
```

返回服务器状态信息。

### 流式音频转录

```http
POST /api/audio/transcribe-stream
Content-Type: multipart/form-data
```

使用 Server-Sent Events (SSE) 实时返回转录结果。

**请求参数：**
- `audio`: 音频文件 (必填)
- `prompt`: 自定义提示词 (可选)

**响应格式：** SSE 流式数据

```javascript
event: message
data: {"type":"transcription_start","message":"开始转录..."}

data: {"type":"transcription_chunk","content":"转录内容片段"}

data: {"type":"transcription_complete","content":"完整转录文本","message":"转录完成"}
```

### 普通音频转录

```http
POST /api/audio/transcribe
Content-Type: multipart/form-data
```

一次性返回完整转录结果。

**请求参数：**
- `audio`: 音频文件 (必填)
- `prompt`: 自定义提示词 (可选)
- `duration`: 音频时长 (可选)
- `language`: 语言 (可选, 默认: zh)

**响应格式：**

```json
{
  "success": true,
  "transcription": "转录文本内容",
  "duration": 30,
  "language": "zh"
}
```

### 音频分割

```http
POST /api/audio/split
Content-Type: multipart/form-data
```

将音频文件分割成指定时长的片段。

**请求参数：**
- `audio`: 音频文件 (必填)
- `chunkDuration`: 片段时长 (可选, 默认: 30秒)

**响应格式：**

```json
{
  "success": true,
  "chunks": [
    {
      "data": "base64音频数据",
      "duration": 30
    }
  ],
  "totalChunks": 2,
  "chunkDuration": 30
}
```

## 使用示例

### JavaScript/前端使用示例

```javascript
// 流式转录
async function transcribeAudioStream(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('prompt', '请转录这段音频内容');

  const response = await fetch('http://localhost:3001/api/audio/transcribe-stream', {
    method: 'POST',
    body: formData
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'transcription_chunk') {
          console.log('实时转录:', data.content);
        } else if (data.type === 'transcription_complete') {
          console.log('转录完成:', data.content);
        }
      }
    }
  }
}
```

### cURL 示例

```bash
# 流式转录
curl -X POST http://localhost:3001/api/audio/transcribe-stream \
  -F "audio=@your-audio-file.wav" \
  -F "prompt=请转录这段音频内容"

# 普通转录
curl -X POST http://localhost:3001/api/audio/transcribe \
  -F "audio=@your-audio-file.wav" \
  -F "prompt=请转录这段音频内容"
```

## 测试

运行测试脚本：

```bash
npm test
```

## 项目结构

```
server/
├── src/
│   ├── config/
│   │   └── config.js          # 配置管理
│   ├── services/
│   │   ├── audioService.js    # 音频处理服务
│   │   └── transcriptionService.js # 转录服务
│   ├── routes/
│   │   └── audioRoutes.js     # API 路由 (可选)
│   ├── utils/
│   │   └── helpers.js         # 工具函数
│   ├── index.js              # 主服务器文件
│   └── test-transcription.js # 测试脚本
├── uploads/                    # 上传文件目录
├── package.json
├── .env.example
└── README.md
```

## 注意事项

1. **API 密钥**: 确保正确配置 `OPENAI_API_KEY` 环境变量
2. **音频格式**: 支持 WAV, MP3, M4A, FLAC 格式
3. **文件大小**: 最大支持 10MB 音频文件
4. **流式输出**: 使用 Server-Sent Events (SSE) 实现实时输出
5. **错误处理**: 完善的错误处理和状态码返回

## 故障排除

### 常见问题

1. **连接超时**: 检查 API 服务器地址是否正确
2. **转录失败**: 确认音频文件格式和 API 密钥
3. **内存不足**: 减少音频文件大小或增加服务器内存

### 日志查看

服务器启动后会显示详细的日志信息，包括：
- 转录进度
- 错误信息
- 性能统计

## 更新日志

- v1.0.0: 初始版本，支持流式音频转录
- 功能基于 Python 实现 `qwen_stream.py` 严格移植