import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google GenAI if key is present
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Route: Generate bespoke musical groove & chord pattern with Gemini
app.post('/api/ai/groove', async (req: Request, res: Response) => {
  try {
    const { prompt, genre, currentBpm } = req.body;

    if (!ai) {
      // Return a smart curated response if API key is not ready yet
      return res.json({
        name: prompt ? `${prompt} Groove` : 'Cyber Chillout',
        genre: genre || 'Lo-Fi Chill',
        bpm: currentBpm || 85,
        scale: 'D minor',
        chords: ['Dm9', 'Gm7', 'Bbmaj7', 'C7'],
        chordsNotes: [
          ['D4', 'F4', 'A4', 'C5', 'E5'],
          ['G3', 'Bb3', 'D4', 'F4'],
          ['Bb3', 'D4', 'F4', 'A4'],
          ['C4', 'E4', 'G4', 'Bb4'],
        ],
        drums: {
          kick: [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
          snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
          clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          perc: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
          bass808: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        },
        synth: {
          waveform: 'sine',
          attack: 0.04,
          decay: 0.35,
          sustain: 0.6,
          release: 0.5,
          filterCutoff: 1400,
          resonance: 2.5,
          delayTime: 0.3,
          delayFeedback: 0.35,
        },
        producerNote: 'Mellow laid-back boom-bap rhythm with neo-soul 9th chords. Great for late night focus.',
      });
    }

    const systemPrompt = `You are a world-class electronic music producer, sound designer, and beat architect.
Given a mood or prompt, generate a complete 16-step musical blueprint including drums, chord progression (with exact note pitches for each chord), tempo BPM, synth sound design parameters, and producer notes.
Output MUST be valid JSON adhering strictly to the schema.`;

    const userMessage = `Create an incredible musical groove for: "${prompt || genre || 'dreamy late night electronic vibe'}".
Keep tempo appropriate for the genre (typically between 70 and 130 BPM).
Generate exact 16-step binary arrays (values 0 or 1, exactly 16 items) for: kick, snare, hihat, clap, perc, and bass808.
Provide 4 lush chords with valid musical note names in standard scientific pitch notation (e.g. ["C4", "Eb4", "G4", "Bb4"]).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            genre: { type: Type.STRING },
            bpm: { type: Type.NUMBER },
            scale: { type: Type.STRING },
            chords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Names of the 4 chords, e.g. ["Fmaj7", "Em7", "Dm7", "Cmaj7"]',
            },
            chordsNotes: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of notes in pitch notation, e.g. ["F3", "A3", "C4", "E4"]',
              },
            },
            drums: {
              type: Type.OBJECT,
              properties: {
                kick: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                snare: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                hihat: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                clap: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                perc: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                bass808: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              },
              required: ['kick', 'snare', 'hihat', 'clap', 'perc', 'bass808'],
            },
            synth: {
              type: Type.OBJECT,
              properties: {
                waveform: { type: Type.STRING, description: 'sine, triangle, sawtooth, or square' },
                attack: { type: Type.NUMBER },
                decay: { type: Type.NUMBER },
                sustain: { type: Type.NUMBER },
                release: { type: Type.NUMBER },
                filterCutoff: { type: Type.NUMBER },
                resonance: { type: Type.NUMBER },
                delayTime: { type: Type.NUMBER },
                delayFeedback: { type: Type.NUMBER },
              },
              required: ['waveform', 'attack', 'decay', 'sustain', 'release', 'filterCutoff', 'resonance'],
            },
            producerNote: { type: Type.STRING },
          },
          required: ['name', 'genre', 'bpm', 'scale', 'chords', 'chordsNotes', 'drums', 'synth', 'producerNote'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Groove generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate groove' });
  }
});

// API Route: Song Lyrics & Arrangement Assistant
app.post('/api/ai/lyrics', async (req: Request, res: Response) => {
  try {
    const { topic, genre, mood } = req.body;

    if (!ai) {
      return res.json({
        title: 'Neon Skyline',
        vibe: 'Reflective & Atmospheric',
        sections: [
          {
            part: 'Verse 1',
            chords: 'Dm9 · Gm7',
            lines: [
              'Streetlights bleed into the windshield pane',
              'Chasing the rhythm through the midnight rain',
              'Synthesizers hum a quiet tune',
              'Underneath the amber of an autumn moon',
            ],
          },
          {
            part: 'Chorus',
            chords: 'Bbmaj7 · C7 · Dm9',
            lines: [
              'Music me tonight, let the frequency rise',
              'Electric pulses in the city skies',
              'Lost in the echo, found in the groove',
              'When the world slows down and the speakers move',
            ],
          },
          {
            part: 'Verse 2',
            chords: 'Dm9 · Gm7',
            lines: [
              'Analog warmth in a digital room',
              'Bassline kicks and clears the gloom',
              'One single note and the shadows fade',
              'In every melody that we have made',
            ],
          },
          {
            part: 'Outro',
            chords: 'Bbmaj7 · Dm9',
            lines: [
              'Fade into the tape loop...',
              'Echo in the night...',
              'Just music me.',
            ],
          },
        ],
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Write evocative song lyrics and arrangement notes for a track with theme: "${topic || 'late night music vibes'}", Genre: "${genre || 'Electronic / Lo-fi'}", Mood: "${mood || 'Dreamy'}".
Include Verse 1, Chorus, Verse 2, and Outro. Mention recommended chord pairings for each section.`,
      config: {
        systemInstruction: 'You are an acclaimed lyricist and music producer. Produce inspiring, poetic, rhythmically sharp song lyrics.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            vibe: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  part: { type: Type.STRING },
                  chords: { type: Type.STRING },
                  lines: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['part', 'chords', 'lines'],
              },
            },
          },
          required: ['title', 'vibe', 'sections'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Lyrics generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate lyrics' });
  }
});

// Vite integration for full-stack dev server
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🎵 Aura Music Studio running at http://0.0.0.0:${port}`);
  });
}

startServer();
