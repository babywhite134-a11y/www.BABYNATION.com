import React, { useEffect, useRef, useState } from 'react';
import { synthEngine } from '../audio/synthEngine';
import { Activity, BarChart3, Disc3 } from 'lucide-react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  bpm: number;
  currentTrackName?: string;
  genre?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  bpm,
  currentTrackName = 'Midnight Lo-Fi',
  genre = 'Lo-Fi Chill',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visualMode, setVisualMode] = useState<'oscilloscope' | 'spectrum' | 'vinyl'>('oscilloscope');
  const [vuLevelL, setVuLevelL] = useState(0);
  const [vuLevelR, setVuLevelR] = useState(0);
  const vinylAngleRef = useRef(0);

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const analyser = synthEngine.getAnalyser();
      const width = canvas.width;
      const height = canvas.height;

      // Dark console canvas background
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);

      // Subtle phosphor grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridStep = 32;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (!analyser || !isPlaying) {
        // Idle heartbeat wave
        drawIdleState(ctx, width, height);
        setVuLevelL((prev) => Math.max(0, prev - 0.08));
        setVuLevelR((prev) => Math.max(0, prev - 0.08));
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (visualMode === 'oscilloscope') {
        analyser.getByteTimeDomainData(dataArray);
        drawOscilloscope(ctx, width, height, dataArray, bufferLength);
      } else if (visualMode === 'spectrum') {
        analyser.getByteFrequencyData(dataArray);
        drawSpectrum(ctx, width, height, dataArray, bufferLength);
      } else {
        analyser.getByteFrequencyData(dataArray);
        drawVinyl(ctx, width, height, dataArray, bufferLength);
      }

      // Calculate stereo VU estimation from time-domain / energy
      let sum = 0;
      for (let i = 0; i < Math.min(128, bufferLength); i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / 128) * 3.5;
      setVuLevelL((prev) => Math.min(1, Math.max(rms, prev * 0.85)));
      setVuLevelR((prev) => Math.min(1, Math.max(rms * (0.9 + Math.random() * 0.2), prev * 0.85)));

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, visualMode, bpm]);

  // --- Oscilloscope Drawing ---
  const drawOscilloscope = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    bufferLength: number
  ) => {
    ctx.lineWidth = 2.5;

    // Glowing phosphor gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#f59e0b');
    gradient.addColorStop(0.5, '#fbbf24');
    gradient.addColorStop(1, '#f97316');

    ctx.strokeStyle = gradient;
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';

    ctx.beginPath();
    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  };

  // --- Spectrum Bars Drawing ---
  const drawSpectrum = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    bufferLength: number
  ) => {
    const bars = 48;
    const barWidth = (width / bars) - 3;
    const step = Math.floor(bufferLength / (bars * 1.5));

    for (let i = 0; i < bars; i++) {
      const value = dataArray[i * step] || 0;
      const percent = value / 255;
      const barHeight = percent * (height - 24);
      const x = i * (barWidth + 3) + 6;
      const y = height - barHeight - 10;

      const barGradient = ctx.createLinearGradient(0, y, 0, height);
      barGradient.addColorStop(0, '#fbbf24');
      barGradient.addColorStop(0.5, '#f59e0b');
      barGradient.addColorStop(1, '#78350f');

      ctx.fillStyle = barGradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Peak LED dot
      ctx.fillStyle = percent > 0.8 ? '#ef4444' : '#fde68a';
      ctx.fillRect(x, Math.max(6, y - 4), barWidth, 2);
    }
  };

  // --- Vinyl Turntable Drawing ---
  const drawVinyl = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    bufferLength: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.44;

    vinylAngleRef.current += (bpm / 60) * 0.04;
    const angle = vinylAngleRef.current;

    // Outer Vinyl Disc
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#121216';
    ctx.fill();
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Concentric grooves
    for (let r = radius * 0.45; r < radius * 0.95; r += 7) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Sound wave reactive groove glow
    const bassEnergy = (dataArray[2] + dataArray[4]) / 512;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.6 + bassEnergy * 0.15), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.15 + bassEnergy * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center record label
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spindle hole
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0c';
    ctx.fill();

    // Text on label
    ctx.fillStyle = '#fde68a';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AURA 33 RPM', 0, -radius * 0.14);
    ctx.fillText('STEREO HIGH-FI', 0, radius * 0.18);

    ctx.restore();
  };

  const drawIdleState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    const time = Date.now() * 0.002;
    for (let x = 0; x < width; x++) {
      const y = height / 2 + Math.sin(x * 0.02 + time) * 3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  return (
    <div className="relative rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-inner">
      {/* Top visualizer status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800/80 bg-neutral-950/70">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="font-semibold text-neutral-200">{currentTrackName}</span>
          <span className="text-neutral-500" aria-hidden="true">·</span>
          <span className="text-amber-400/90">{genre}</span>
          <span className="text-neutral-500" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-neutral-400">{bpm} BPM</span>
        </div>

        {/* Visual Mode Switcher (clean functional segmented control) */}
        <div className="flex items-center gap-1 p-0.5 bg-neutral-900 rounded-md border border-neutral-800">
          <button
            onClick={() => setVisualMode('oscilloscope')}
            title="Oscilloscope Wave"
            className={`p-1.5 rounded text-xs transition-colors ${
              visualMode === 'oscilloscope' ? 'bg-neutral-800 text-amber-300' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisualMode('spectrum')}
            title="Frequency Spectrum"
            className={`p-1.5 rounded text-xs transition-colors ${
              visualMode === 'spectrum' ? 'bg-neutral-800 text-amber-300' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisualMode('vinyl')}
            title="Vinyl Turntable"
            className={`p-1.5 rounded text-xs transition-colors ${
              visualMode === 'vinyl' ? 'bg-neutral-800 text-amber-300' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Visualizer Frame */}
      <div className="relative w-full h-44 sm:h-52 md:h-60 bg-neutral-950 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={800}
          height={260}
          className="w-full h-full object-cover"
        />

        {/* Floating Stereo VU Meters on right side */}
        <div className="absolute right-4 bottom-4 flex items-end gap-1.5 p-2 rounded-md bg-neutral-950/80 border border-neutral-800/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1 text-[10px] font-mono text-neutral-400">
            <span>L</span>
            <div className="w-2.5 h-16 bg-neutral-900 rounded-sm overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded-xs transition-all duration-75"
                style={{
                  height: `${Math.round(vuLevelL * 100)}%`,
                  backgroundColor: vuLevelL > 0.85 ? '#ef4444' : vuLevelL > 0.65 ? '#f59e0b' : '#10b981',
                }}
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-[10px] font-mono text-neutral-400">
            <span>R</span>
            <div className="w-2.5 h-16 bg-neutral-900 rounded-sm overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded-xs transition-all duration-75"
                style={{
                  height: `${Math.round(vuLevelR * 100)}%`,
                  backgroundColor: vuLevelR > 0.85 ? '#ef4444' : vuLevelR > 0.65 ? '#f59e0b' : '#10b981',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
