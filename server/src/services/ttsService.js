import OpenAI from 'openai';
import { config } from '../config/config.js';

export class TTSService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.tts.apiKey || config.llm.apiKey || config.asr.apiKey,
      baseURL: config.tts.baseUrl || config.llm.baseUrl || config.asr.baseUrl
    });
  }

  async synthesize(text, voice = config.tts.defaultVoice, format = config.tts.defaultFormat) {
    if (!text || !text.trim()) return null;
    const resp = await this.client.audio.speech.create({
      model: config.tts.model,
      input: text,
      voice,
      format
    });
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async* synthesizeStream(text, voice = config.tts.defaultVoice, format = config.tts.defaultFormat, chunkSize = 64 * 1024) {
    const full = await this.synthesize(text, voice, format);
    if (!full) return;
    for (let offset = 0; offset < full.length; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, full.length);
      const chunk = full.subarray(offset, end);
      yield chunk;
    }
  }
}

export default TTSService;
