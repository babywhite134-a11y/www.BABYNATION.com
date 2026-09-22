// Note frequency conversion utilities

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteToFreq(note: string): number {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 440;

  const pitch = match[1];
  const octave = parseInt(match[2], 10);
  const noteIndex = NOTE_NAMES.indexOf(pitch);
  if (noteIndex === -1) return 440;

  // MIDI number calculation: A4 = noteIndex 9, octave 4 = MIDI 69 = 440Hz
  const midi = (octave + 1) * 12 + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNote(midi: number): string {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export interface KeyInfo {
  note: string;
  isBlack: boolean;
  keyChar?: string;
  midi: number;
}

// 2-octave piano keyboard (C3 to B4)
export const KEYBOARD_KEYS: KeyInfo[] = [
  { note: 'C3', isBlack: false, keyChar: 'Z', midi: 48 },
  { note: 'C#3', isBlack: true, keyChar: 'S', midi: 49 },
  { note: 'D3', isBlack: false, keyChar: 'X', midi: 50 },
  { note: 'D#3', isBlack: true, keyChar: 'D', midi: 51 },
  { note: 'E3', isBlack: false, keyChar: 'C', midi: 52 },
  { note: 'F3', isBlack: false, keyChar: 'V', midi: 53 },
  { note: 'F#3', isBlack: true, keyChar: 'G', midi: 54 },
  { note: 'G3', isBlack: false, keyChar: 'B', midi: 55 },
  { note: 'G#3', isBlack: true, keyChar: 'H', midi: 56 },
  { note: 'A3', isBlack: false, keyChar: 'N', midi: 57 },
  { note: 'A#3', isBlack: true, keyChar: 'J', midi: 58 },
  { note: 'B3', isBlack: false, keyChar: 'M', midi: 59 },
  { note: 'C4', isBlack: false, keyChar: 'Q', midi: 60 },
  { note: 'C#4', isBlack: true, keyChar: '2', midi: 61 },
  { note: 'D4', isBlack: false, keyChar: 'W', midi: 62 },
  { note: 'D#4', isBlack: true, keyChar: '3', midi: 63 },
  { note: 'E4', isBlack: false, keyChar: 'E', midi: 64 },
  { note: 'F4', isBlack: false, keyChar: 'R', midi: 65 },
  { note: 'F#4', isBlack: true, keyChar: '5', midi: 66 },
  { note: 'G4', isBlack: false, keyChar: 'T', midi: 67 },
  { note: 'G#4', isBlack: true, keyChar: '6', midi: 68 },
  { note: 'A4', isBlack: false, keyChar: 'Y', midi: 69 },
  { note: 'A#4', isBlack: true, keyChar: '7', midi: 70 },
  { note: 'B4', isBlack: false, keyChar: 'U', midi: 71 },
  { note: 'C5', isBlack: false, keyChar: 'I', midi: 72 },
];
