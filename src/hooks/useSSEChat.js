import { useRef, useCallback, useState } from 'react';

export default function useSSEChat({ setMessages }) {
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef(null);
  const httpAbortControllerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const disconnectSSE = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (httpAbortControllerRef.current) {
      httpAbortControllerRef.current.abort();
      httpAbortControllerRef.current = null;
    }
  }, []);

  const handleSSEMessage = useCallback((data) => {
    switch (data.type) {
      case 'stream_start': {
        const streamingId = data.messageId || Date.now();
        const msg = { id: streamingId, type: 'bot', content: '', data: null, timestamp: new Date(), isStreaming: true };
        setStreamingMessage(msg);
        setIsTyping(true);
        break;
      }
      case 'stream_complete': {
        if (streamingMessage) {
          const responseContent = data.response || data.summary || data.content || '抱歉，我无法处理您的请求。';
          const responseData = data.data || streamingMessage.data || null;
          const finalResponse = { id: streamingMessage.id, type: 'bot', content: responseContent, data: responseData, timestamp: new Date(), isStreaming: false, responseType: data.response_type || 'stream' };
          setMessages(prev => [...prev, finalResponse]);
          setStreamingMessage(null);
        }
        setIsTyping(false);
        break;
      }
      case 'chat_complete': {
        const responseContent = data.response?.output || data.response?.summary || data.response?.content || data.response?.message || data.output || data.summary || data.content || '抱歉，我无法处理您的请求。';
        const responseData = data.response?.data || (data.response?.accounts || data.response?.channels ? { accounts: data.response?.accounts, channels: data.response?.channels } : null) || (data.accounts || data.channels ? { accounts: data.accounts, channels: data.channels } : null);
        const finalResponse = { id: streamingMessage?.id || Date.now(), type: 'bot', content: responseContent, data: responseData, timestamp: new Date(), isStreaming: false, responseType: 'chat_complete', metadata: data.response?.metadata || data.metadata || null };
        setMessages(prev => [...prev, finalResponse]);
        setStreamingMessage(null);
        setIsTyping(false);
        break;
      }
      case 'stream_error': {
        if (streamingMessage) {
          const errorResponse = { id: streamingMessage.id, type: 'bot', content: data.error || '抱歉，处理您的请求时出现错误。', timestamp: new Date(), isStreaming: false };
          setMessages(prev => [...prev, errorResponse]);
          setStreamingMessage(null);
        }
        setIsTyping(false);
        break;
      }
      case 'transcription_chunk': {
        if (streamingMessage && typeof data.content === 'string') {
          setStreamingMessage(prev => prev ? { ...prev, content: (prev.content || '') + data.content } : prev);
        }
        break;
      }
      default:
        break;
    }
  }, [setMessages, streamingMessage]);

  const connectSSE = useCallback(async (messageData, isAuthenticated) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !isAuthenticated) return;
      abortControllerRef.current = new AbortController();
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          message: messageData.message,
          sessionId: messageData.sessionId,
          userId: messageData.userId || null
        }),
        signal: abortControllerRef.current.signal
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
          buffer = events.pop() || '';
          for (const evt of events) {
            const line = evt.split('\n').find(l => l.startsWith('data: '));
            if (!line) continue;
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEMessage(data);
            } catch {}
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        const retryCount = 0;
        const maxRetries = 3;
        if (retryCount < maxRetries) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE(messageData, isAuthenticated);
          }, 1000);
        }
      }
    }
  }, [handleSSEMessage]);

  const handleStopRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingMessage) {
      disconnectSSE();
    }
    setIsTyping(false);
    setStreamingMessage(null);
  }, [streamingMessage, disconnectSSE]);

  return {
    streamingMessage,
    isTyping,
    connectSSE,
    disconnectSSE,
    handleStopRequest,
  };
}
