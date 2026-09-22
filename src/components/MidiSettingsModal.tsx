import React, { useState, useEffect } from 'react';
import { midiManager, MidiDevice } from '../audio/midiManager';
import { Radio, Plug, Check, AlertCircle, RefreshCw, X, Sliders, Music, Disc } from 'lucide-react';

interface MidiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: MidiDevice[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  isRecordArmed: boolean;
  onToggleRecordArm: () => void;
  recordTarget: 'drums' | 'synth';
  onSetRecordTarget: (target: 'drums' | 'synth') => void;
  lastMidiEvent: string | null;
}

export const MidiSettingsModal: React.FC<MidiSettingsModalProps> = ({
  isOpen,
  onClose,
  devices,
  selectedDeviceId,
  onSelectDevice,
  isRecordArmed,
  onToggleRecordArm,
  recordTarget,
  onSetRecordTarget,
  lastMidiEvent,
}) => {
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMsg(null);
    const result = await midiManager.init();
    setConnecting(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Could not connect to Web MIDI');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-5 sm:p-6 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">MIDI Hardware Controller</h2>
              <p className="text-xs text-neutral-400">Connect USB or Bluetooth MIDI keyboards & pads</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection status */}
        {!midiManager.getIsInitialized() ? (
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center text-center gap-3">
            <Plug className="w-8 h-8 text-neutral-500 animate-pulse" />
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Connect MIDI Hardware</h3>
              <p className="text-xs text-neutral-400 max-w-sm mt-1">
                Aura supports plug-and-play USB/Bluetooth MIDI keyboards (Akai, Arturia, Novation, Roland, Korg, etc.).
              </p>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
              <span>{connecting ? 'Requesting MIDI Access...' : 'Enable MIDI Access'}</span>
            </button>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-red-400 mt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Device Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-neutral-300">Active MIDI Input Device:</label>
              {devices.length === 0 ? (
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
                  <span>No MIDI controllers detected. Plug one in and it will automatically appear!</span>
                  <button
                    onClick={handleConnect}
                    className="p-1 text-neutral-400 hover:text-white cursor-pointer"
                    title="Rescan devices"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => onSelectDevice(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-100 focus:outline-hidden focus:border-amber-400 cursor-pointer"
                  >
                    <option value="all">All Connected Devices (Omni)</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.manufacturer || 'MIDI'})
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {devices.length} MIDI {devices.length === 1 ? 'device' : 'devices'} active & ready
                  </span>
                </div>
              )}
            </div>

            {/* Sequencer MIDI Record Configuration */}
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Sequencer MIDI Input Recording</span>
                  <span className="text-[11px] text-neutral-400">Record incoming MIDI notes into 16-step patterns</span>
                </div>

                <button
                  onClick={onToggleRecordArm}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isRecordArmed
                      ? 'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.5)] animate-pulse'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isRecordArmed ? 'bg-white' : 'bg-neutral-500'}`} />
                  <span>{isRecordArmed ? 'REC ARMED' : 'ARM RECORD'}</span>
                </button>
              </div>

              {/* Target Selector: Drums or Synth */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-neutral-850">
                <button
                  onClick={() => onSetRecordTarget('drums')}
                  className={`p-2.5 rounded-lg text-left transition-colors border cursor-pointer ${
                    recordTarget === 'drums'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                    <Disc className="w-3.5 h-3.5" />
                    <span>Drum Machine Pads</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    C1 (36) Kick, D1 (38) Snare, F#1 (42) HiHat
                  </span>
                </button>

                <button
                  onClick={() => onSetRecordTarget('synth')}
                  className={`p-2.5 rounded-lg text-left transition-colors border cursor-pointer ${
                    recordTarget === 'synth'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                    <Music className="w-3.5 h-3.5" />
                    <span>Polyphonic Synth Keys</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Play keys to overdub chords on step intervals
                  </span>
                </button>
              </div>
            </div>

            {/* Live MIDI Event Monitor */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
              <span className="text-neutral-500 font-mono">MIDI MONITOR:</span>
              <span className="font-mono text-amber-300 truncate font-semibold">
                {lastMidiEvent || 'Awaiting incoming MIDI signal...'}
              </span>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px] text-neutral-400">
          <span>Supported: Note On/Off, Velocity, Mod Wheel (CC1), Cutoff (CC74), Resonance (CC71)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
