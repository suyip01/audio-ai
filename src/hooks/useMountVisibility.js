import { useState, useEffect } from 'react';

export default function useMountVisibility(delayMs = 100) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return isVisible;
}
