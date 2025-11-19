import OpenAI from 'openai';
import { config } from '../config/config.js';

export class TextGenerationService {
  constructor() {
    const apiKey = config.llm.apiKey || config.asr.apiKey;
    const baseURL = config.llm.baseUrl || config.asr.baseUrl;
    this.client = new OpenAI({ apiKey, baseURL });
    this.systemPrompt = null;
  }

  async loadSystemPrompt() {
    if (this.systemPrompt) return this.systemPrompt;
    this.systemPrompt = config.llm.systemPrompt || '你是一位温暖、可靠的中文情感陪伴者，请用清晰、尊重边界且可操作的建议进行回应。';
    return this.systemPrompt;
  }

  buildMessages(history, latestUserText, systemPromptOverride) {
    const messages = [];
    const sys = systemPromptOverride || this.systemPrompt;
    if (sys) messages.push({ role: 'system', content: sys });
    const normalized = Array.isArray(history) ? history.filter(x => x && typeof x.content === 'string') : [];
    const sliced = normalized.slice(-20);
    for (const m of sliced) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: m.content });
    }
    if (latestUserText && latestUserText.trim()) messages.push({ role: 'user', content: latestUserText });
    return messages;
  }

  async generateResponse(history, latestUserText, systemPromptOverride) {
    await this.loadSystemPrompt();
    const messages = this.buildMessages(history, latestUserText, systemPromptOverride);
    console.log('LLM prompt messages:', messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : String(m.content) })));
    const model = config.llm.model || config.asr.model;
    const resp = await this.client.chat.completions.create({
      model,
      messages,
      stream: false,
      temperature: 0.2,
      max_tokens: 800
    });
    return resp.choices?.[0]?.message?.content || '';
  }
}

export default TextGenerationService;
