import { useState, useRef } from 'react';
import uploadAudioSSE from '../services/audioUpload.js';

export default function useAudioRecorder({ onBeforeUpload, getHistory, onStreamEvent, url } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isActiveRecording, setIsActiveRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformData, setWaveformData] = useState(new Array(15).fill(0.15));
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const recordedSamplesRef = useRef([]);
  const recordedLengthRef = useRef(0);
  const sampleRateRef = useRef(44100);
  const uploadAbortControllerRef = useRef(null);

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;
    const normalizedLevel = Math.min(average / 255, 1);
    setAudioLevel(normalizedLevel);
    const newWaveformData = [];
    for (let i = 0; i < 15; i++) {
      const startIndex = Math.floor((i / 15) * (dataArrayRef.current.length / 2));
      const endIndex = Math.floor(((i + 1) / 15) * (dataArrayRef.current.length / 2));
      let rangeSum = 0;
      let count = 0;
      for (let j = startIndex; j < endIndex && j < dataArrayRef.current.length; j++) {
        rangeSum += dataArrayRef.current[j];
        count++;
      }
      const rangeAverage = count > 0 ? rangeSum / count : 0;
      let amplitude = rangeAverage / 255;
      if (normalizedLevel < 0.05) {
        amplitude = 0.15 + (Math.random() - 0.5) * 0.02;
      } else {
        amplitude = Math.max(0.3, amplitude * (0.6 + Math.random() * 0.8));
        amplitude = amplitude * (0.8 + Math.random() * 0.4);
      }
      newWaveformData.push(Math.min(1, Math.max(0.1, amplitude)));
    }
    setWaveformData(newWaveformData);
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  const mergeRecordedBuffers = (buffers, totalLength) => {
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      result.set(buffers[i], offset);
      offset += buffers[i].length;
    }
    return result;
  };

  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    const floatTo16BitPCM = (output, offset, input) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);
    return new Blob([view], { type: 'audio/wav' });
  };

  const startAudioRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);
    const bufferLength = analyserRef.current.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);
    microphoneRef.current = stream;
    sampleRateRef.current = audioContextRef.current.sampleRate || 44100;
    recordedSamplesRef.current = [];
    recordedLengthRef.current = 0;
    scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const buffer = new Float32Array(input.length);
      buffer.set(input);
      recordedSamplesRef.current.push(buffer);
      recordedLengthRef.current += buffer.length;
    };
    source.connect(scriptProcessorRef.current);
    scriptProcessorRef.current.connect(audioContextRef.current.destination);
    analyzeAudio();
  };

  const stopAudioRecording = async () => {
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach(track => track.stop());
      microphoneRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setWaveformData(new Array(15).fill(0.15));
    setAudioLevel(0);
    if (recordedLengthRef.current > 0) {
      const samples = mergeRecordedBuffers(recordedSamplesRef.current, recordedLengthRef.current);
      const wavBlob = encodeWAV(samples, sampleRateRef.current);
      recordedSamplesRef.current = [];
      recordedLengthRef.current = 0;
      let messageId = null;
      try {
        if (onBeforeUpload) messageId = onBeforeUpload(wavBlob);
        const history = getHistory ? getHistory() : [];
        uploadAbortControllerRef.current = new AbortController();
        await uploadAudioSSE({ wavBlob, history, url, signal: uploadAbortControllerRef.current.signal, onEvent: (data) => {
          if (onStreamEvent) onStreamEvent(data, messageId);
        }});
      } catch (e) {
        if (e && (e.name === 'AbortError' || /aborted/i.test(e.message || ''))) {
          if (onStreamEvent) onStreamEvent({ type: 'upload_aborted' }, messageId);
        } else {
          if (onStreamEvent) onStreamEvent({ type: 'error', error: e.message }, messageId);
        }
      }
      finally {
        uploadAbortControllerRef.current = null;
      }
    }
  };

  const cancelAudioRecording = () => {
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach(track => track.stop());
      microphoneRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setWaveformData(new Array(15).fill(0.15));
    setAudioLevel(0);
    recordedSamplesRef.current = [];
    recordedLengthRef.current = 0;
  };

  const abortUpload = () => {
    if (uploadAbortControllerRef.current) {
      try { uploadAbortControllerRef.current.abort(); } catch {}
      uploadAbortControllerRef.current = null;
    }
  };

  return {
    isRecording,
    setIsRecording,
    isActiveRecording,
    setIsActiveRecording,
    audioLevel,
    waveformData,
    startAudioRecording,
    stopAudioRecording,
    cancelAudioRecording,
    abortUpload,
  };
}
