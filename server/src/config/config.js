import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'http://117.50.199.239:8000/v1',
    model: process.env.QWEN_MODEL || 'Qwen2-Audio-7B-Instruct'
  },
  
  audio: {
    maxSize: parseInt(process.env.MAX_AUDIO_SIZE) || 10 * 1024 * 1024, // 10MB
    chunkDuration: parseInt(process.env.AUDIO_CHUNK_DURATION) || 30, // seconds
    format: 'wav',
    prompt: "请记录下你所听到的语音内容并加上断句，输出格式：仅纯文本，无引号，无额外说明。"
  },
  
  streaming: {
    timeout: parseInt(process.env.STREAM_TIMEOUT) || 30000 // 30 seconds
  }
};

export default config;