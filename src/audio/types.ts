export type DrumSound = 'kick' | 'snare' | 'hihat' | 'clap' | 'perc' | 'bass808';

export interface DrumTrack {
  id: DrumSound;
  name: string;
  color: string;
  volume: number; // 0 to 1
  muted: boolean;
  soloed: boolean;
  steps: boolean[]; // 16 steps
}

export interface SynthParams {
  waveform: OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0 to 1
  release: number; // seconds
  filterCutoff: number; // Hz (20 - 20000)
  filterResonance: number; // Q (0.1 - 20)
  filterType: BiquadFilterType;
  delayTime: number; // seconds (0 to 1)
  delayFeedback: number; // 0 to 0.9
  delayWet: number; // 0 to 1
  reverbWet: number; // 0 to 1
  volume: number; // 0 to 1
  subOscVolume: number; // 0 to 1
  vinylCrackle: boolean;
}

export interface ChordDefinition {
  name: string;
  notes: string[]; // e.g. ["D4", "F4", "A4", "C5"]
}

export interface MusicPreset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  swing: number; // 0 to 0.5
  description: string;
  scale: string;
  chords: ChordDefinition[];
  drums: Record<DrumSound, number[]>; // 16 numbers (0 or 1)
  synth: Partial<SynthParams>;
  melodyPattern?: number[]; // note pitch index for each step or -1
}
