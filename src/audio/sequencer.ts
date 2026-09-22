import { synthEngine } from './synthEngine';
import { DrumTrack, ChordDefinition } from './types';

export class Sequencer {
  private isPlaying = false;
  private bpm = 84;
  private swing = 0.15; // 0 to 0.5
  private currentStep = 0;
  private nextStepTime = 0;
  private timerId: number | null = null;
  private lookaheadMs = 25;
  private scheduleAheadSec = 0.1;

  // Pattern data
  public drumTracks: DrumTrack[] = [];
  public chords: ChordDefinition[] = [];
  public chordProgressionEnabled = true;
  public arpeggiatorMode: 'off' | 'up' | 'down' | 'updown' | 'random' = 'off';
  public arpRate: 1 | 2 | 4 = 2; // 1 = 8th note, 2 = 16th note, 4 = 32nd note

  // UI Callback
  public onStepChange?: (step: number) => void;

  constructor() {
    this.initDefaultTracks();
  }

  private initDefaultTracks() {
    this.drumTracks = [
      {
        id: 'kick',
        name: 'Kick 909',
        color: '#f59e0b', // amber
        volume: 0.9,
        muted: false,
        soloed: false,
        steps: [true, false, false, false, false, false, false, true, false, true, false, false, false, false, true, false],
      },
      {
        id: 'snare',
        name: 'Snare Snappy',
        color: '#ec4899', // pink
        volume: 0.85,
        muted: false,
        soloed: false,
        steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      },
      {
        id: 'hihat',
        name: 'Hi-Hat 808',
        color: '#06b6d4', // cyan
        volume: 0.75,
        muted: false,
        soloed: false,
        steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true],
      },
      {
        id: 'clap',
        name: 'Stereo Clap',
        color: '#8b5cf6', // purple
        volume: 0.8,
        muted: false,
        soloed: false,
        steps: [false, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false],
      },
      {
        id: 'perc',
        name: 'Rim / Perc',
        color: '#10b981', // emerald
        volume: 0.7,
        muted: false,
        soloed: false,
        steps: [false, false, true, false, false, false, true, false, false, true, false, false, false, false, false, false],
      },
      {
        id: 'bass808',
        name: '808 Sub',
        color: '#f97316', // orange
        volume: 0.9,
        muted: false,
        soloed: false,
        steps: [true, false, false, false, false, false, false, true, false, false, true, false, false, false, false, false],
      },
    ];
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(50, Math.min(200, Math.round(newBpm)));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setSwing(newSwing: number) {
    this.swing = Math.max(0, Math.min(0.5, newSwing));
  }

  public getSwing(): number {
    return this.swing;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public start() {
    synthEngine.resume();
    const ctx = synthEngine.getContext();
    if (!ctx) return;

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = ctx.currentTime + 0.05;

    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.currentStep = 0;
    if (this.onStepChange) {
      this.onStepChange(0);
    }
  }

  public toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  private scheduler = () => {
    const ctx = synthEngine.getContext();
    if (!ctx || !this.isPlaying) return;

    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    this.timerId = window.setTimeout(this.scheduler, this.lookaheadMs);
  };

  private advanceStep() {
    // 16th note step base duration
    const secondsPerBeat = 60.0 / this.bpm;
    const baseStepDuration = 0.25 * secondsPerBeat;

    // Swing logic: delay odd sixteenth notes
    const isOddStep = this.currentStep % 2 === 1;
    const swingOffset = isOddStep ? this.swing * baseStepDuration : -this.swing * baseStepDuration * 0.5;

    this.nextStepTime += Math.max(0.01, baseStepDuration + swingOffset);
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    const hasSolo = this.drumTracks.some((t) => t.soloed);

    // Play active drum voices
    this.drumTracks.forEach((track) => {
      if (track.muted) return;
      if (hasSolo && !track.soloed) return;

      if (track.steps[step]) {
        // Accent downbeats slightly
        const velocity = (step % 4 === 0 ? 1.0 : 0.85) * track.volume;
        synthEngine.playDrum(track.id, velocity, time);
      }
    });

    // Chord Progression Scheduling
    // 4 bars / 16 steps: step 0 -> chord 0, step 4 -> chord 1, step 8 -> chord 2, step 12 -> chord 3
    if (this.chordProgressionEnabled && this.chords.length > 0) {
      const chordIndex = Math.floor(step / 4) % this.chords.length;
      const chord = this.chords[chordIndex];

      if (chord && chord.notes.length > 0) {
        if (this.arpeggiatorMode === 'off') {
          // Play full sustained chord on beats 0, 4, 8, 12
          if (step % 4 === 0) {
            const chordDuration = (60.0 / this.bpm) * 0.95;
            synthEngine.playChord(chord.notes, chordDuration, 0.65, time);
          }
        } else {
          // Arpeggiate chord notes on each step
          const noteIndex = this.getArpNoteIndex(step, chord.notes.length);
          const note = chord.notes[noteIndex];
          if (note) {
            const noteDuration = (60.0 / this.bpm) * 0.22;
            synthEngine.triggerAttack(note, 0.6, time);
            synthEngine.triggerRelease(note, time + noteDuration);
          }
        }
      }
    }

    // Schedule UI update on main thread
    const ctx = synthEngine.getContext();
    if (ctx && this.onStepChange) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (this.isPlaying && this.onStepChange) {
          this.onStepChange(step);
        }
      }, delayMs);
    }
  }

  private getArpNoteIndex(step: number, totalNotes: number): number {
    if (totalNotes <= 0) return 0;
    switch (this.arpeggiatorMode) {
      case 'up':
        return step % totalNotes;
      case 'down':
        return (totalNotes - 1 - (step % totalNotes)) % totalNotes;
      case 'updown': {
        const cycle = (totalNotes - 1) * 2;
        const pos = step % (cycle > 0 ? cycle : 1);
        return pos < totalNotes ? pos : cycle - pos;
      }
      case 'random':
        return Math.floor(Math.random() * totalNotes);
      default:
        return 0;
    }
  }

  public loadPresetDrums(drums: Record<string, number[]>) {
    this.drumTracks = this.drumTracks.map((track) => {
      if (drums[track.id]) {
        return {
          ...track,
          steps: drums[track.id].map((v) => Boolean(v)),
        };
      }
      return track;
    });
  }
}

export const sequencer = new Sequencer();
