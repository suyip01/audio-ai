import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from './config/config.js';
import AudioService from './services/audioService.js';
import TranscriptionService from './services/transcriptionService.js';

const app = express();
const audioService = new AudioService();
const transcriptionService = new TranscriptionService();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.audio.maxSize
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/flac', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的音频格式'), false);
    }
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    config: {
      model: config.openai.model,
      maxAudioSize: config.audio.maxSize
    }
  });
});

// 流式音频转录接口 - 完全参照Python的process_audio函数流程
app.post('/api/audio/transcribe-stream', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传音频文件' });
    }

    console.log(`收到音频文件: ${req.file.originalname}, 大小: ${req.file.size} bytes`);

    // 设置响应头用于 SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 使用硬编码的配置参数（完全参照Python实现）
    const prompt = config.audio.prompt;
    const chunkDuration = config.audio.chunkDuration;

    console.log("开始处理音频转录任务...");
    
    res.write(`data: ${JSON.stringify({ type: 'transcription_start', message: '开始转录...' })}\n\n`);

    try {
      // 第一步：分割音频（完全参照Python的split_audio函数）
      console.log(`正在分割音频，片段时长: ${chunkDuration}秒`);
      const audioChunks = await audioService.splitAudio(req.file.buffer, chunkDuration);
      console.log(`✅ 音频分割完成，共得到 ${audioChunks.length} 个片段。`);
      
      if (!audioChunks || audioChunks.length === 0) {
        throw new Error('无法分割音频或音频为空。');
      }
      
      const transcriptions = [];
      
      // 第二步：按片段顺序串行处理（完全参照Python的process_audio函数）
      for (let i = 0; i < audioChunks.length; i++) {
        const chunk = audioChunks[i];
        console.log(`\n正在处理第 ${i + 1}/${audioChunks.length} 个音频片段...`);
        
        res.write(`data: ${JSON.stringify({ 
          type: 'chunk_start', 
          message: `正在处理第 ${i + 1}/${audioChunks.length} 个音频片段...`
        })}\n\n`);
        
        // 完全参照Python：调用流式转录函数
        let chunkTranscription = "";
        const generator = transcriptionService.transcribeAudioChunkStream(chunk, prompt);
        
        for await (const transcriptionChunk of generator) {
          chunkTranscription += transcriptionChunk;
          
          // 发送转录内容片段
          res.write(`data: ${JSON.stringify({ 
            type: 'transcription_chunk', 
            content: transcriptionChunk,
            chunkIndex: i + 1,
            totalChunks: audioChunks.length
          })}\n\n`);
          
          // 模拟实时效果，添加小延迟
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (chunkTranscription) {
          transcriptions.push(chunkTranscription);
          console.log(`✅ 第 ${i + 1} 个片段转录完成`);
        } else {
          console.log(`❌ 第 ${i + 1} 个片段转录失败！`);
        }
      }

      // 第三步：合并所有转录结果（完全参照Python）
      const fullTranscription = transcriptions.join("");
      
      // 发送完成消息
      res.write(`data: ${JSON.stringify({ 
        type: 'transcription_complete', 
        content: fullTranscription,
        message: '转录完成',
        totalChunks: audioChunks.length
      })}\n\n`);

      console.log("流式转录完成，总长度:", fullTranscription.length);
      
    } catch (error) {
      console.error("转录过程出错:", error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error.message 
      })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error("处理音频转录请求出错:", error);
    res.status(500).json({ 
      error: '音频转录失败', 
      message: error.message 
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: '文件过大', 
        message: `音频文件不能超过 ${config.audio.maxSize / (1024 * 1024)}MB` 
      });
    }
  }
  
  res.status(500).json({ 
    error: '服务器内部错误', 
    message: error.message 
  });
});

// 启动服务器
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 AI音频转录服务器启动成功！`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🎯 模型: ${config.openai.model}`);
  console.log(`📊 最大音频大小: ${config.audio.maxSize / (1024 * 1024)}MB`);
  console.log(`🔗 流式转录接口: POST http://localhost:${PORT}/api/audio/transcribe-stream`);
});

export default app;