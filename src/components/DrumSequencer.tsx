import React from 'react';
import { DrumTrack, DrumSound } from '../audio/types';
import { synthEngine } from '../audio/synthEngine';
import { Volume2, VolumeX, Sparkles, Trash2, Shuffle, ChevronLeft, ChevronRight, Play, Plug } from 'lucide-react';

interface DrumSequencerProps {
  tracks: DrumTrack[];
  currentStep: number;
  isPlaying: boolean;
  onToggleStep: (trackId: DrumSound, stepIndex: number) => void;
  onToggleMute: (trackId: DrumSound) => void;
  onToggleSolo: (trackId: DrumSound) => void;
  onVolumeChange: (trackId: DrumSound, vol: number) => void;
  onClearTrack: (trackId: DrumSound) => void;
  onRandomizeTrack: (trackId: DrumSound) => void;
  onShiftTrack: (trackId: DrumSound, direction: 'left' | 'right') => void;
  onClearAll: () => void;
  onRandomizeAll: () => void;
  isMidiRecordArmed?: boolean;
  onToggleMidiRecord?: () => void;
  connectedMidiDeviceName?: string | null;
  onOpenMidiModal?: () => void;
}

export const DrumSequencer: React.FC<DrumSequencerProps> = ({
  tracks,
  currentStep,
  isPlaying,
  onToggleStep,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onClearTrack,
  onRandomizeTrack,
  onShiftTrack,
  onClearAll,
  onRandomizeAll,
  isMidiRecordArmed = false,
  onToggleMidiRecord,
  connectedMidiDeviceName,
  onOpenMidiModal,
}) => {
  const handlePreviewSound = (sound: DrumSound) => {
    synthEngine.playDrum(sound, 1.0);
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-neutral-800/80">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-semibold text-white">16-Step Beatmaker</h2>
          <span className="text-xs text-neutral-400">Web Audio Analog Voice Modeling</span>
          {connectedMidiDeviceName && (
            <span className="text-[11px] text-emerald-400 hidden sm:flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              MIDI: {connectedMidiDeviceName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onToggleMidiRecord && (
            <button
              onClick={onToggleMidiRecord}
              title="Arm MIDI hardware pad recording into 16-step sequencer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                isMidiRecordArmed
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700/60'
              }`}
            >
              <Plug className="w-3.5 h-3.5 text-amber-400" />
              <span>{isMidiRecordArmed ? 'MIDI REC: ARMED' : 'MIDI Rec'}</span>
            </button>
          )}

          <button
            onClick={onRandomizeAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span>Randomize</span>
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 border border-neutral-700/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Sequencer Track Rows */}
      <div className="flex flex-col gap-2.5 overflow-x-auto pb-2">
        {tracks.map((track) => {
          return (
            <div
              key={track.id}
              className="flex items-center gap-2 sm:gap-3 min-w-[700px] p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/60 hover:border-neutral-700/70 transition-colors"
            >
              {/* Track Left Controls */}
              <div className="w-44 flex items-center justify-between gap-1.5 shrink-0">
                {/* Clickable name to audition sample */}
                <button
                  onClick={() => handlePreviewSound(track.id)}
                  title="Audition sound"
                  className="flex items-center gap-1.5 text-left group cursor-pointer"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: track.color }}
                  />
                  <span className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300 transition-colors truncate">
                    {track.name}
                  </span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Mute */}
                  <button
                    onClick={() => onToggleMute(track.id)}
                    className={`w-6 h-6 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      track.muted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    M
                  </button>
                  {/* Solo */}
                  <button
                    onClick={() => onToggleSolo(track.id)}
                    className={`w-6 h-6 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      track.soloed
                        ? 'bg-amber-500 text-neutral-950 shadow-xs'
                        : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    S
                  </button>
                  {/* Volume Mini Slider */}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={track.volume}
                    onChange={(e) => onVolumeChange(track.id, Number(e.target.value))}
                    className="w-12 h-1 accent-amber-500 bg-neutral-800 rounded-lg cursor-pointer"
                    title={`Volume: ${Math.round(track.volume * 100)}%`}
                  />
                </div>
              </div>

              {/* 16 Step Buttons */}
              <div className="flex-1 grid grid-cols-16 gap-1 sm:gap-1.5">
                {track.steps.map((isActive, stepIdx) => {
                  const isQuarterBeat = stepIdx % 4 === 0;
                  const isCurrent = currentStep === stepIdx && isPlaying;

                  return (
                    <button
                      key={stepIdx}
                      onClick={() => onToggleStep(track.id, stepIdx)}
                      className={`h-9 sm:h-10 rounded-md transition-all duration-75 flex flex-col items-center justify-center relative cursor-pointer ${
                        isActive
                          ? isCurrent
                            ? 'scale-95 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                            : 'shadow-xs'
                          : isCurrent
                          ? 'bg-neutral-800 border-amber-400/60'
                          : isQuarterBeat
                          ? 'bg-neutral-800/80 hover:bg-neutral-700/80'
                          : 'bg-neutral-900 hover:bg-neutral-800'
                      } border ${
                        isActive
                          ? 'border-transparent'
                          : isQuarterBeat
                          ? 'border-neutral-700/70'
                          : 'border-neutral-800/60'
                      }`}
                      style={{
                        backgroundColor: isActive
                          ? isCurrent
                            ? '#ffffff'
                            : track.color
                          : undefined,
                      }}
                    >
                      {/* Active indicator inner dot */}
                      {isActive && (
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isCurrent ? 'bg-amber-950' : 'bg-white/90'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Track Quick Actions (Shift & Clear) */}
              <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-neutral-800">
                <button
                  onClick={() => onShiftTrack(track.id, 'left')}
                  title="Shift steps left"
                  className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onShiftTrack(track.id, 'right')}
                  title="Shift steps right"
                  className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
