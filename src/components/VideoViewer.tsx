import { useRef, useEffect } from 'react';

interface VideoViewerProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  name?: string;
  tag?: string;
}

export default function VideoViewer({ isOpen, onClose, videoUrl, name, tag }: VideoViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.classList.add('locked');
      if (videoRef.current && videoUrl) {
        videoRef.current.src = videoUrl;
        videoRef.current.play();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      if (!isOpen) document.body.classList.remove('locked');
    };
  }, [isOpen, onClose, videoUrl]);

  function handleClose() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      className="fixed inset-0 flex flex-col items-center justify-center transition-opacity duration-300"
      style={{
        background: 'rgba(0,0,0,0.96)',
        zIndex: 600,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'all' : 'none',
      }}
    >
      <button
        onClick={handleClose}
        className="absolute top-5 right-6 bg-transparent border-none cursor-pointer transition-colors duration-200"
        style={{ color: 'rgba(240,235,227,0.5)', fontSize: '28px', lineHeight: 1 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#F0EBE3')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,235,227,0.5)')}
      >
        ✕
      </button>

      <video
        ref={videoRef}
        controls
        playsInline
        className="rounded-[4px]"
        style={{
          maxWidth: 'min(900px, 95vw)',
          maxHeight: '80vh',
          boxShadow: '0 0 0 1px rgba(200,146,74,0.2)',
        }}
      />

      <div className="mt-5 text-center">
        <p
          className="font-display text-[clamp(22px,4vw,32px)] font-light mb-1"
          style={{ color: '#F0EBE3' }}
        >
          {name}
        </p>
        <p className="text-[10px] tracking-[3px] uppercase" style={{ color: '#C8924A' }}>
          {tag}
        </p>
      </div>
    </div>
  );
}
