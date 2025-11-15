import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import NavBar from './components/NavBar.jsx';
import useAudioRecorder from './hooks/useAudioRecorder.js';
import useResponsive from './hooks/useResponsive.js';
import useSessionId from './hooks/useSessionId.js';
import usePagination from './hooks/usePagination.js';
import useMountVisibility from './hooks/useMountVisibility.js';
import useSSEChat from './hooks/useSSEChat.js';

const ChatPage = () => {
  const { user, isAuthenticated } = useAuth();
  

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: '你好！我是你的AI智能伴侣。我在这里与你聊天，提供情感支持，分享知识，成为你日常生活中友好的伙伴。你今天感觉怎么样？',
      timestamp: new Date(Date.now() - 60000)
    }

  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const isVisible = useMountVisibility(100);
  const [isFocused, setIsFocused] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const isMobile = useResponsive();
  const sessionId = useSessionId(user?.id);
  const currentTranscriptionMessageIdRef = useRef(null);
  const currentBotMessageIdRef = useRef(null);
  const pendingBotTextRef = useRef('');
  const typewriterIntervalRef = useRef(null);
  const typewriterProgressRef = useRef(0);
  const ttsStartedRef = useRef(false);
  const getHistory = useCallback(() => {
    return messages
      .filter(m => m.type === 'user' || m.type === 'bot')
      .map(m => ({ role: m.type === 'bot' ? 'assistant' : 'user', content: m.content }))
      .slice(-20);
  }, [messages]);

  const onBeforeUpload = useCallback(() => {
    const newMessageId = Date.now();
    currentTranscriptionMessageIdRef.current = newMessageId;
    setMessages(prev => [...prev, {
      id: newMessageId,
      type: 'user',
      content: '',
      timestamp: new Date()
    }]);
    return newMessageId;
  }, []);

  const onStreamEvent = useCallback((data, messageId) => {
    if (!data || !messageId) return;
    if (data.type === 'transcription_chunk' && typeof data.content === 'string') {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: (m.content || '') + data.content } : m));
    } else if (data.type === 'transcription_complete' && typeof data.content === 'string') {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: data.content } : m));
    } else if (data.type === 'error') {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: data.error || '转录失败' } : m));
    } else if (data.type === 'chat_complete') {
      const content = data.response?.content || data.content || '';
      pendingBotTextRef.current = content || '';
    } else if (data.type === 'tts_start') {
      const ttsMsgId = Date.now() + 1;
      currentTranscriptionMessageIdRef.current = ttsMsgId;
      currentBotMessageIdRef.current = ttsMsgId;
      ttsStartedRef.current = false;
      typewriterProgressRef.current = 0;
      const botMsg = { id: ttsMsgId, type: 'bot', content: '', timestamp: new Date(), isStreaming: true, responseType: 'tts', data: { tts: { url: null } } };
      setMessages(prev => [...prev, botMsg]);
    } else if (data.type === 'tts_complete') {
      const id = currentTranscriptionMessageIdRef.current;
      if (id) {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, isStreaming: false } : m));
      }
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      const fullText = pendingBotTextRef.current || '';
      const progress = typewriterProgressRef.current || 0;
      if (fullText && progress < fullText.length) {
        const id2 = currentTranscriptionMessageIdRef.current;
        setMessages(prev => prev.map(m => m.id === id2 ? { ...m, content: fullText } : m));
      }
    } else if (data.type === 'tts_chunk') {
      const id = currentTranscriptionMessageIdRef.current;
      const format = data.audio?.format || 'wav';
      const base64 = data.audio?.data;
      if (id && base64) {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        setMessages(prev => prev.map(m => {
          if (m.id !== id) return m;
          const existing = m.data?.tts?.buffer || new Uint8Array(0);
          const merged = new Uint8Array(existing.length + bytes.length);
          merged.set(existing);
          merged.set(bytes, existing.length);
          const url = merged.length >= 256 * 1024 ? URL.createObjectURL(new Blob([merged], { type: `audio/${format}` })) : m.data?.tts?.url || null;
          return { ...m, data: { ...(m.data || {}), tts: { buffer: merged, url } } };
        }));
        if (!ttsStartedRef.current) {
          ttsStartedRef.current = true;
          const fullText = pendingBotTextRef.current || '';
          const id2 = currentTranscriptionMessageIdRef.current;
          if (fullText && id2) {
            if (typewriterIntervalRef.current) {
              clearInterval(typewriterIntervalRef.current);
            }
            typewriterProgressRef.current = 0;
            typewriterIntervalRef.current = setInterval(() => {
              const text = pendingBotTextRef.current || '';
              if (!text) {
                clearInterval(typewriterIntervalRef.current);
                typewriterIntervalRef.current = null;
                return;
              }
              const step = Math.max(1, Math.ceil(text.length / 120));
              typewriterProgressRef.current = Math.min(text.length, typewriterProgressRef.current + step);
              const slice = text.slice(0, typewriterProgressRef.current);
              setMessages(prev => prev.map(m => m.id === id2 ? { ...m, content: slice } : m));
              if (typewriterProgressRef.current >= text.length) {
                clearInterval(typewriterIntervalRef.current);
                typewriterIntervalRef.current = null;
              }
            }, 30);
          }
        }
      }
    } else if (data.type === 'tts_error') {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      const content = pendingBotTextRef.current || (data.error || '语音生成失败');
      const id = currentBotMessageIdRef.current;
      if (id) {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, isStreaming: false, content } : m));
      } else {
        const botMsg = { id: Date.now() + 3, type: 'bot', content, timestamp: new Date(), isStreaming: false, responseType: 'tts_error', isError: data.error ? true : false };
        setMessages(prev => [...prev, botMsg]);
      }
    }
  }, []);

  const { isRecording, setIsRecording, isActiveRecording, setIsActiveRecording, audioLevel, waveformData, startAudioRecording, stopAudioRecording } = useAudioRecorder({ onBeforeUpload, getHistory, onStreamEvent, url: 'http://localhost:3001/api/audio/transcribe-stream' });
  
  const { currentPage, itemsPerPage, resetPagination, getPaginatedData, getTotalPages, getCurrentPageForData, setCurrentPageForData } = usePagination(10);
  // SSE streaming states
  const streamingEnabled = true; // 固定启用流式响应
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const httpAbortControllerRef = useRef(null);

  

  // Handle space key for recording
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if the active element is the textarea - if so, don't trigger recording
      const activeElement = document.activeElement;
      const isTextareaFocused = activeElement && activeElement.tagName === 'TEXTAREA';
      
      if (e.code === 'Space' && !isRecording && !isTyping && !isTextareaFocused) {
        e.preventDefault();
        setIsRecording(true);
        setIsInputExpanded(false);
        setIsFocused(false);
      } else if (e.code === 'Space' && isRecording && !isActiveRecording) {
        e.preventDefault();
        setIsActiveRecording(true);
        startAudioRecording();
        console.log('Space key: Recording started');
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isActiveRecording) {
        e.preventDefault();
        console.log('Space key: Recording stopped - sending message');
        stopAudioRecording();
        setIsActiveRecording(false);
        // Stay in recording mode, only stop active recording
        // setIsRecording(false); // Removed: stay in recording mode
        // Here you would typically process and send the audio
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isActiveRecording, isTyping]);


  

  

  

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const { connectSSE, disconnectSSE, handleStopRequest } = useSSEChat({ setMessages });
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up ongoing HTTP fallback request
      if (httpAbortControllerRef.current) {
        httpAbortControllerRef.current.abort();
        httpAbortControllerRef.current = null;
      }
      
      // Clean up SSE connection
      disconnectSSE();
      
      // Clean up audio recording
      stopAudioRecording();
      
      // Clean up streaming state
      setIsTyping(false);
      setStreamingMessage(null);
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      
    };
  }, [disconnectSSE]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  

  // Handle streaming step updates
  

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !sessionId) return;

    const userMessageContent = inputMessage;
    const newMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsFocused(false); // Reset focus state after sending
    setIsInputExpanded(false); // Reset expanded state after sending
    setIsTyping(true);
    
    resetPagination(); // Reset pagination when new message is sent
    
    // Initialize streaming message
    const streamingId = Date.now() + 1;
    setStreamingMessage({
      id: streamingId,
      type: 'bot',
      content: '',
      data: null,
      timestamp: new Date(),
      isStreaming: true
    });


    // Fallback to traditional HTTP request
    // Create new AbortController for HTTP request
    httpAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessageContent,
          sessionId: sessionId,
          userId: user?.id || null,
          streaming: false
        }),
        signal: httpAbortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Basic streaming output only: skip step orchestration
      
      // Final response
      const finalResponse = {
        id: streamingId,
        type: 'bot',
        content: data.output || data.response || data.summary || '抱歉，我无法处理您的请求。',
        data: data.data || null,
        timestamp: new Date(),
        isStreaming: false,
        responseType: data.optimization_stats?.route_type || data.response_type || 'http_fallback',
        optimizationStats: data.optimization_stats || null,
        metadata: data.metadata || null
      };
      
      setMessages(prev => [...prev, finalResponse]);
      setStreamingMessage(null);
    } catch (error) {
      // Check if the request was actively interrupted
      if (error.name === 'AbortError') {
        console.log('Request interrupted by user');
        const abortResponse = {
          id: streamingId,
          type: 'bot',
          content: '请求已被中断',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, abortResponse]);
        setStreamingMessage(null);
        return;
      }
      
      console.error('Error calling AI API:', error);
      
      // Enhanced error handling with retry suggestion
      let errorMessage = '抱歉，我现在无法连接到AI服务。';
      
      if (error.code === 'NETWORK_ERROR' || error.message.includes('network')) {
        errorMessage += ' 这似乎是网络连接问题。请检查您的连接并重试。';
      } else if (error.response?.status >= 500) {
        errorMessage += ' 服务器遇到问题。请稍后再试。';
      } else if (error.response?.status === 429) {
        errorMessage += ' 请求过多。请稍等片刻再重试。';
      } else {
        errorMessage += ' 请稍后再试。';
      }
      
      const errorResponse = {
        id: streamingId,
        type: 'bot',
        content: errorMessage,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorResponse]);
      setStreamingMessage(null);
    } finally {
      setIsTyping(false);
      httpAbortControllerRef.current = null;
    }
  };



  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };



  const quickActions = [];

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Fixed Background decoration */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-orange-100 to-orange-50"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-emerald-300/70 to-emerald-50/50 opacity-60"></div>
      </div>

      <NavBar isMobile={isMobile} isNavExpanded={isNavExpanded} setIsNavExpanded={setIsNavExpanded} user={user} />

      <div 
        className={`min-h-screen flex items-center justify-center px-4 py-8 relative z-10 transition-opacity duration-100 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => !isMobile && isNavExpanded && setIsNavExpanded(false)}
      >
        <div className={`h-full flex flex-col transition-all duration-[400ms] max-md:w-full max-md:p-0 max-md:ml-0 ${
          isMobile 
            ? 'w-full p-4 ml-0' 
            : 'w-11/12 ml-20 mr-6 p-6'
        }`}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex items-center justify-center flex-1">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                  <i className="fas fa-robot text-white text-xl"></i>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">AI智能伴侣聊天</h1>
              </div>
              

            </div>
            <p className="text-gray-600">你的智能AI伴侣，提供有意义的对话和情感支持</p>
          </div>

          {/* Chat Container */}
          <div className="h-full flex flex-col">

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto py-2 space-y-4 pb-24">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-500/60'
                      : 'bg-gradient-to-br from-slate-500 to-slate-500'
                  }`}>
                    {message.type === 'user' ? (
                      <i className="fas fa-user text-white text-sm"></i>
                    ) : (
                      <i className="fa-brands fa-connectdevelop text-white text-lg" style={{WebkitTextStroke: '1px currentColor'}}></i>
                    )}
                  </div>
                  <div className={`max-w-[90%] sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl ${
                    message.type === 'user' ? 'text-left' : 'text-left'
                  }`}>
                    <div className={`inline-block p-4 rounded-2xl shadow-sm max-w-full ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-sky-50 to-sky-50 text-black'
                        : 'bg-white/80 text-gray-800 border border-gray-200/50'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      

                      
                      {message.data && (
                        <div className="space-y-2 text-xs text-emerald-700">
                            {message.data.sentiment && (
                              <div>
                                <span className="font-medium">Sentiment:</span>
                                <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                                  message.data.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                  message.data.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {message.data.sentiment === 'positive' ? 'Positive' :
                                   message.data.sentiment === 'negative' ? 'Negative' : 'Neutral'}
                                </span>
                              </div>
                            )}
                            {message.data.keywords && message.data.keywords.length > 0 && (
                              <div>
                                <span className="font-medium">Keywords:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {message.data.keywords.map((keyword, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {message.data.summary && (
                              <div>
                                <span className="font-medium">Summary:</span>
                                <p className="mt-1 text-emerald-600">{message.data.summary}</p>
                              </div>
                            )}
                            {message.data.topics && message.data.topics.length > 0 && (
                              <div>
                                <span className="font-medium">Topics:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {message.data.topics.map((topic, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Display user data if available */}
                            {(message.data.user_data || message.data.accounts) && (message.data.user_data?.length > 0 || message.data.accounts?.length > 0) && (
                              <div className="overflow-x-auto max-w-full">
                                {renderDataTable(message.data.user_data || message.data.accounts, 'accounts', message.id)}
                              </div>
                            )}
                            
                            {/* Display conversation history data if available */}
                            {message.data.conversations && message.data.conversations.length > 0 && (
                              <div className="overflow-x-auto max-w-full">
                                {renderDataTable(message.data.conversations, 'conversations', message.id)}
                              </div>
                            )}
                            {message.data.tts?.url && (
                              <audio autoPlay playsInline preload="auto" src={message.data.tts.url} style={{ display: 'none' }} />
                            )}
                        </div>
                      )}
                    </div>
                    <p className={`text-xs text-gray-500 mt-1 ${
                      message.type === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {formatTimestamp(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Display streaming message */}
              {streamingMessage && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fa-brands fa-connectdevelop text-white text-lg" style={{WebkitTextStroke: '1px currentColor'}}></i>
                  </div>
                  <div className="max-w-[90%] sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl text-left">
                    <div className="inline-block p-4 rounded-2xl shadow-sm bg-white/80 text-gray-800 border border-gray-200/50 max-w-full">
                      {/* Simple loading indicator with three dots */}
                      <div className="flex items-center mb-2">
                        <div className="flex space-x-1 mr-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm font-medium text-emerald-600">AI 正在处理中...</span>
                      </div>
                      
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {streamingMessage.content || '正在分析中...'}
                      </p>
                      
                      {/* Display streaming data if available */}
                      {streamingMessage.data && (
                        <div>
                          
                          {/* Display user data if available */}
                          {(streamingMessage.data.user_data || streamingMessage.data.accounts) && (streamingMessage.data.user_data?.length > 0 || streamingMessage.data.accounts?.length > 0) && (
                            <div className="overflow-x-auto max-w-full">
                              {renderDataTable(streamingMessage.data.user_data || streamingMessage.data.accounts, 'accounts', streamingMessage.id)}
                            </div>
                          )}
                          
                          {/* Display conversation history data if available */}
                          {streamingMessage.data.conversations && streamingMessage.data.conversations.length > 0 && (
                            <div className="overflow-x-auto max-w-full">
                              {renderDataTable(streamingMessage.data.conversations, 'conversations', streamingMessage.id)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-left">
                      {formatTimestamp(streamingMessage.timestamp)}
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Floating at bottom */}
            <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 md:pb-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] mx-auto transition-all duration-[400ms] ease-out max-w-[calc(100vw-1rem)] ${
              isFocused || inputMessage.trim() ? 'w-[800px]' : 'w-[560px]'
            }`}>
              {/* Quick Suggestions */}
              <div className="mb-3 flex flex-wrap gap-2 justify-center">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className="px-3 py-1 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-700 rounded-full text-sm transition-colors backdrop-blur-sm"
                  >
                    {action.text}
                  </button>
                ))}
              </div>

              {/* Recording Active Prompt */}
              {isActiveRecording && (
                <div className="mb-3 flex justify-center">
                  <div className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm rounded-full text-gray-700 text-sm font-medium">
                    上滑取消输入，松手发送
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSendMessage}>
                <div className="relative">
                  {isRecording ? (
                    <div 
                      className={`w-full rounded-3xl text-gray-900 outline-none transition-all duration-300 shadow-lg backdrop-blur-lg flex items-center justify-center py-3 h-[48px] cursor-pointer select-none border ${
                        isActiveRecording 
                          ? 'bg-white border-emerald-400 border-2 shadow-emerald-200/50 shadow-lg' 
                          : 'bg-white/90 hover:bg-white/95 border-emerald-200/60'
                      }`}
                      style={{transform: 'translateY(-6px)'}}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsActiveRecording(true);
                        startAudioRecording();
                        console.log('Recording started by long press');
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault();
                        if (isActiveRecording) {
                          console.log('Recording stopped - sending message');
                          stopAudioRecording();
                          setIsActiveRecording(false);
                          // Stay in recording mode, only stop active recording
                          // setIsRecording(false); // Removed: stay in recording mode
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isActiveRecording) {
                          console.log('Recording stopped - mouse left area');
                          stopAudioRecording();
                          setIsActiveRecording(false);
                          // Stay in recording mode, only stop active recording
                          // setIsRecording(false); // Removed: stay in recording mode
                        }
                      }}
                    >
                      <div className="flex items-center justify-center w-full space-x-3">
                        {isActiveRecording ? (
                          <div className="flex items-center space-x-1">
                            {waveformData.map((height, index) => {
                              // Gradient colors matching screenshots: light blue → deep blue → violet → magenta → light pink
                              const colors = [
                                'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600',
                                'bg-indigo-500', 'bg-purple-500', 'bg-purple-600', 'bg-pink-500', 
                                'bg-pink-400', 'bg-pink-300', 'bg-pink-200', 'bg-pink-100', 'bg-pink-50', 'bg-pink-50'
                              ];
                              const baseHeight = 4; // Minimum height for baseline
                              const maxHeight = 20; // Maximum height for peaks
                              const dynamicHeight = baseHeight + (height * maxHeight); // Scale based on audio level
                              
                              return (
                                <div 
                                  key={index}
                                  className={`w-2 ${colors[index]} rounded-full transition-all duration-75`}
                                  style={{height: `${dynamicHeight}px`}}
                                ></div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="font-medium text-base text-gray-700">
                            按住此处或空格说话
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <textarea
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                          e.preventDefault();
                          if (inputMessage.trim()) {
                            handleSendMessage(e);
                          }
                        }
                      }}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                      onFocus={() => {
                        setIsFocused(true);
                        setIsInputExpanded(true);
                      }}
                      onBlur={(e) => {
                        // Use setTimeout to delay the blur handling, allowing click events to process first
                        setTimeout(() => {
                          // Only shrink when input is empty and not in recording mode
                          if (!inputMessage.trim() && !isRecording) {
                            setIsFocused(false);
                            setIsInputExpanded(false);
                          } else if (!isRecording) {
                            setIsFocused(false);
                          }
                        }, 150);
                      }}
                      placeholder="发送消息..."
                      className={`w-full px-4 pr-12 bg-white/90 rounded-3xl border border-emerald-200/60 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all duration-300 shadow-lg backdrop-blur-lg resize-none chat-input-scrollbar ${
                        isInputExpanded ? 'py-6 min-h-[120px] max-h-[200px]' : 'py-3 h-[48px] min-h-[48px]'
                      }`}
                      style={{
                        // Ensure content doesn't overflow beyond rounded borders
                        scrollbarGutter: 'stable',
                        overflowY: isInputExpanded ? 'auto' : 'hidden'
                      }}
                      disabled={isTyping}
                      rows={isInputExpanded ? 4 : 1}
                    />
                  )}
                  <div className={`absolute right-1 flex items-center space-x-2 ${
                    isRecording ? 'top-1/2 transform -translate-y-1/2' : 'bottom-2.5'
                  }`} style={isRecording ? {transform: 'translateY(calc(-50% - 6px))'} : {}}>
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecording(false);
                          // 可选：切换回文本模式时保持合理的输入框状态
                          if (!inputMessage.trim()) {
                            setIsInputExpanded(false);
                          }
                        }}
                        className={`w-10 h-10 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 flex items-center justify-center ${
                          isActiveRecording ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}
                      >
                        <i className="fas fa-keyboard text-sm"></i>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Force immediate state change
                            setIsRecording(true);
                            setIsInputExpanded(false);
                            setIsFocused(false);
                            // Clear any pending blur timeouts
                            const activeElement = document.activeElement;
                            if (activeElement && activeElement.tagName === 'TEXTAREA') {
                              activeElement.blur();
                            }
                          }}
                          className="w-10 h-10 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 flex items-center justify-center"
                        >
                          <i className="fas fa-microphone text-sm"></i>
                        </button>
                        <div className="w-px h-6 bg-gray-300"></div>
                        <button
                          type={isTyping ? "button" : "submit"}
                          disabled={!isTyping && !inputMessage.trim()}
                          onClick={isTyping ? handleStopRequest : undefined}
                          className={`w-10 h-10 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                            isTyping 
                              ? 'bg-red-500 hover:bg-red-600' 
                              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                          }`}
                        >
                        {isTyping ? (
                          <>
                            <div className="absolute inset-0 border-2 border-red-200 rounded-full animate-spin border-t-white"></div>
                            <i className="fas fa-stop text-white text-xs relative z-10"></i>
                          </>
                        ) : (
                          <i className="fas fa-paper-plane text-sm"></i>
                        )}
                      </button>
                      </>
                    )}
                </div>
              </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
