# 🎤 音频转录服务集成指南

## 概述

本系统实现了完整的音频上传 → 分割 → 转录 → 流式返回的音频处理流程，完全参照 Python `qwen_stream.py` 实现。

## 🏗️ 系统架构

### 后端服务结构
```
server/
├── src/
│   ├── index.js              # Express 服务器主文件
│   ├── services/
│   │   ├── audioService.js   # 音频分割服务
│   │   └── transcriptionService.js  # 转录服务
│   └── config/
│       └── config.js         # 配置文件
├── uploads/                  # 上传文件临时存储
└── package.json
```

### 核心功能
1. **音频分割**: 将长音频按指定时长(默认30秒)分割成多个片段
2. **流式转录**: 实时转录音频并逐字符返回结果
3. **进度跟踪**: 显示当前处理片段和整体进度
4. **错误处理**: 完善的错误处理和状态反馈

## 🔧 API 接口

### 流式音频转录接口

**POST** `/api/audio/transcribe-stream`

#### 请求参数
- `audio`: 音频文件 (必填)
- `prompt`: 转录提示词 (可选，默认: "请记录下你所听到的语音内容并加上断句，输出格式：仅纯文本，无引号，无额外说明。")
- `chunkDuration`: 分割时长，单位秒 (可选，默认: 30)

#### 响应格式 (SSE - Server Sent Events)
```javascript
// 开始转录
data: {"type":"transcription_start","message":"开始转录..."}

// 开始处理新片段
data: {"type":"chunk_start","message":"正在处理第 1/2 个音频片段..."}

// 转录内容片段 (逐字符/词返回)
data: {"type":"transcription_chunk","content":"玄","chunkIndex":1,"totalChunks":2}
data: {"type":"transcription_chunk","content":"学","chunkIndex":1,"totalChunks":2}

// 转录完成
data: {"type":"transcription_complete","content":"完整转录文本...","totalChunks":2}

// 错误信息
data: {"type":"error","error":"错误信息"}
```

## 🚀 前端集成示例

### 基本使用

```javascript
async function transcribeAudio(audioFile) {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('prompt', '请转录这段音频内容');
    formData.append('chunkDuration', '30');
    
    const response = await fetch('http://localhost:3001/api/audio/transcribe-stream', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'text/event-stream'
        }
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullTranscription = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                
                switch (data.type) {
                    case 'transcription_chunk':
                        fullTranscription += data.content;
                        // 实时更新UI
                        updateTranscriptionDisplay(fullTranscription);
                        break;
                        
                    case 'transcription_complete':
                        console.log('转录完成:', data.content);
                        break;
                        
                    case 'error':
                        console.error('转录错误:', data.error);
                        break;
                }
            }
        }
    }
}
```

### React 组件示例

```jsx
import React, { useState } from 'react';

function AudioTranscription() {
    const [transcription, setTranscription] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    const handleFileUpload = async (file) => {
        setIsProcessing(true);
        setTranscription('');
        
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('chunkDuration', '30');
        
        try {
            const response = await fetch('http://localhost:3001/api/audio/transcribe-stream', {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'text/event-stream' }
            });
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6));
                        
                        switch (data.type) {
                            case 'chunk_start':
                                // 更新进度信息
                                break;
                                
                            case 'transcription_chunk':
                                result += data.content;
                                setTranscription(result);
                                setProgress({ 
                                    current: data.chunkIndex, 
                                    total: data.totalChunks 
                                });
                                break;
                                
                            case 'transcription_complete':
                                setIsProcessing(false);
                                break;
                                
                            case 'error':
                                console.error('转录错误:', data.error);
                                setIsProcessing(false);
                                break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('上传失败:', error);
            setIsProcessing(false);
        }
    };
    
    return (
        <div>
            <input 
                type="file" 
                accept="audio/*" 
                onChange={(e) => handleFileUpload(e.target.files[0])}
                disabled={isProcessing}
            />
            {isProcessing && (
                <div>
                    <p>正在处理第 {progress.current}/{progress.total} 个音频片段...</p>
                    <p>已转录内容: {transcription}</p>
                </div>
            )}
            {!isProcessing && transcription && (
                <div>
                    <h3>转录结果:</h3>
                    <p>{transcription}</p>
                </div>
            )}
        </div>
    );
}
```

## 🧪 测试集成

### 1. 启动后端服务
```bash
cd server
npm run dev
```

### 2. 打开测试页面
使用浏览器打开 `test-integration.html` 文件进行完整流程测试。

### 3. 测试流程
1. 选择或拖拽音频文件到上传区域
2. 点击"开始转录"按钮
3. 观察实时转录过程和进度显示
4. 查看最终转录结果

## 📊 性能特点

### 音频分割
- **精确分割**: 基于WAV文件头解析，确保音频时长计算准确
- **智能处理**: 支持多种音频格式 (WAV, MP3, M4A, FLAC)
- **内存优化**: 流式处理，避免大文件内存占用

### 流式转录
- **实时返回**: 逐字符/词返回转录结果
- **进度跟踪**: 显示当前处理片段和整体进度
- **错误恢复**: 完善的错误处理和重试机制

### 与Python版本对比
- ✅ **功能完全一致**: 音频分割、流式转录、错误处理
- ✅ **API调用相同**: 使用相同的OpenAI SDK和参数
- ✅ **输出格式一致**: 相同的SSE流式响应格式
- ✅ **性能优化**: Node.js实现，适合Web服务部署

## 🔍 调试和故障排除

### 常见问题

1. **CORS 错误**
   - 确保服务器已配置 CORS 头
   - 检查前端请求头设置

2. **音频格式不支持**
   - 验证音频文件格式
   - 检查 MIME 类型设置

3. **转录超时**
   - 增加服务器超时设置
   - 检查网络连接稳定性

### 日志查看
服务器会输出详细日志，包括：
- 音频分割信息
- 转录进度
- 错误信息
- 性能统计

### 测试文件
使用提供的测试音频文件 `spk_1762847420.wav` 进行验证测试。

## 📈 优化建议

1. **前端优化**
   - 添加音频波形可视化
   - 实现断点续传
   - 增加音频预处理

2. **后端优化**
   - 添加缓存机制
   - 实现并发处理
   - 增加负载均衡

3. **用户体验**
   - 添加多语言支持
   - 实现音频播放同步
   - 增加转录历史记录