// 完全参照 qwen_stream.py 实现的转录服务
import OpenAI from 'openai';
import { config } from '../config/config.js';

export class TranscriptionService {
  constructor() {
    // 完全参照Python的OpenAI客户端初始化
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseUrl
    });
  }

  /**
   * 完全参照Python的extract_content函数
   * 提取单引号之间的内容，如果没有单引号则返回原文本
   */
  extractContent(text) {
    if (!text) return text;
    
    const match = text.match(/'([^']*)'/);
    return match ? match[1] : text;
  }

  /**
   * 完全参照Python的transcribe_audio_chunk_stream函数
   * 使用OpenAI SDK流式转录单个音频片段 - 返回异步生成器
   * 参数：chunkBuffer - 音频片段Buffer（对应Python的AudioSegment）
   * 返回：异步生成器，实时yield转录内容
   */
  async* transcribeAudioChunkStream(chunkBuffer, prompt) {
    console.log("开始流式转录...");
    let fullTranscription = "";
    
    try {
      // 参照Python实现：需要先将音频片段转为Base64
      // 由于Node.js没有Python的io.BytesIO和export，我们直接处理Buffer
      const audioB64Str = chunkBuffer.toString('base64');
      
      // 完全参照Python的消息结构
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "input_audio",
              input_audio: {
                data: audioB64Str,
                format: "wav"
              }
            }
          ]
        }
      ];

      // 完全参照Python的SDK调用 - 开启流式传输
      const stream = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.1,
        stream: true  // 关键：开启流式传输
      });
      
      // 完全参照Python的流式处理，但改为生成器模式
      for await (const chunk of stream) {
        // 参照Python：chunk.choices[0].delta.content 会返回当前数据块的内容
        if (chunk.choices[0].delta.content !== null) {
          const content = chunk.choices[0].delta.content;
          const cleanedContent = this.extractContent(content);
          fullTranscription += cleanedContent;
          
          // 参照Python：实时打印出当前收到的内容
          process.stdout.write(cleanedContent);
          
          // 生成器模式：实时yield每个chunk（这是与Python版本的主要区别）
          yield cleanedContent;
        }
      }
      
      console.log("\n流式转录完成。");
      
    } catch (error) {
      console.error(`流式转录音频片段时发生错误: ${error}`);
      // 异常时不yield任何内容，与Python行为一致
    }
  }
}

export default TranscriptionService;
