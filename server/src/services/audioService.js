import { config } from '../config/config.js';

export class AudioService {
  constructor() {
    this.chunkDuration = config.audio.chunkDuration;
  }

  /**
   * 将音频分割成指定时长（秒）的片段
   * 模拟 Python 的 split_audio 函数功能
   */
  async splitAudio(audioBuffer, chunkDuration = this.chunkDuration) {
    console.log(`正在分割音频，片段时长: ${chunkDuration}秒`);
    
    // 首先解析WAV文件头获取准确信息
    const wavInfo = this.parseWAVHeader(audioBuffer);
    if (!wavInfo) {
      throw new Error('无法解析音频文件头信息');
    }
    
    const { dataOffset, dataSize, bytesPerSecond } = wavInfo;
    const audioDataSize = dataSize;
    const totalDuration = audioDataSize / bytesPerSecond;
    
    console.log(`📊 音频信息: ${totalDuration.toFixed(1)}秒, ${bytesPerSecond}字节/秒`);
    console.log(`📊 音频数据大小: ${audioDataSize}字节`);
    
    const chunks = [];
    const chunkSizeInBytes = chunkDuration * bytesPerSecond;
    
    // 只分割音频数据部分，保留WAV头
    for (let offset = dataOffset; offset < dataOffset + audioDataSize; offset += chunkSizeInBytes) {
      const endOffset = Math.min(offset + chunkSizeInBytes, dataOffset + audioDataSize);
      const chunkDataSize = endOffset - offset;
      
      // 创建新的WAV文件缓冲区
      const chunkBuffer = Buffer.alloc(44 + chunkDataSize); // WAV头44字节 + 数据
      
      // 复制WAV头
      audioBuffer.copy(chunkBuffer, 0, 0, 44);
      
      // 修改data chunk大小
      chunkBuffer.writeUInt32LE(chunkDataSize, 40); // data chunk大小字段
      
      // 复制音频数据
      audioBuffer.copy(chunkBuffer, 44, offset, endOffset);
      
      chunks.push(chunkBuffer);
    }
    
    console.log(`✅ 音频分割完成，共得到 ${chunks.length} 个片段。`);
    return chunks;
  }

  /**
   * 解析WAV文件头信息
   */
  parseWAVHeader(audioBuffer) {
    if (audioBuffer.length < 44) {
      throw new Error('文件太小，不是有效的WAV文件');
    }

    // 检查RIFF标识
    const riff = audioBuffer.toString('ascii', 0, 4);
    if (riff !== 'RIFF') {
      throw new Error('不是RIFF格式的文件');
    }

    // 检查WAVE标识
    const wave = audioBuffer.toString('ascii', 8, 12);
    if (wave !== 'WAVE') {
      throw new Error('不是WAVE格式的文件');
    }

    // 查找fmt chunk
    let fmtOffset = 12;
    let dataOffset = 0;
    let dataSize = 0;
    
    while (fmtOffset < audioBuffer.length - 8) {
      const chunkType = audioBuffer.toString('ascii', fmtOffset, fmtOffset + 4);
      const chunkSize = audioBuffer.readUInt32LE(fmtOffset + 4);
      
      if (chunkType === 'fmt ') {
        // 解析音频格式
        const audioFormat = audioBuffer.readUInt16LE(fmtOffset + 8);
        const numChannels = audioBuffer.readUInt16LE(fmtOffset + 10);
        const sampleRate = audioBuffer.readUInt32LE(fmtOffset + 12);
        const byteRate = audioBuffer.readUInt32LE(fmtOffset + 16);
        const blockAlign = audioBuffer.readUInt16LE(fmtOffset + 20);
        const bitsPerSample = audioBuffer.readUInt16LE(fmtOffset + 22);
        
        console.log(`🎵 音频格式: ${sampleRate}Hz, ${bitsPerSample}bit, ${numChannels}声道`);
        console.log(`🎵 字节率: ${byteRate}字节/秒`);
        
        // 继续查找data chunk
        let searchOffset = fmtOffset + 8 + chunkSize;
        while (searchOffset < audioBuffer.length - 8) {
          const searchChunkType = audioBuffer.toString('ascii', searchOffset, searchOffset + 4);
          const searchChunkSize = audioBuffer.readUInt32LE(searchOffset + 4);
          
          if (searchChunkType === 'data') {
            dataOffset = searchOffset + 8;
            dataSize = searchChunkSize;
            break;
          }
          
          searchOffset += 8 + searchChunkSize;
        }
        
        if (dataSize === 0) {
          throw new Error('找不到data chunk');
        }
        
        return {
          audioFormat,
          numChannels,
          sampleRate,
          byteRate,
          blockAlign,
          bitsPerSample,
          dataOffset,
          dataSize,
          bytesPerSecond: byteRate
        };
      }
      
      fmtOffset += 8 + chunkSize;
    }
    
    throw new Error('找不到fmt chunk');
  }

}

export default AudioService;
