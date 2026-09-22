import React from 'react';
import { Play, Pause, Sparkles, Disc, Radio, Mic, Volume2, VolumeX, Plug } from 'lucide-react';

interface TopBarProps {
  activeTab: 'studio' | 'drums' | 'synth' | 'ai';
  setActiveTab: (tab: 'studio' | 'drums' | 'synth' | 'ai') => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onMusicMe: () => void;
  isRecording: boolean;
  onToggleRecord: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenMidiModal?: () => void;
  midiDeviceCount?: number;
  isMidiRecordArmed?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  isPlaying,
  onTogglePlay,
  onMusicMe,
  isRecording,
  onToggleRecord,
  isMuted,
  onToggleMute,
  onOpenMidiModal,
  midiDeviceCount = 0,
  isMidiRecordArmed = false,
}) => {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 select-none">
      {/* Zone 1: Single text element Brand Zone */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse" />
          Aura Music Studio
        </a>
      </div>

      {/* Zone 2: 4 clean navigation view selectors */}
      <nav className="hidden md:flex items-center gap-1 p-1 bg-neutral-900/90 rounded-lg border border-neutral-800">
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
            activeTab === 'studio'
              ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Master Studio
        </button>
        <button
          onClick={() => setActiveTab('drums')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
            activeTab === 'drums'
              ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Beatmaker 16-Step
        </button>
        <button
          onClick={() => setActiveTab('synth')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
            activeTab === 'synth'
              ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Synth & Keyboard
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ai'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-neutral-400 hover:text-amber-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          AI Copilot
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Mute button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute master' : 'Mute master'}
          aria-label={isMuted ? 'Unmute master' : 'Mute master'}
          className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
            isMuted
              ? 'bg-red-950/40 border-red-800/60 text-red-400'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* MIDI Hardware Controller Button */}
        {onOpenMidiModal && (
          <button
            onClick={onOpenMidiModal}
            title={
              midiDeviceCount > 0
                ? `${midiDeviceCount} MIDI device(s) connected. Click to configure.`
                : 'Connect external MIDI Keyboard / Controller'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
              isMidiRecordArmed
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                : midiDeviceCount > 0
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isMidiRecordArmed
                ? 'MIDI REC'
                : midiDeviceCount > 0
                ? `MIDI (${midiDeviceCount})`
                : 'MIDI'}
            </span>
          </button>
        )}

        {/* Live Record Toggle */}
        <button
          onClick={onToggleRecord}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            isRecording
              ? 'bg-red-500/20 border-red-500/60 text-red-300 animate-pulse'
              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-neutral-500'}`} />
          <span className="whitespace-nowrap">{isRecording ? 'Rec...' : 'Record'}</span>
        </button>

        {/* The Instant "Music Me" Hero Trigger */}
        <button
          onClick={onMusicMe}
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-95 transition-all whitespace-nowrap cursor-pointer"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'Pause Music' : 'Music Me!'}</span>
        </button>
      </div>
    </header>
  );
};
