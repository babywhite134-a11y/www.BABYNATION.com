import React, { useRef, useState } from 'react';
import { Play, Pause, Shuffle, Volume2, RotateCcw, Music, Sparkles } from 'lucide-react';
import { MUSIC_PRESETS } from '../audio/presets';
import { MusicPreset } from '../audio/types';

interface MasterControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  swing: number;
  onSwingChange: (swing: number) => void;
  currentStep: number;
  volume: number;
  onVolumeChange: (volume: number) => void;
  activePresetId: string;
  onSelectPreset: (preset: MusicPreset) => void;
  chordProgressionEnabled: boolean;
  onToggleChords: () => void;
  onSurpriseJam: () => void;
  isRecording?: boolean;
  onToggleRecord?: () => void;
}

export const MasterControls: React.FC<MasterControlsProps> = ({
  isPlaying,
  onTogglePlay,
  bpm,
  onBpmChange,
  swing,
  onSwingChange,
  currentStep,
  volume,
  onVolumeChange,
  activePresetId,
  onSelectPreset,
  chordProgressionEnabled,
  onToggleChords,
  onSurpriseJam,
  isRecording = false,
  onToggleRecord,
}) => {
  // Tap tempo logic
  const tapTimesRef = useRef<number[]>([]);
  const [tapFlash, setTapFlash] = useState(false);

  const handleTapTempo = () => {
    const now = performance.now();
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);

    const times = tapTimesRef.current;
    times.push(now);

    // Keep only last 4 taps within 2.5 seconds
    if (times.length > 1 && now - times[times.length - 2] > 2500) {
      tapTimesRef.current = [now];
      return;
    }

    if (times.length > 4) {
      times.shift();
    }

    if (times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 50 && calculatedBpm <= 200) {
        onBpmChange(calculatedBpm);
      }
    }
  };

  return (
    <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm flex flex-col gap-4">
      {/* 16-step playhead LEDs */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {Array.from({ length: 16 }).map((_, index) => {
          const isQuarterBeat = index % 4 === 0;
          const isActive = currentStep === index && isPlaying;
          return (
            <div
              key={index}
              className="flex-1 min-w-[18px] flex flex-col items-center gap-1"
            >
              <div
                className={`w-full h-2 rounded-xs transition-all duration-75 ${
                  isActive
                    ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                    : isQuarterBeat
                    ? 'bg-neutral-700'
                    : 'bg-neutral-800'
                }`}
              />
              <span
                className={`font-mono text-[9px] tabular-nums ${
                  isActive ? 'text-amber-300 font-bold' : isQuarterBeat ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                {index + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main transport row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Play/Pause Master Button + Preset Selector */}
        <div className="md:col-span-5 flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            className={`h-11 px-5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-[0_0_16px_rgba(245,158,11,0.4)]'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Loop</span>
              </>
            )}
          </button>

          {/* Record Master Channel Button */}
          {onToggleRecord && (
            <button
              onClick={onToggleRecord}
              title={isRecording ? 'Stop recording and export session' : 'Record master channel output'}
              className={`h-11 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                isRecording
                  ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse'
                  : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500' : 'bg-red-400'}`} />
              <span className="hidden sm:inline">{isRecording ? 'Rec...' : 'Record'}</span>
            </button>
          )}

          {/* Preset Selector */}
          <div className="flex-1 min-w-0">
            <select
              value={activePresetId}
              onChange={(e) => {
                const found = MUSIC_PRESETS.find((p) => p.id === e.target.value);
                if (found) onSelectPreset(found);
              }}
              className="w-full h-11 px-3 bg-neutral-950 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-200 focus:outline-hidden focus:border-amber-400 truncate cursor-pointer"
            >
              {MUSIC_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-neutral-900 text-neutral-200">
                  {preset.name} ({preset.bpm} BPM)
                </option>
              ))}
            </select>
          </div>

          {/* Random Surprise Vibe Button */}
          <button
            onClick={onSurpriseJam}
            title="Randomize Musical Vibe"
            className="h-11 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg text-neutral-400 hover:text-amber-400 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        {/* BPM & Tap Tempo */}
        <div className="md:col-span-4 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider shrink-0">BPM</span>
            <input
              type="range"
              min="60"
              max="180"
              value={bpm}
              onChange={(e) => onBpmChange(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="font-mono text-xs tabular-nums text-amber-300 w-9 text-right font-semibold shrink-0">
              {bpm}
            </span>
          </div>

          <button
            onClick={handleTapTempo}
            className={`h-9 px-2.5 rounded-md text-[11px] font-mono uppercase tracking-wider border transition-all cursor-pointer shrink-0 ${
              tapFlash
                ? 'bg-amber-400 text-neutral-950 border-amber-300 scale-95'
                : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
            }`}
          >
            Tap
          </button>
        </div>

        {/* Swing & Volume Controls */}
        <div className="md:col-span-3 flex items-center justify-end gap-3">
          {/* Chords Backing Toggle */}
          <button
            onClick={onToggleChords}
            className={`h-9 px-3 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              chordProgressionEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-400'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Chords</span>
          </button>

          {/* Volume Slider */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer"
              title={`Master Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
