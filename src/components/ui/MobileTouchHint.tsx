import { useState, useEffect } from 'react';

export function MobileTouchHint() {
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the hint before
    const dismissed = localStorage.getItem('touchHintDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      setIsVisible(false);
    } else {
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('touchHintDismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '20px',
        fontSize: '14px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxWidth: '90%',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-in',
      }}
    >
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}
      </style>
      <span style={{ fontSize: '18px' }}>✌️</span>
      <span>Use two fingers to rotate • Pinch to zoom</span>
    </div>
  );
}