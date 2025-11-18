import OpenAI from 'openai';
import { config } from '../config/config.js';
import nodejieba from 'nodejieba';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
const ffmpegPath = (ffmpegInstaller && (ffmpegInstaller.path || (ffmpegInstaller.default && ffmpegInstaller.default.path))) || undefined;
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export class TTSService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.tts.apiKey || config.llm.apiKey || config.asr.apiKey,
      baseURL: config.tts.baseUrl || config.llm.baseUrl || config.asr.baseUrl
    });
  }

  async synthesize(text, voice = config.tts.defaultVoice, format = 'wav') {
    if (!text || !text.trim()) return null;
    console.log(`TTS synth start: format=${format}, text_len=${text.length}, preview="${text.slice(0,80)}"`);
    const resp = await this.client.audio.speech.create({
      model: config.tts.model,
      input: text,
      voice,
      format
    });
    const arrayBuffer = await resp.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    console.log(`TTS synth done: bytes=${buf.length}`);
    return buf;
  }

  async* synthesizeStream(text, voice = config.tts.defaultVoice, format = 'webm') {
    if (!text || !text.trim()) return;
    const maxLen = config.tts?.maxSegmentLength || 40;
    const segments = splitTextIntoSentences(text, maxLen);
    console.log(`TTS stream start: segments=${segments.length}`);
// 生成时间戳目录
//    const ts = new Date().toISOString().replace(/[:.]/g, '-');
//    const baseDir = path.join(process.cwd(), 'server', 'output', 'tts', ts);
//    const wavDir = path.join(baseDir, 'segment_wav');
//    const webmDir = path.join(baseDir, 'segment_webm');
//    try { await fs.mkdir(wavDir, { recursive: true }); await fs.mkdir(webmDir, { recursive: true }); console.log(`TTS save dir: ${baseDir}`); } catch {}
    let idx = 0;
    for (const seg of segments) {
      if (!seg || !seg.trim()) continue;
      console.log(`TTS segment ${idx + 1}/${segments.length}: text_len=${seg.length}`);
      const wavBuf = await this.synthesize(seg, voice, 'wav');
      if (!wavBuf) continue;
// 保存WAV文件
//      try { await fs.writeFile(path.join(wavDir, `seg_${idx + 1}.wav`), wavBuf); } catch {}
      const webmBuf = await transcodeWavToWebm(wavBuf);
// 保存WebM文件
//      try { await fs.writeFile(path.join(webmDir, `seg_${idx + 1}.webm`), webmBuf); } catch {}
      const { init, media } = extractWebMInitAndMedia(webmBuf);
      if (idx === 0) {
        yield { kind: 'webm_init', data: init, format: 'webm', segmentIndex: idx };
      }
      yield { kind: 'webm_segment', data: media, format: 'webm', segmentIndex: idx };
      idx += 1;
    }
  }
}

export default TTSService;

function extractWebMInitAndMedia(buffer) {
  const bytes = new Uint8Array(buffer);
  const pattern = [0x1F, 0x43, 0xB6, 0x75];
  let pos = -1;
  for (let i = 0; i <= bytes.length - pattern.length; i++) {
    if (bytes[i] === pattern[0] && bytes[i + 1] === pattern[1] && bytes[i + 2] === pattern[2] && bytes[i + 3] === pattern[3]) {
      pos = i;
      break;
    }
  }
  if (pos <= 0) {
    console.log(`WebM split fallback: bytes=${bytes.length}`);
    const fallbackPos = Math.min(bytes.length, 1024);
    const init = buffer.subarray(0, fallbackPos);
    const media = buffer.subarray(fallbackPos);
    return { init, media };
  }
  console.log(`WebM split at pos=${pos}, total=${bytes.length}`);
  const init = buffer.subarray(0, pos);
  const media = buffer.subarray(pos);
  return { init, media };
}

async function ensureFFmpeg() { /* using native ffmpeg via fluent-ffmpeg */ }

async function transcodeWavToWebm(wavBuffer) {
  console.log(`Transcode wav->webm start: wav_bytes=${wavBuffer.length}`);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tts-'));
  const inputPath = path.join(tmpDir, 'input.wav');
  const outputPath = path.join(tmpDir, 'output.webm');
  await fs.writeFile(inputPath, wavBuffer);
  const dv = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength);
  let off = 12; let sr = 0; let ch = 1; let bps = 16; let dataLen = 0;
  while (off + 8 <= wavBuffer.length) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off+1), dv.getUint8(off+2), dv.getUint8(off+3));
    const sz = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      ch = dv.getUint16(off + 10, true);
      sr = dv.getUint32(off + 12, true);
      bps = dv.getUint16(off + 22, true);
    } else if (id === 'data') {
      dataLen = sz;
    }
    off += 8 + sz;
  }
  const dur = sr && bps && dataLen ? (dataLen / (sr * ch * (bps / 8))) : 0;
  const fadeIn = 0.02;
  const fadeOut = 0.25;
  const st = dur > (fadeOut + 0.01) ? Math.max(0, dur - fadeOut) : 0;
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters([`afade=t=in:d=${fadeIn}`, st > 0 ? `afade=t=out:st=${st}:d=${fadeOut}` : null].filter(Boolean))
      .outputOptions(['-c:a libopus', '-b:a 64k', '-ar 48000', '-ac 1'])
      .format('webm')
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
  const out = await fs.readFile(outputPath);
  try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  console.log(`Transcode wav->webm done: webm_bytes=${out.length}`);
  return out;
}

// Force WebM route only; mp3 fallback removed

function splitTextIntoSentences(text, maxLength = 60) {
  const cleanedText = String(text).replace(/\s+/g, ' ').replace(/\n/g, '');
  if (isMostlyEnglish(cleanedText)) {
    return splitEnglishText(cleanedText, maxLength);
  }
  const tagged = nodejieba.tag(cleanedText);
  const sentences = [];
  let curr = '';
  const END_HARD = new Set(['。', '．', '.', '……', '…']);
  const END_SOFT = new Set(['！', '!', '？', '?']);
  const MIN_SENT_LEN = 15;
  for (const t of tagged) {
    const w = t.word;
    if (typeof w === 'string' && END_HARD.has(w)) {
      const full = curr + w;
      if (full.length > maxLength) {
        sentences.push(...splitLongSentence(full, maxLength));
      } else {
        sentences.push(full);
      }
      curr = '';
    } else if (typeof w === 'string' && END_SOFT.has(w)) {
      if ((curr.length + w.length) < MIN_SENT_LEN) {
        curr += w;
      } else {
        const full = curr + w;
        if (full.length > maxLength) {
          sentences.push(...splitLongSentence(full, maxLength));
        } else {
          sentences.push(full);
        }
        curr = '';
      }
    } else {
      curr += w;
    }
  }
  if (curr.trim()) sentences.push(curr.trim());
  return sentences;
}

function isMostlyEnglish(str) {
  const letters = (str.match(/[A-Za-z]/g) || []).length;
  const chinese = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  return letters > chinese;
}

function splitEnglishText(text, maxLength) {
  let sentences = [];
  try {
    const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
    for (const s of seg.segment(text)) {
      const segText = s.segment.trim();
      if (!segText) continue;
      const minLen = Math.max(maxLength, 80);
      if (segText.length > minLen) {
        sentences.push(...splitLongSentenceEnglish(segText, minLen));
      } else {
        sentences.push(segText);
      }
    }
  } catch {
    const minLen = Math.max(maxLength, 80);
    sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z"'\(])/)
      .map(s => s.trim())
      .filter(Boolean);
    sentences = sentences.flatMap(s => (s.length > minLen ? splitLongSentenceEnglish(s, minLen) : [s]));
  }
  if (!sentences.length) sentences = [text];
  return sentences;
}

function splitLongSentence(longSentence, maxLength) {
  const parts = [];
  let startIndex = 0;
  while (startIndex < longSentence.length) {
    let endIndex = startIndex + maxLength;
    if (endIndex >= longSentence.length) {
      parts.push(longSentence.substring(startIndex));
      break;
    }
    const splitChars = [',', '，', '、', ';', '；', ':', '：', '！', '!', '？', '?'];
    let splitIndex = -1;
    for (let i = endIndex; i > startIndex; i--) {
      if (splitChars.includes(longSentence[i])) {
        splitIndex = i;
        break;
      }
    }
    if (splitIndex !== -1) {
      parts.push(longSentence.substring(startIndex, splitIndex + 1));
      startIndex = splitIndex + 1;
    } else {
      parts.push(longSentence.substring(startIndex, endIndex));
      startIndex = endIndex;
    }
  }
  return parts.map(s => s.trim()).filter(Boolean);
}

function splitLongSentenceEnglish(longSentence, maxLength) {
  const parts = [];
  let startIndex = 0;
  while (startIndex < longSentence.length) {
    let endIndex = startIndex + maxLength;
    if (endIndex >= longSentence.length) {
      parts.push(longSentence.substring(startIndex));
      break;
    }
    const splitChars = [',', ';', ':', '—', '-', ')'];
    let splitIndex = -1;
    for (let i = endIndex; i > startIndex; i--) {
      if (splitChars.includes(longSentence[i])) {
        splitIndex = i;
        break;
      }
    }
    if (splitIndex !== -1) {
      parts.push(longSentence.substring(startIndex, splitIndex + 1));
      startIndex = splitIndex + 1;
    } else {
      parts.push(longSentence.substring(startIndex, endIndex));
      startIndex = endIndex;
    }
  }
  return parts.map(s => s.trim()).filter(Boolean);
}
