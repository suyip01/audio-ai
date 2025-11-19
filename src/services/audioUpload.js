export async function uploadAudioSSE({ wavBlob, history, url = 'http://localhost:3001/api/audio/transcribe-stream', onEvent, signal, systemPrompt }) {
  const formData = new FormData();
  formData.append('audio', wavBlob, 'recording.wav');
  if (history) formData.append('history', JSON.stringify(history));
  if (systemPrompt) formData.append('systemPrompt', systemPrompt);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    },
    body: formData,
    signal
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const events = buffer.split('\n\n');
      // 保留最后可能不完整的事件
      buffer = events.pop() || '';
      for (const evt of events) {
        const line = evt.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (onEvent) onEvent(data);
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default uploadAudioSSE;
