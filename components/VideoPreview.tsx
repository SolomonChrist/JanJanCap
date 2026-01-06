
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Caption, CaptionStyle } from '../types';

interface VideoPreviewProps {
  videoUrl: string;
  captions: Caption[];
  style: CaptionStyle;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onPlayRequest?: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ 
  videoUrl, 
  captions, 
  style, 
  onTimeUpdate,
  onDurationChange,
  canvasRef,
  videoRef,
  onPlayRequest
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animationId: number;

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !video) return;

      if (video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const vTime = video.currentTime;
      setCurrentTime(vTime);
      const activeCaption = captions.find(c => vTime >= c.start && vTime <= c.end);

      if (activeCaption) {
        ctx.save();
        const fontSize = (style.fontSize / 100) * canvas.height;
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const text = activeCaption.text;
        const maxWidth = canvas.width * 0.85;
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = words[0] || '';

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = ctx.measureText(currentLine + " " + word).width;
          if (width < maxWidth) {
            currentLine += " " + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);

        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        let maxLineLineWidth = 0;
        lines.forEach(line => {
          const lineWidth = ctx.measureText(line).width;
          if (lineWidth > maxLineLineWidth) maxLineLineWidth = lineWidth;
        });
        
        const xPos = (style.x / 100) * canvas.width;
        const yPos = (style.y / 100) * canvas.height;
        const padding = style.padding;
        const bgWidth = maxLineLineWidth + padding * 2;
        const bgHeight = totalHeight + padding * 2;
        
        ctx.fillStyle = style.backgroundColor;
        roundRect(
          ctx, 
          xPos - bgWidth / 2, 
          yPos - (lineHeight / 2) - padding - ((lines.length - 1) * lineHeight / 2), 
          bgWidth, 
          bgHeight, 
          style.borderRadius
        );
        ctx.fill();

        ctx.fillStyle = style.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const startY = yPos - ((lines.length - 1) * lineHeight / 2);
        lines.forEach((line, index) => {
          ctx.fillText(line, xPos, startY + (index * lineHeight));
        });
        ctx.restore();
      }

      if (onTimeUpdate) onTimeUpdate(vTime);
      animationId = requestAnimationFrame(render);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (onDurationChange) onDurationChange(video.duration);
    };

    // Use timeupdate to force-draw the canvas even if the tab is in background (throttling requestAnimationFrame)
    const handleTimeUpdate = () => {
      // If isPlaying is true but requestAnimationFrame might be paused in bg, 
      // timeupdate will still trigger render here
      if (document.hidden) {
        render();
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    render();

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      cancelAnimationFrame(animationId);
    };
  }, [captions, style, videoUrl, onTimeUpdate, onDurationChange]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        if (onPlayRequest) onPlayRequest();
        videoRef.current.play().catch(e => console.error("Playback failed", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [onPlayRequest]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative group bg-black rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 aspect-video flex items-center justify-center">
        <video 
          ref={videoRef} 
          src={videoUrl} 
          className="absolute opacity-0 pointer-events-none" 
          crossOrigin="anonymous" 
          playsInline
        />
        <canvas 
          ref={canvasRef} 
          className="block w-full h-full object-contain cursor-pointer z-10" 
          onClick={togglePlay} 
        />
        
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 pointer-events-none z-20 transition-opacity group-hover:bg-slate-950/40">
             <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-xl scale-110 transition-transform hover:scale-125 pointer-events-auto cursor-pointer" onClick={togglePlay}>
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
             </div>
          </div>
        )}
      </div>

      {/* Scrub Bar UI */}
      <div className="glass rounded-full px-6 py-3 border border-white/5 flex items-center gap-4">
        <button onClick={togglePlay} className="text-white hover:text-orange-500 transition-colors">
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        
        <span className="text-[10px] font-mono text-white/40 tabular-nums">{formatTime(currentTime)}</span>
        
        <div className="flex-1 relative flex items-center">
          <input 
            type="range" 
            min="0" 
            max={duration || 0} 
            step="0.01" 
            value={currentTime} 
            onChange={handleScrub}
            className="w-full h-1 bg-white/10 rounded-full appearance-none accent-orange-500 cursor-pointer"
          />
        </div>
        
        <span className="text-[10px] font-mono text-white/40 tabular-nums">{formatTime(duration)}</span>
      </div>
    </div>
  );
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
