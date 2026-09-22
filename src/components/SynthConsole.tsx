import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SynthParams, ChordDefinition } from '../audio/types';
import { synthEngine } from '../audio/synthEngine';
import { KEYBOARD_KEYS } from '../audio/notes';
import { Sliders, Waves, Activity, Radio, Disc, Sparkles, Plug } from 'lucide-react';

interface SynthConsoleProps {
  params: SynthParams;
  onUpdateParams: (newParams: Partial<SynthParams>) => void;
  chords: ChordDefinition[];
  arpeggiatorMode: 'off' | 'up' | 'down' | 'updown' | 'random';
  onUpdateArpMode: (mode: 'off' | 'up' | 'down' | 'updown' | 'random') => void;
  externalActiveNotes?: Set<string>;
  connectedMidiDeviceName?: string | null;
  onOpenMidiModal?: () => void;
}

export const SynthConsole: React.FC<SynthConsoleProps> = ({
  params,
  onUpdateParams,
  chords,
  arpeggiatorMode,
  onUpdateArpMode,
  externalActiveNotes,
  connectedMidiDeviceName,
  onOpenMidiModal,
}) => {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const isMouseDownRef = useRef(false);

  // Play note handler
  const handleNoteOn = useCallback((note: string) => {
    synthEngine.triggerAttack(note, 0.85);
    setActiveNotes((prev) => new Set(prev).add(note));
  }, []);

  const handleNoteOff = useCallback((note: string) => {
    synthEngine.triggerRelease(note);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      const matched = KEYBOARD_KEYS.find((k) => k.keyChar === key);
      if (matched) {
        handleNoteOn(matched.note);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      const matched = KEYBOARD_KEYS.find((k) => k.keyChar === key);
      if (matched) {
        handleNoteOff(matched.note);
      }
    };

    const handleWindowMouseUp = () => {
      isMouseDownRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [handleNoteOn, handleNoteOff]);

  const handleChordPadClick = (chord: ChordDefinition) => {
    synthEngine.playChord(chord.notes, 1.4, 0.75);
    chord.notes.forEach((n) => {
      setActiveNotes((prev) => new Set(prev).add(n));
      setTimeout(() => {
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(n);
          return next;
        });
      }, 350);
    });
  };

  // SVG representation of ADSR envelope
  const renderAdsrCurve = () => {
    const totalTime = params.attack + params.decay + 0.3 + params.release;
    const w = 180;
    const h = 50;

    const p1x = 10;
    const p1y = h - 5;

    const p2x = p1x + (params.attack / totalTime) * (w - 20);
    const p2y = 8;

    const p3x = p2x + (params.decay / totalTime) * (w - 20);
    const p3y = h - 5 - params.sustain * (h - 15);

    const p4x = p3x + (0.3 / totalTime) * (w - 20);
    const p4y = p3y;

    const p5x = p4x + (params.release / totalTime) * (w - 20);
    const p5y = h - 5;

    const pathData = `M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y} L ${p5x} ${p5y}`;

    return (
      <svg className="w-full h-14 bg-neutral-950/80 rounded-md border border-neutral-800 p-1">
        <path d={pathData} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
        {/* Fill underneath */}
        <path
          d={`${pathData} L ${p5x} ${h - 5} L ${p1x} ${h - 5} Z`}
          fill="rgba(251, 191, 36, 0.12)"
        />
      </svg>
    );
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm flex flex-col gap-5">
      {/* Synth Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Oscillator & Waveform */}
        <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-amber-400" />
              Oscillator Voice
            </span>
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Dual Core</span>
          </div>

          {/* Waveform Selector */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-900 rounded-lg border border-neutral-800">
            {(['sawtooth', 'sine', 'triangle', 'square'] as OscillatorType[]).map((w) => (
              <button
                key={w}
                onClick={() => onUpdateParams({ waveform: w })}
                className={`py-1.5 text-xs font-medium capitalize rounded-md transition-colors cursor-pointer ${
                  params.waveform === w
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Sub Oscillator Body */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-neutral-400">Sub Osc (-1 Oct)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={params.subOscVolume}
              onChange={(e) => onUpdateParams({ subOscVolume: Number(e.target.value) })}
              className="w-28 accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Vinyl Crackle Warmth Toggle */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-850">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-amber-400" />
              Vinyl Surface Crackle
            </span>
            <button
              onClick={() => onUpdateParams({ vinylCrackle: !params.vinylCrackle })}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                params.vinylCrackle
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {params.vinylCrackle ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* 2. Resonant Filter & Arpeggiator */}
        <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              Analog Filter & Arp
            </span>
            <span className="text-[10px] font-mono text-amber-400/80">
              {Math.round(params.filterCutoff)} Hz
            </span>
          </div>

          {/* Filter Cutoff */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Cutoff Frequency</span>
              <span className="font-mono tabular-nums text-neutral-200">{Math.round(params.filterCutoff)} Hz</span>
            </div>
            <input
              type="range"
              min="80"
              max="12000"
              step="50"
              value={params.filterCutoff}
              onChange={(e) => onUpdateParams({ filterCutoff: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Filter Resonance (Q) */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Resonance (Q)</span>
              <span className="font-mono tabular-nums text-neutral-200">{params.filterResonance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="14"
              step="0.2"
              value={params.filterResonance}
              onChange={(e) => onUpdateParams({ filterResonance: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Arpeggiator Mode Selector */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-850">
            <span className="text-neutral-400">Arpeggiator</span>
            <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-md border border-neutral-800">
              {(['off', 'up', 'down', 'updown', 'random'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onUpdateArpMode(m)}
                  className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors uppercase cursor-pointer ${
                    arpeggiatorMode === m
                      ? 'bg-amber-500 text-neutral-950 font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. ADSR Envelope & FX */}
        <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Envelope (ADSR) & FX
            </span>
            <span className="text-[10px] font-mono text-neutral-500">Echo & Space</span>
          </div>

          {renderAdsrCurve()}

          <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-neutral-400 font-mono">
            <div>
              <span className="block text-neutral-500">ATT</span>
              <input
                type="range"
                min="0.005"
                max="1.2"
                step="0.01"
                value={params.attack}
                onChange={(e) => onUpdateParams({ attack: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-neutral-300">{(params.attack * 1000).toFixed(0)}ms</span>
            </div>
            <div>
              <span className="block text-neutral-500">DEC</span>
              <input
                type="range"
                min="0.02"
                max="1.5"
                step="0.02"
                value={params.decay}
                onChange={(e) => onUpdateParams({ decay: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-neutral-300">{(params.decay * 1000).toFixed(0)}ms</span>
            </div>
            <div>
              <span className="block text-neutral-500">SUS</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.sustain}
                onChange={(e) => onUpdateParams({ sustain: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-neutral-300">{Math.round(params.sustain * 100)}%</span>
            </div>
            <div>
              <span className="block text-neutral-500">REL</span>
              <input
                type="range"
                min="0.05"
                max="2.5"
                step="0.05"
                value={params.release}
                onChange={(e) => onUpdateParams({ release: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-neutral-300">{(params.release * 1000).toFixed(0)}ms</span>
            </div>
          </div>

          {/* Delay & Reverb mini mixes */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-neutral-850">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Delay Mix</span>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={params.delayWet}
                onChange={(e) => onUpdateParams({ delayWet: Number(e.target.value) })}
                className="w-16 accent-amber-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Reverb Space</span>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={params.reverbWet}
                onChange={(e) => onUpdateParams({ reverbWet: Number(e.target.value) })}
                className="w-16 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Pad Chord Trigger Bank */}
      {chords.length > 0 && (
        <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300">Instant Chord Trigger Pads</span>
            <span className="text-[11px] text-neutral-500">Tap to play full polyphonic chord</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {chords.map((chord, idx) => (
              <button
                key={idx}
                onClick={() => handleChordPadClick(chord)}
                className="p-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/50 text-left transition-all active:scale-95 group cursor-pointer"
              >
                <span className="text-[10px] font-mono text-amber-400 block mb-0.5">PAD {idx + 1}</span>
                <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors block">
                  {chord.name}
                </span>
                <span className="text-[10px] font-mono text-neutral-400 truncate block mt-0.5">
                  {chord.notes.join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2-Octave Playable Interactive Piano Keyboard */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">Polyphonic Studio Keys</span>
            {connectedMidiDeviceName ? (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                MIDI: {connectedMidiDeviceName}
              </span>
            ) : onOpenMidiModal ? (
              <button
                onClick={onOpenMidiModal}
                className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <Plug className="w-3 h-3" />
                <span>Connect MIDI Keyboard</span>
              </button>
            ) : null}
          </div>
          <span>Play via MIDI Controller, Mouse, Touch, or Keys [Z-M] & [Q-I]</span>
        </div>

        <div
          className="relative h-36 sm:h-40 select-none bg-neutral-950 p-2 rounded-xl border border-neutral-800 flex overflow-x-auto shadow-inner"
          onMouseDown={() => (isMouseDownRef.current = true)}
        >
          {/* White Keys */}
          <div className="flex w-full h-full">
            {KEYBOARD_KEYS.filter((k) => !k.isBlack).map((key) => {
              const isPressed = activeNotes.has(key.note) || Boolean(externalActiveNotes?.has(key.note));
              return (
                <button
                  key={key.note}
                  onMouseDown={() => handleNoteOn(key.note)}
                  onMouseUp={() => handleNoteOff(key.note)}
                  onMouseEnter={() => {
                    if (isMouseDownRef.current) handleNoteOn(key.note);
                  }}
                  onMouseLeave={() => {
                    if (isMouseDownRef.current) handleNoteOff(key.note);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleNoteOn(key.note);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleNoteOff(key.note);
                  }}
                  className={`flex-1 h-full rounded-b-md border border-neutral-300/30 flex flex-col justify-end items-center pb-2 transition-all cursor-pointer ${
                    isPressed
                      ? 'bg-amber-400 text-neutral-950 shadow-[0_0_16px_rgba(251,191,36,0.8)] scale-y-[0.98]'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 shadow-sm'
                  }`}
                >
                  <span className="text-[10px] font-bold font-mono">{key.note}</span>
                  {key.keyChar && (
                    <span className="text-[9px] font-mono opacity-60">[{key.keyChar}]</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Black Keys Layer */}
          <div className="absolute top-2 left-2 right-2 h-20 sm:h-24 pointer-events-none flex">
            {/* We map proportional offsets for black keys */}
            {KEYBOARD_KEYS.map((key, idx) => {
              if (!key.isBlack) return null;
              const isPressed = activeNotes.has(key.note) || Boolean(externalActiveNotes?.has(key.note));

              // Position relative to white keys count (15 white keys in 2 octaves)
              const whiteKeysBefore = KEYBOARD_KEYS.slice(0, idx).filter((k) => !k.isBlack).length;
              const leftPercent = (whiteKeysBefore / 15) * 100 - 2.2;

              return (
                <button
                  key={key.note}
                  style={{ left: `${leftPercent}%`, width: '4.4%' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleNoteOn(key.note);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    handleNoteOff(key.note);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNoteOn(key.note);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNoteOff(key.note);
                  }}
                  className={`absolute h-full pointer-events-auto rounded-b-md border border-neutral-700 flex flex-col justify-end items-center pb-1 transition-all cursor-pointer z-10 ${
                    isPressed
                      ? 'bg-amber-400 text-neutral-950 shadow-[0_0_14px_rgba(251,191,36,0.9)] scale-y-[0.97]'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 shadow-md'
                  }`}
                >
                  <span className="text-[9px] font-mono">{key.note}</span>
                  {key.keyChar && (
                    <span className="text-[8px] font-mono opacity-60">[{key.keyChar}]</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
