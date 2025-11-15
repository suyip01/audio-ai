import { useState, useEffect } from 'react';

export default function useSessionId(userId) {
  const [sessionId, setSessionId] = useState(null);
  useEffect(() => {
    if (userId) {
      setSessionId(`chat-session-${userId}`);
    } else {
      setSessionId(`temp-session-${Date.now()}`);
    }
  }, [userId]);
  return sessionId;
}
