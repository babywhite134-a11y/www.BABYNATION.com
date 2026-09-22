import { midiToNote } from './notes';
import { DrumSound } from './types';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: string;
}

export type MidiNoteOnCallback = (note: string, velocity: number, midiNumber: number, channel: number) => void;
export type MidiNoteOffCallback = (note: string, midiNumber: number, channel: number) => void;
export type MidiControlChangeCallback = (controller: number, value: number, channel: number) => void;
export type MidiStateChangeCallback = (devices: MidiDevice[]) => void;

// General MIDI standard drum mappings
export const MIDI_DRUM_MAP: Record<number, DrumSound> = {
  35: 'kick',     // Acoustic Bass Drum
  36: 'kick',     // Bass Drum 1
  38: 'snare',    // Acoustic Snare
  40: 'snare',    // Electric Snare
  42: 'hihat',    // Closed Hi-Hat
  44: 'hihat',    // Pedal Hi-Hat
  46: 'hihat',    // Open Hi-Hat
  39: 'clap',     // Hand Clap
  37: 'perc',     // Side Stick / Rim
  45: 'perc',     // Low Tom
  47: 'perc',     // Mid Tom
  50: 'perc',     // High Tom
  33: 'bass808',  // Low A / 808
  34: 'bass808',  // Low Bb / 808
  48: 'bass808',  // C3 (if mapped to bass)
};

export class MidiManager {
  private midiAccess: any = null;
  private isSupported = false;
  private isInitialized = false;
  private selectedDeviceId: string = 'all'; // 'all' or device id
  private connectedDevices: MidiDevice[] = [];

  // MIDI Record Mode
  public isRecordArmed = false;
  public recordTarget: 'drums' | 'synth' = 'synth';
  public stepRecordMode = false; // Step-by-step entry mode
  public activeStepForInput = 0;

  // Active playing notes from MIDI (to prevent stuck notes and light up UI)
  public activeMidiNotes: Set<string> = new Set();

  // Callbacks
  public onNoteOn?: MidiNoteOnCallback;
  public onNoteOff?: MidiNoteOffCallback;
  public onControlChange?: MidiControlChangeCallback;
  public onStateChange?: MidiStateChangeCallback;
  public onStepRecordAdvance?: (nextStep: number) => void;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public getDevices(): MidiDevice[] {
    return this.connectedDevices;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public setSelectedDeviceId(id: string) {
    this.selectedDeviceId = id;
    this.attachListeners();
  }

  public async init(): Promise<{ success: boolean; error?: string; devices: MidiDevice[] }> {
    if (!this.isSupported) {
      return { success: false, error: 'Web MIDI API is not supported in this browser.', devices: [] };
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.isInitialized = true;
      this.updateDevicesList();

      this.midiAccess.onstatechange = () => {
        this.updateDevicesList();
        this.attachListeners();
      };

      this.attachListeners();

      return {
        success: true,
        devices: this.connectedDevices,
      };
    } catch (err: any) {
      console.warn('Web MIDI Access request failed or denied:', err);
      return {
        success: false,
        error: err?.message || 'Access to MIDI devices was denied or unavailable.',
        devices: [],
      };
    }
  }

  private updateDevicesList() {
    if (!this.midiAccess) return;
    const devices: MidiDevice[] = [];
    const inputs = this.midiAccess.inputs.values();

    for (const input of inputs) {
      devices.push({
        id: input.id,
        name: input.name || `MIDI Port (${input.id})`,
        manufacturer: input.manufacturer || 'Generic',
        state: input.state || 'connected',
        type: input.type || 'input',
      });
    }

    this.connectedDevices = devices;
    if (this.onStateChange) {
      this.onStateChange(devices);
    }
  }

  private attachListeners() {
    if (!this.midiAccess) return;
    const inputs = this.midiAccess.inputs.values();

    for (const input of inputs) {
      // Remove any existing handler
      input.onmidimessage = null;

      // Attach if 'all' or device matches selectedDeviceId
      if (this.selectedDeviceId === 'all' || input.id === this.selectedDeviceId) {
        input.onmidimessage = this.handleMidiMessage;
      }
    }
  }

  private handleMidiMessage = (event: any) => {
    const data = event.data;
    if (!data || data.length < 2) return;

    const statusByte = data[0];
    const command = statusByte >> 4;
    const channel = (statusByte & 0xf) + 1; // 1-16
    const noteNumber = data[1];
    const velocity = data.length > 2 ? data[2] : 0;

    // Note On (command 9, velocity > 0)
    if (command === 9 && velocity > 0) {
      const noteName = midiToNote(noteNumber);
      const normalizedVelocity = velocity / 127;
      this.activeMidiNotes.add(noteName);

      if (this.onNoteOn) {
        this.onNoteOn(noteName, normalizedVelocity, noteNumber, channel);
      }
    }
    // Note Off (command 8, or command 9 with velocity 0)
    else if (command === 8 || (command === 9 && velocity === 0)) {
      const noteName = midiToNote(noteNumber);
      this.activeMidiNotes.delete(noteName);

      if (this.onNoteOff) {
        this.onNoteOff(noteName, noteNumber, channel);
      }
    }
    // Control Change (command 11 = 0xB)
    else if (command === 11) {
      const controller = data[1];
      const value = data[2];
      const normalizedValue = value / 127;

      if (this.onControlChange) {
        this.onControlChange(controller, normalizedValue, channel);
      }
    }
  };

  public disconnect() {
    if (this.midiAccess) {
      const inputs = this.midiAccess.inputs.values();
      for (const input of inputs) {
        input.onmidimessage = null;
      }
    }
    this.activeMidiNotes.clear();
  }
}

export const midiManager = new MidiManager();
