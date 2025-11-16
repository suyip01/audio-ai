export async function uploadAudioSSE({ wavBlob, history, url = 'http://localhost:3001/api/audio/transcribe-stream', onEvent, signal }) {
  const formData = new FormData();
  formData.append('audio', wavBlob, 'recording.wav');
  if (history) formData.append('history', JSON.stringify(history));
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
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (onEvent) onEvent(data);
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default uploadAudioSSE;
