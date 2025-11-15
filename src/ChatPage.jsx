import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';

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
  const [streamingSteps, setStreamingSteps] = useState([]);
  const [streamingStep, setStreamingStep] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isActiveRecording, setIsActiveRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformData, setWaveformData] = useState(new Array(15).fill(0.15)); // Flat baseline for idle state
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  // Pagination states
  const [currentPage, setCurrentPage] = useState({});
  const [itemsPerPage] = useState(10);
  
  // Reset pagination when new data arrives
  const resetPagination = useCallback(() => {
    setCurrentPage({});
  }, [isAuthenticated]);
  // SSE streaming states
  const streamingEnabled = true; // 固定启用流式响应
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const httpAbortControllerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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

  // Audio processing functions
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create analyser
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // Connect source to analyser
      source.connect(analyserRef.current);
      
      // Create data array
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      // Store microphone stream
      microphoneRef.current = stream;
      
      // Start analyzing audio
      analyzeAudio();
      
      console.log('Audio recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopAudioRecording = () => {
    // Stop all tracks
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach(track => track.stop());
      microphoneRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset waveform data to flat baseline
    setWaveformData(new Array(15).fill(0.15));
    setAudioLevel(0);
    
    console.log('Audio recording stopped');
  };

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Calculate average audio level
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;
    const normalizedLevel = Math.min(average / 255, 1); // Normalize to 0-1
    setAudioLevel(normalizedLevel);
    
    // Generate waveform data for visualization - 15 bars matching screenshots
    const newWaveformData = [];
    for (let i = 0; i < 15; i++) {
      // Sample different frequency ranges for more natural waveform
      const startIndex = Math.floor((i / 15) * (dataArrayRef.current.length / 2));
      const endIndex = Math.floor(((i + 1) / 15) * (dataArrayRef.current.length / 2));
      
      // Calculate average for this frequency range
      let rangeSum = 0;
      let count = 0;
      for (let j = startIndex; j < endIndex && j < dataArrayRef.current.length; j++) {
        rangeSum += dataArrayRef.current[j];
        count++;
      }
      
      const rangeAverage = count > 0 ? rangeSum / count : 0;
      let amplitude = rangeAverage / 255;
      
      // Create baseline when no sound (screenshot 1 - flat state)
      if (normalizedLevel < 0.05) {
        amplitude = 0.15 + (Math.random() - 0.5) * 0.02; // Very small baseline variation for flat look
      } else {
        // Active sound state (screenshot 2 - dynamic waveform)
        amplitude = Math.max(0.3, amplitude * (0.6 + Math.random() * 0.8));
        // Add some natural variation to create peaks and valleys
        amplitude = amplitude * (0.8 + Math.random() * 0.4);
      }
      
      newWaveformData.push(Math.min(1, Math.max(0.1, amplitude)));
    }
    setWaveformData(newWaveformData);
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  // Check screen size for mobile navigation
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Initialize session ID when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      // Use persistent session ID for authenticated users
      const persistentSessionId = `chat-session-${user.id}`;
      setSessionId(persistentSessionId);
    } else {
      // Generate temporary session ID for unauthenticated users
      const tempSessionId = `temp-session-${Date.now()}`;
      setSessionId(tempSessionId);
    }
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // SSE connection management with fetch API
  const connectSSE = useCallback(async (messageData, retryCount = 0) => {
    const maxRetries = 3;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }


    
    try {
      // Get token from localStorage (auth_token is the correct key)
      const token = localStorage.getItem('auth_token');
      if (!token || !isAuthenticated) {
        console.error('User not authenticated, cannot establish SSE connection');
        return;
      }
      
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });
      
      // Use fetch API with POST method for streaming
      const fetchPromise = fetch('/api/ai/chat-stream', {
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
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('SSE connected via fetch');
      
      // Process the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('SSE stream completed');
            break;
          }
          
          // Decode the chunk and process SSE events
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEMessage(data);
              } catch (error) {
                console.error('Error parsing SSE message:', error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('SSE connection aborted');
      } else {
        console.error('Failed to create SSE connection:', error);
        
        // Retry logic for network errors
        if (retryCount < maxRetries && 
            (error.message.includes('timeout') || 
             error.message.includes('network') || 
             error.message.includes('fetch'))) {
          console.log(`Retrying SSE connection (${retryCount + 1}/${maxRetries})...`);
          setTimeout(() => {
            connectSSE(messageData, retryCount + 1);
          }, Math.pow(2, retryCount) * 1000); // Exponential backoff
        }
      }
    }
  }, [isAuthenticated]);
  
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
  
  // Handle SSE messages
  const handleSSEMessage = useCallback((data) => {
    console.log('SSE message received:', data.type, data);
    
    switch (data.type) {
      case 'stream_start':
        // Initialize streaming message
        console.log('stream_start event received:', data);
        
        const streamingId = data.messageId || Date.now();
        const newStreamingMessage = {
          id: streamingId,
          type: 'bot',
          content: '',
          data: null,
          timestamp: new Date(),
          isStreaming: true
        };
        
        console.log('Initializing streaming message:', newStreamingMessage);
        
        setStreamingMessage(newStreamingMessage);
        setStreamingSteps([]);
        setIsTyping(true);
        
        console.log('stream_start processing finished');
        break;
        
      case 'stream_step':
        // Update streaming steps
        setStreamingSteps(prev => [...prev, data.step]);
        
        // Update streaming message content based on step type
        if (data.step.type === 'tool_start') {
          setStreamingMessage(prev => prev ? {
            ...prev,
            content: `🔧 ${data.step.message || '正在查询数据...'}`
          } : null);
        } else if (data.step.type === 'tool_result') {
          setStreamingMessage(prev => prev ? {
            ...prev,
            content: `✅ 数据查询完成`,
            data: data.step.result
          } : null);
        } else if (data.step.type === 'llm_summary_start') {
          setStreamingMessage(prev => prev ? {
            ...prev,
            content: `📝 ${data.step.message || '正在生成总结...'}`
          } : null);
        }
        break;
        
      case 'stream_complete':
        // Finalize streaming message
        console.log('stream_complete event received:', data);
        
        if (streamingMessage) {
          let responseContent = data.response || data.summary || data.content || '抱歉，我无法处理您的请求。';
          let responseData = data.data || streamingMessage.data || null;
          
          // Check for accounts/channels data in different locations
          if (data.accounts || data.channels) {
            responseData = {
              accounts: data.accounts,
              channels: data.channels
            };
          }
          
          console.log('Stream complete - content:', responseContent);
          console.log('Stream complete - data:', responseData);
          
          const finalResponse = {
            id: streamingMessage.id,
            type: 'bot',
            content: responseContent,
            data: responseData,
            timestamp: new Date(),
            isStreaming: false,
            responseType: data.response_type || 'stream'
          };
          
          console.log('Stream complete - final response:', finalResponse);
          
          setMessages(prev => {
            const newMessages = [...prev, finalResponse];
            console.log('Stream complete - messages updated:', newMessages);
            return newMessages;
          });
          setStreamingMessage(null);
          setStreamingSteps([]);
        }
        setIsTyping(false);
        setStreamingStep(null);
        
        console.log('stream_complete processing finished');
        break;
        
      case 'chat_complete':
        // Handle chat_complete event with accounts/channels data
        console.log('chat_complete event received:', data);
        
        let responseData = null;
        let responseContent = '抱歉，我无法处理您的请求。';
        
        // Check multiple possible data structures
        if (data.response) {
          // Try different possible content fields
          responseContent = data.response.output || 
                          data.response.summary || 
                          data.response.content || 
                          data.response.message || 
                          responseContent;
          
          // Check for data in different possible locations
          if (data.response.data) {
            responseData = data.response.data;
          } else if (data.response.accounts || data.response.channels) {
            responseData = {
              accounts: data.response.accounts,
              channels: data.response.channels
            };
          }
        } else if (data.output || data.summary || data.content) {
          responseContent = data.output || data.summary || data.content;
          
          // Check for data at root level
          if (data.accounts || data.channels) {
            responseData = {
              accounts: data.accounts,
              channels: data.channels
            };
          }
        }
        
        console.log('Extracted content:', responseContent);
        console.log('Extracted data:', responseData);
        
        const finalResponse = {
          id: streamingMessage?.id || Date.now(),
          type: 'bot',
          content: responseContent,
          data: responseData,
          timestamp: new Date(),
          isStreaming: false,
          responseType: 'chat_complete',
          metadata: data.response?.metadata || data.metadata || null
        };
        
        console.log('Final response created:', finalResponse);
        
        setMessages(prev => {
          const newMessages = [...prev, finalResponse];
          console.log('Messages updated:', newMessages);
          return newMessages;
        });
        setStreamingMessage(null);
        setStreamingSteps([]);
        setIsTyping(false);
        setStreamingStep(null);
        
        console.log('chat_complete processing finished');
        break;
        
      case 'stream_error':
        // Handle streaming error
        if (streamingMessage) {
          const errorResponse = {
            id: streamingMessage.id,
            type: 'bot',
            content: data.error || '抱歉，处理您的请求时出现错误。',
            timestamp: new Date(),
            isStreaming: false
          };
          
          setMessages(prev => [...prev, errorResponse]);
          setStreamingMessage(null);
          setStreamingSteps([]);
        }
        setIsTyping(false);
        setStreamingStep(null);
        break;
        
      default:
        console.log('Unknown SSE message type:', data.type);
    }
  }, [streamingMessage]);
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clean up SSE connection
      disconnectSSE();
      
      // Clean up audio recording
      stopAudioRecording();
      
      // Clean up streaming state
      setIsTyping(false);
      setStreamingMessage(null);
      setStreamingSteps([]);
      setStreamingStep(null);
    };
  }, [disconnectSSE]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStopRequest = () => {
    console.log('Stop request initiated');
    
    // Stop HTTP request if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Stop SSE streaming if active
    if (streamingMessage) {
      try {
        // Close the SSE connection to stop streaming
        disconnectSSE();
        
        console.log('SSE streaming stopped by user');
      } catch (error) {
        console.error('Error stopping SSE streaming:', error);
      }
    }
    
    // Clean up streaming state
    setIsTyping(false);
    setStreamingMessage(null);
    setStreamingSteps([]);
    setStreamingStep(null);
    console.log('AI request stopped');
  };

  // Handle streaming step updates
  const handleStreamingStep = async (step, messageId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setStreamingSteps(prev => [...prev, step]);
        
        // Update streaming message content based on step type
        if (step.type === 'tool_start') {
          setStreamingMessage(prev => ({
            ...prev,
            content: `🔧 ${step.message || '正在查询数据...'}`
          }));
        } else if (step.type === 'tool_result') {
          setStreamingMessage(prev => ({
            ...prev,
            content: `✅ 数据查询完成`,
            data: step.result
          }));
        } else if (step.type === 'llm_summary_start') {
          setStreamingMessage(prev => ({
            ...prev,
            content: `📝 ${step.message || '正在生成总结...'}`
          }));
        } else if (step.type === 'llm_summary_complete') {
          setStreamingMessage(prev => ({
            ...prev,
            content: step.summary
          }));
        }
        
        resolve();
      }, 300); // Small delay for better UX
    });
  };

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
    setStreamingSteps([]);
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
      // Call AI chat-stream API with streaming support
      const response = await axios.post('/api/ai/chat-stream', {
        message: userMessageContent,
        sessionId: sessionId,
        userId: user?.id || null,
        streaming: false // Disable streaming for HTTP fallback
      }, {
        signal: httpAbortControllerRef.current.signal
      });

      const data = response.data;
      
      // Handle streaming response
      if (data.streaming && data.steps) {
        // Process streaming steps
        for (const step of data.steps) {
          await handleStreamingStep(step, streamingId);
        }
      }
      
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
      setStreamingSteps([]);
      httpAbortControllerRef.current = null;
    }
  };



  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 分页辅助函数
  const getPaginatedData = (data, dataType, page = 1) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const getCurrentPageForData = (dataType, messageId) => {
    const key = messageId ? `${messageId}_${dataType}` : dataType;
    return currentPage[key] || 1;
  };

  const setCurrentPageForData = (dataType, page, messageId) => {
    const key = messageId ? `${messageId}_${dataType}` : dataType;
    setCurrentPage(prev => ({
      ...prev,
      [key]: page
    }));
    
    // 只有在查看最新消息（第1页）时才自动滚动到底部
    // 因为消息是按时间倒序显示的，第1页包含最新消息
    if (page === 1) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
    // 其他页面保持当前浏览位置不变
  };


  const quickActions = [];

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Fixed Background decoration */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-orange-100 to-orange-50"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-emerald-300/70 to-emerald-50/50 opacity-60"></div>
      </div>

      {/* Mobile Navigation Toggle */}
      {isMobile && !isNavExpanded && (
        <div className="fixed top-6 left-6 z-50">
          <button
            onClick={() => setIsNavExpanded(!isNavExpanded)}
            className="w-12 h-12 bg-white/50 backdrop-blur-lg shadow-xl border border-white/30 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/70"
          >
            <i className="fas fa-bars text-emerald-700 text-lg transition-transform duration-300"></i>
          </button>
        </div>
      )}

      {/* Navigation Bar */}
      <div className={`fixed z-50 transition-all duration-[400ms] ${
        isMobile 
          ? `top-6 bottom-6 ${isNavExpanded ? 'left-6' : 'left-0'} ${isNavExpanded ? 'translate-x-0' : '-translate-x-full'}`
          : 'top-6 bottom-6 left-6'
      }`}>
        <div className={`backdrop-blur-lg shadow-xl border border-white/30 p-2 transition-all duration-[400ms] ${
          isMobile 
            ? 'bg-white/70 w-72 h-full rounded-3xl'
            : `bg-white/50 h-full ${isNavExpanded ? 'w-72 rounded-3xl' : 'w-14 rounded-2xl'}`
        }`}>
          <div className="flex flex-col justify-between h-full">
            <div className="flex flex-col space-y-4">
            {/* Mobile Close Button */}
            {isMobile && isNavExpanded && (
              <div className="flex justify-end">
                <button
                  onClick={() => setIsNavExpanded(false)}
                  className="w-10 h-10 rounded-xl hover:bg-white/50 flex items-center justify-center transition-all duration-300"
                >
                  <i className="fas fa-times text-emerald-700 text-lg"></i>
                </button>
              </div>
            )}
            {/* Logo/Home */}
            <button 
              onClick={() => window.location.href = '/'}
              className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 bg-gradient-to-br from-emerald-400/80 to-emerald-500/80 hover:from-emerald-500/90 hover:to-emerald-600/90 rounded-xl flex items-center transition-all duration-[400ms] shadow-lg hover:shadow-xl group relative overflow-hidden`}
              title="Back to Home"
            >
              <div className="flex items-center w-full">
                <div className="w-10 flex justify-center flex-shrink-0">
                  <i className="fas fa-home text-white text-lg group-hover:scale-110 transition-transform"></i>
                </div>
                <span className={`text-white text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>首页</span>
              </div>
            </button>

            {/* Chat */}
            <button 
              onClick={() => {
                if (isMobile) {
                  setIsNavExpanded(false);
                } else {
                  setIsNavExpanded(!isNavExpanded);
                }
              }}
              className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
              title="Chat"
            >
              <div className="flex items-center w-full">
                <div className="w-10 flex justify-center flex-shrink-0">
                  <i className="fas fa-comment text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                </div>
                <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>聊天</span>
              </div>
            </button>
            
            {/* Conversation History */}
            <button 
              onClick={() => {
                if (isMobile) {
                  setIsNavExpanded(false);
                } else {
                  setIsNavExpanded(!isNavExpanded);
                }
              }}
              className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
              title="Conversation History"
            >
              <div className="flex items-center w-full">
                <div className="w-10 flex justify-center flex-shrink-0">
                  <i className="fas fa-history text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                </div>
                <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>聊天记录</span>
              </div>
            </button>
            
            {/* Profile */}
            <button 
              onClick={() => {
                if (isMobile) {
                  setIsNavExpanded(false);
                } else {
                  setIsNavExpanded(!isNavExpanded);
                }
              }}
              className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
              title="Profile"
            >
              <div className="flex items-center w-full">
                <div className="w-10 flex justify-center flex-shrink-0">
                  <i className="fas fa-user text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                </div>
                <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>个人资料</span>
              </div>
            </button>
            
            {/* Help */}
            <button 
              onClick={() => {
                if (isMobile) {
                  setIsNavExpanded(false);
                } else {
                  setIsNavExpanded(!isNavExpanded);
                }
              }}
              className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
              title="Help"
            >
              <div className="flex items-center w-full">
                <div className="w-10 flex justify-center flex-shrink-0">
                  <i className="fas fa-question-circle text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                </div>
                <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>帮助</span>
              </div>
            </button>
            </div>
            
            {/* Flexible spacer */}
            <div className="flex-1"></div>
            
            {/* Bottom section */}
            <div className="flex flex-col space-y-4">
            {/* Account Info */}
            <div className="flex items-center">
              <button 
                onClick={() => {
                  if (isMobile) {
                    setIsNavExpanded(false);
                  } else {
                    setIsNavExpanded(!isNavExpanded);
                  }
                }}
                className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-emerald-500/60 rounded-full flex items-center justify-center shadow-lg text-white font-semibold text-sm flex-shrink-0"
                title={user ? `${user.name} (${user.email})` : "账户信息"}
              >
                {user ? user.name?.charAt(0).toUpperCase() : 'U'}
              </button>
              <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap ml-3 transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>{user ? user.name : '账户信息'}</span>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && isNavExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsNavExpanded(false)}
        />
      )}

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