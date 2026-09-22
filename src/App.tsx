import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { AudioVisualizer } from './components/AudioVisualizer';
import { MasterControls } from './components/MasterControls';
import { DrumSequencer } from './components/DrumSequencer';
import { SynthConsole } from './components/SynthConsole';
import { AiSongwriterModal } from './components/AiSongwriterModal';
import { RecordManager } from './components/RecordManager';
import { MidiSettingsModal } from './components/MidiSettingsModal';
import { synthEngine } from './audio/synthEngine';
import { sequencer } from './audio/sequencer';
import { midiManager, MidiDevice, MIDI_DRUM_MAP } from './audio/midiManager';
import { MUSIC_PRESETS } from './audio/presets';
import { DrumSound, MusicPreset, SynthParams, DrumTrack } from './audio/types';
import { Sparkles, Disc, Radio, Sliders, Music2, Headphones, Play, Layers } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'drums' | 'synth' | 'ai'>('studio');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(84);
  const [swing, setSwing] = useState(0.15);
  const [currentStep, setCurrentStep] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activePreset, setActivePreset] = useState<MusicPreset>(MUSIC_PRESETS[0]);
  const [chordProgressionEnabled, setChordProgressionEnabled] = useState(true);
  const [arpeggiatorMode, setArpeggiatorMode] = useState<'off' | 'up' | 'down' | 'updown' | 'random'>('off');
  const [tracks, setTracks] = useState<DrumTrack[]>(sequencer.drumTracks);
  const [synthParams, setSynthParams] = useState<SynthParams>(synthEngine.params);

  // Web MIDI API State
  const [isMidiModalOpen, setIsMidiModalOpen] = useState(false);
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState<string>('all');
  const [isMidiRecordArmed, setIsMidiRecordArmed] = useState(false);
  const [midiRecordTarget, setMidiRecordTarget] = useState<'drums' | 'synth'>('drums');
  const [externalMidiNotes, setExternalMidiNotes] = useState<Set<string>>(new Set());
  const [lastMidiEvent, setLastMidiEvent] = useState<string | null>(null);

  // Synchronous refs for MIDI callbacks
  const currentStepRef = useRef(0);
  const isMidiRecordArmedRef = useRef(false);
  const midiRecordTargetRef = useRef<'drums' | 'synth'>('drums');

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    isMidiRecordArmedRef.current = isMidiRecordArmed;
  }, [isMidiRecordArmed]);

  useEffect(() => {
    midiRecordTargetRef.current = midiRecordTarget;
  }, [midiRecordTarget]);

  // Initialize MIDI listeners
  useEffect(() => {
    // Attempt auto-connect if already permitted
    if (midiManager.getIsSupported()) {
      midiManager.init().then((res) => {
        if (res.success) {
          setMidiDevices([...res.devices]);
        }
      });
    }

    midiManager.onStateChange = (devices) => {
      setMidiDevices([...devices]);
    };

    midiManager.onNoteOn = (noteName, velocity, midiNumber, channel) => {
      setLastMidiEvent(`Note On: ${noteName} · vel ${Math.round(velocity * 127)} (Ch ${channel})`);
      setExternalMidiNotes((prev) => new Set(prev).add(noteName));

      // Overdub / Record into sequencer if armed
      if (isMidiRecordArmedRef.current) {
        const step = currentStepRef.current;
        if (midiRecordTargetRef.current === 'drums') {
          const drumSound = MIDI_DRUM_MAP[midiNumber] || 'kick';
          synthEngine.playDrum(drumSound, velocity);
          sequencer.drumTracks = sequencer.drumTracks.map((t) => {
            if (t.id === drumSound) {
              const newSteps = [...t.steps];
              newSteps[step] = true;
              return { ...t, steps: newSteps };
            }
            return t;
          });
          setTracks([...sequencer.drumTracks]);
          return;
        } else {
          // Melodic / Synth step record
          const chordIndex = Math.floor(step / 4) % (sequencer.chords.length || 1);
          if (sequencer.chords[chordIndex]) {
            if (!sequencer.chords[chordIndex].notes.includes(noteName)) {
              sequencer.chords[chordIndex].notes = [
                ...sequencer.chords[chordIndex].notes.slice(-3),
                noteName,
              ];
            }
          }
        }
      }

      // Trigger polyphonic synthesizer
      synthEngine.triggerAttack(noteName, velocity);
    };

    midiManager.onNoteOff = (noteName) => {
      setExternalMidiNotes((prev) => {
        const next = new Set(prev);
        next.delete(noteName);
        return next;
      });
      synthEngine.triggerRelease(noteName);
    };

    midiManager.onControlChange = (controller, value, channel) => {
      if (controller === 1 || controller === 74) {
        const cutoff = Math.round(80 + value * 10000);
        synthEngine.updateSynthParams({ filterCutoff: cutoff });
        setSynthParams({ ...synthEngine.params });
        setLastMidiEvent(`CC ${controller} Cutoff: ${cutoff} Hz`);
      } else if (controller === 71) {
        const res = Number((0.5 + value * 12).toFixed(1));
        synthEngine.updateSynthParams({ filterResonance: res });
        setSynthParams({ ...synthEngine.params });
        setLastMidiEvent(`CC 71 Resonance: ${res}`);
      } else if (controller === 7) {
        handleVolumeChange(value);
        setLastMidiEvent(`CC 7 Volume: ${Math.round(value * 100)}%`);
      }
    };

    return () => {
      midiManager.disconnect();
    };
  }, []);

  // Initialize preset on mount
  useEffect(() => {
    applyPreset(MUSIC_PRESETS[0], false);

    // Wire sequencer UI callback
    sequencer.onStepChange = (step: number) => {
      setCurrentStep(step);
    };

    return () => {
      sequencer.stop();
    };
  }, []);

  const applyPreset = (preset: MusicPreset, autoPlay = false) => {
    setActivePreset(preset);
    setBpm(preset.bpm);
    sequencer.setBpm(preset.bpm);
    setSwing(preset.swing);
    sequencer.setSwing(preset.swing);

    // Apply drums
    sequencer.loadPresetDrums(preset.drums);
    setTracks([...sequencer.drumTracks]);

    // Apply chords
    sequencer.chords = preset.chords;

    // Apply synth
    synthEngine.updateSynthParams(preset.synth);
    setSynthParams({ ...synthEngine.params });

    if (autoPlay && !sequencer.getIsPlaying()) {
      sequencer.start();
      setIsPlaying(true);
    }
  };

  // Master Play / Pause
  const handleTogglePlay = () => {
    synthEngine.resume();
    sequencer.toggle();
    setIsPlaying(sequencer.getIsPlaying());
  };

  // The instant "Music Me" Hero feature
  const handleMusicMe = () => {
    synthEngine.resume();
    if (isPlaying) {
      sequencer.stop();
      setIsPlaying(false);
    } else {
      // If stopped, trigger immediate playback
      sequencer.start();
      setIsPlaying(true);
    }
  };

  // Surprise / Shuffle Vibe
  const handleSurpriseJam = () => {
    const currentIndex = MUSIC_PRESETS.findIndex((p) => p.id === activePreset.id);
    const nextIndex = (currentIndex + 1) % MUSIC_PRESETS.length;
    applyPreset(MUSIC_PRESETS[nextIndex], isPlaying);
  };

  // Drum Track Operations
  const handleToggleStep = (trackId: DrumSound, stepIndex: number) => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) => {
      if (t.id === trackId) {
        const nextSteps = [...t.steps];
        nextSteps[stepIndex] = !nextSteps[stepIndex];
        return { ...t, steps: nextSteps };
      }
      return t;
    });
    setTracks([...sequencer.drumTracks]);
  };

  const handleToggleMute = (trackId: DrumSound) => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) =>
      t.id === trackId ? { ...t, muted: !t.muted } : t
    );
    setTracks([...sequencer.drumTracks]);
  };

  const handleToggleSolo = (trackId: DrumSound) => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) =>
      t.id === trackId ? { ...t, soloed: !t.soloed } : t
    );
    setTracks([...sequencer.drumTracks]);
  };

  const handleTrackVolume = (trackId: DrumSound, vol: number) => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) =>
      t.id === trackId ? { ...t, volume: vol } : t
    );
    setTracks([...sequencer.drumTracks]);
  };

  const handleClearTrack = (trackId: DrumSound) => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) =>
      t.id === trackId ? { ...t, steps: Array(16).fill(false) } : t
    );
    setTracks([...sequencer.drumTracks]);
  };

  const handleRandomizeTrack = (trackId: DrumSound) => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) => {
      if (t.id === trackId) {
        const randomSteps = Array(16)
          .fill(false)
          .map(() => Math.random() > 0.65);
        return { ...t, steps: randomSteps };
      }
      return t;
    });
    setTracks([...sequencer.drumTracks]);
  };

  const handleShiftTrack = (trackId: DrumSound, direction: 'left' | 'right') => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) => {
      if (t.id === trackId) {
        const steps = [...t.steps];
        if (direction === 'left') {
          const first = steps.shift()!;
          steps.push(first);
        } else {
          const last = steps.pop()!;
          steps.unshift(last);
        }
        return { ...t, steps };
      }
      return t;
    });
    setTracks([...sequencer.drumTracks]);
  };

  const handleClearAllDrums = () => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) => ({
      ...t,
      steps: Array(16).fill(false),
    }));
    setTracks([...sequencer.drumTracks]);
  };

  const handleRandomizeAllDrums = () => {
    sequencer.drumTracks = sequencer.drumTracks.map((t) => {
      let density = 0.65;
      if (t.id === 'kick') density = 0.75;
      if (t.id === 'snare' || t.id === 'clap') density = 0.8;
      if (t.id === 'hihat') density = 0.5;

      return {
        ...t,
        steps: Array(16)
          .fill(false)
          .map(() => Math.random() > density),
      };
    });
    setTracks([...sequencer.drumTracks]);
  };

  // Master Volume and Mute
  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    if (!isMuted) {
      synthEngine.setMasterVolume(vol);
    }
  };

  const handleToggleMasterMute = () => {
    if (isMuted) {
      setIsMuted(false);
      synthEngine.setMasterVolume(volume);
    } else {
      setIsMuted(true);
      synthEngine.setMasterVolume(0);
    }
  };

  // Record Toggle
  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      synthEngine.startRecording();
      setIsRecording(true);
      if (!isPlaying) {
        sequencer.start();
        setIsPlaying(true);
      }
    }
  };

  // Synth Params Update
  const handleUpdateSynthParams = (newParams: Partial<SynthParams>) => {
    synthEngine.updateSynthParams(newParams);
    setSynthParams({ ...synthEngine.params });
  };

  // Arpeggiator mode
  const handleUpdateArpMode = (mode: 'off' | 'up' | 'down' | 'updown' | 'random') => {
    setArpeggiatorMode(mode);
    sequencer.arpeggiatorMode = mode;
  };

  // Apply AI Generated Groove
  const handleApplyAiGroove = (groove: any) => {
    const customPreset: MusicPreset = {
      id: `ai-${Date.now()}`,
      name: groove.name,
      genre: groove.genre,
      bpm: groove.bpm,
      swing: 0.15,
      description: groove.producerNote || 'AI Crafted Groove',
      scale: groove.scale,
      chords: groove.chords,
      drums: groove.drums,
      synth: groove.synth,
    };
    applyPreset(customPreset, true);
    setActiveTab('studio');
  };

  const connectedMidiDeviceName =
    midiDevices.find((d) => d.id === selectedMidiDevice)?.name ||
    (midiDevices.length > 0 ? midiDevices[0].name : null);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Bar Contract (3 zones) */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onMusicMe={handleMusicMe}
        isRecording={isRecording}
        onToggleRecord={handleToggleRecord}
        isMuted={isMuted}
        onToggleMute={handleToggleMasterMute}
        onOpenMidiModal={() => setIsMidiModalOpen(true)}
        midiDeviceCount={midiDevices.length}
        isMidiRecordArmed={isMidiRecordArmed}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Active Recording Monitor (if active or just finished) */}
        <RecordManager
          isRecording={isRecording}
          onStopRecord={() => setIsRecording(false)}
          presetName={activePreset.name}
        />

        {/* Dynamic View Tab Layout */}
        {activeTab === 'studio' && (
          <div className="flex flex-col gap-6">
            {/* Top Row: Visualizer & Master Transport */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <AudioVisualizer
                  isPlaying={isPlaying}
                  bpm={bpm}
                  currentTrackName={activePreset.name}
                  genre={activePreset.genre}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col gap-4">
                <MasterControls
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  bpm={bpm}
                  onBpmChange={(newBpm) => {
                    setBpm(newBpm);
                    sequencer.setBpm(newBpm);
                  }}
                  swing={swing}
                  onSwingChange={(newSwing) => {
                    setSwing(newSwing);
                    sequencer.setSwing(newSwing);
                  }}
                  currentStep={currentStep}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                  activePresetId={activePreset.id}
                  onSelectPreset={(preset) => applyPreset(preset, isPlaying)}
                  chordProgressionEnabled={chordProgressionEnabled}
                  onToggleChords={() => {
                    const next = !chordProgressionEnabled;
                    setChordProgressionEnabled(next);
                    sequencer.chordProgressionEnabled = next;
                  }}
                  onSurpriseJam={handleSurpriseJam}
                  isRecording={isRecording}
                  onToggleRecord={handleToggleRecord}
                />

                {/* Instant Vibe Deck Selection */}
                <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-amber-400" />
                      Studio Preset Vibes
                    </span>
                    <span className="text-[11px] text-neutral-500">Instant One-Click Groove</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MUSIC_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset, true)}
                        className={`p-2.5 rounded-lg text-left transition-all border cursor-pointer ${
                          activePreset.id === preset.id
                            ? 'bg-amber-500/15 border-amber-500/50 shadow-xs'
                            : 'bg-neutral-950/60 hover:bg-neutral-800/80 border-neutral-800/80'
                        }`}
                      >
                        <span className="text-xs font-semibold text-neutral-200 block truncate">
                          {preset.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
                          <span className="font-mono tabular-nums">{preset.bpm} BPM</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400/90 truncate">{preset.scale}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section: 16-Step Beatmaker */}
            <DrumSequencer
              tracks={tracks}
              currentStep={currentStep}
              isPlaying={isPlaying}
              onToggleStep={handleToggleStep}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onVolumeChange={handleTrackVolume}
              onClearTrack={handleClearTrack}
              onRandomizeTrack={handleRandomizeTrack}
              onShiftTrack={handleShiftTrack}
              onClearAll={handleClearAllDrums}
              onRandomizeAll={handleRandomizeAllDrums}
              isMidiRecordArmed={isMidiRecordArmed && midiRecordTarget === 'drums'}
              onToggleMidiRecord={() => {
                if (isMidiRecordArmed && midiRecordTarget === 'drums') {
                  setIsMidiRecordArmed(false);
                } else {
                  setMidiRecordTarget('drums');
                  setIsMidiRecordArmed(true);
                }
              }}
              connectedMidiDeviceName={connectedMidiDeviceName}
              onOpenMidiModal={() => setIsMidiModalOpen(true)}
            />

            {/* Bottom Section: Synthesizer & Interactive Keyboard */}
            <SynthConsole
              params={synthParams}
              onUpdateParams={handleUpdateSynthParams}
              chords={activePreset.chords}
              arpeggiatorMode={arpeggiatorMode}
              onUpdateArpMode={handleUpdateArpMode}
              externalActiveNotes={externalMidiNotes}
              connectedMidiDeviceName={connectedMidiDeviceName}
              onOpenMidiModal={() => setIsMidiModalOpen(true)}
            />
          </div>
        )}

        {/* View: Beatmaker Grid Dedicated View */}
        {activeTab === 'drums' && (
          <div className="flex flex-col gap-6">
            <MasterControls
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              bpm={bpm}
              onBpmChange={(newBpm) => {
                setBpm(newBpm);
                sequencer.setBpm(newBpm);
              }}
              swing={swing}
              onSwingChange={(newSwing) => {
                setSwing(newSwing);
                sequencer.setSwing(newSwing);
              }}
              currentStep={currentStep}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              activePresetId={activePreset.id}
              onSelectPreset={(preset) => applyPreset(preset, isPlaying)}
              chordProgressionEnabled={chordProgressionEnabled}
              onToggleChords={() => {
                const next = !chordProgressionEnabled;
                setChordProgressionEnabled(next);
                sequencer.chordProgressionEnabled = next;
              }}
              onSurpriseJam={handleSurpriseJam}
              isRecording={isRecording}
              onToggleRecord={handleToggleRecord}
            />

            <DrumSequencer
              tracks={tracks}
              currentStep={currentStep}
              isPlaying={isPlaying}
              onToggleStep={handleToggleStep}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onVolumeChange={handleTrackVolume}
              onClearTrack={handleClearTrack}
              onRandomizeTrack={handleRandomizeTrack}
              onShiftTrack={handleShiftTrack}
              onClearAll={handleClearAllDrums}
              onRandomizeAll={handleRandomizeAllDrums}
              isMidiRecordArmed={isMidiRecordArmed && midiRecordTarget === 'drums'}
              onToggleMidiRecord={() => {
                if (isMidiRecordArmed && midiRecordTarget === 'drums') {
                  setIsMidiRecordArmed(false);
                } else {
                  setMidiRecordTarget('drums');
                  setIsMidiRecordArmed(true);
                }
              }}
              connectedMidiDeviceName={connectedMidiDeviceName}
              onOpenMidiModal={() => setIsMidiModalOpen(true)}
            />
          </div>
        )}

        {/* View: Synth & Keyboard Dedicated View */}
        {activeTab === 'synth' && (
          <div className="flex flex-col gap-6">
            <MasterControls
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              bpm={bpm}
              onBpmChange={(newBpm) => {
                setBpm(newBpm);
                sequencer.setBpm(newBpm);
              }}
              swing={swing}
              onSwingChange={(newSwing) => {
                setSwing(newSwing);
                sequencer.setSwing(newSwing);
              }}
              currentStep={currentStep}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              activePresetId={activePreset.id}
              onSelectPreset={(preset) => applyPreset(preset, isPlaying)}
              chordProgressionEnabled={chordProgressionEnabled}
              onToggleChords={() => {
                const next = !chordProgressionEnabled;
                setChordProgressionEnabled(next);
                sequencer.chordProgressionEnabled = next;
              }}
              onSurpriseJam={handleSurpriseJam}
              isRecording={isRecording}
              onToggleRecord={handleToggleRecord}
            />

            <SynthConsole
              params={synthParams}
              onUpdateParams={handleUpdateSynthParams}
              chords={activePreset.chords}
              arpeggiatorMode={arpeggiatorMode}
              onUpdateArpMode={handleUpdateArpMode}
              externalActiveNotes={externalMidiNotes}
              connectedMidiDeviceName={connectedMidiDeviceName}
              onOpenMidiModal={() => setIsMidiModalOpen(true)}
            />
          </div>
        )}

        {/* View: AI Songwriter Copilot */}
        {activeTab === 'ai' && (
          <AiSongwriterModal
            currentBpm={bpm}
            onApplyGroove={handleApplyAiGroove}
          />
        )}
      </main>

      {/* Hardware MIDI Controller Modal */}
      <MidiSettingsModal
        isOpen={isMidiModalOpen}
        onClose={() => setIsMidiModalOpen(false)}
        devices={midiDevices}
        selectedDeviceId={selectedMidiDevice}
        onSelectDevice={(id) => {
          setSelectedMidiDevice(id);
          midiManager.setSelectedDeviceId(id);
        }}
        isRecordArmed={isMidiRecordArmed}
        onToggleRecordArm={() => setIsMidiRecordArmed(!isMidiRecordArmed)}
        recordTarget={midiRecordTarget}
        onSetRecordTarget={setMidiRecordTarget}
        lastMidiEvent={lastMidiEvent}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-neutral-800/80 px-6 py-4 mt-auto text-xs text-neutral-400 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span>Aura Music Studio</span>
          <span aria-hidden="true">·</span>
          <span>Web Audio Analog Synthesizer & Beat Sequencer</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-400">
          <span>44.1 kHz 16-Bit Audio Engine</span>
          <span aria-hidden="true">·</span>
          <span>Stereo Lookahead Clock</span>
        </div>
      </footer>
    </div>
  );
}
