import React, { useState } from 'react';
import { Sparkles, Music, Mic, Wand2, ArrowRight, Check, Copy, Loader2 } from 'lucide-react';
import { MusicPreset, DrumSound } from '../audio/types';

interface AiSongwriterModalProps {
  currentBpm: number;
  onApplyGroove: (groove: {
    name: string;
    genre: string;
    bpm: number;
    scale: string;
    chords: { name: string; notes: string[] }[];
    drums: Record<DrumSound, number[]>;
    synth: any;
    producerNote?: string;
  }) => void;
}

export const AiSongwriterModal: React.FC<AiSongwriterModalProps> = ({
  currentBpm,
  onApplyGroove,
}) => {
  const [activeMode, setActiveMode] = useState<'groove' | 'lyrics'>('groove');
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generated results
  const [generatedGroove, setGeneratedGroove] = useState<any | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Quick suggestion chips
  const suggestions = [
    'Late night coffee shop lo-fi with mellow Rhodes chords',
    'French touch nu-disco with pumping kick and funk bass',
    'Futuristic Tokyo cyberpunk synthwave 130 BPM',
    'Sunny Lagos afrobeat with syncopated log drums',
    'Chill indie bedroom pop with dreamy chorus guitar vibes',
    'Deep ambient drone for meditation and deep sleep',
  ];

  const handleGenerateGroove = async (textToUse?: string) => {
    const text = textToUse || promptInput || 'Lo-fi chill neo-soul groove';
    setLoading(true);
    setErrorMsg(null);
    setGeneratedGroove(null);

    try {
      const res = await fetch('/api/ai/groove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          currentBpm,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setGeneratedGroove(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to generate groove with AI. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLyrics = async () => {
    setLoading(true);
    setErrorMsg(null);
    setGeneratedLyrics(null);

    try {
      const res = await fetch('/api/ai/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: promptInput || 'Music me tonight through city lights',
          genre: 'Electronic / Melodic',
          mood: 'Atmospheric & Uplifting',
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setGeneratedLyrics(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to generate lyrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedGroove) return;

    // Structure chords into ChordDefinition array
    const chordDefs = (generatedGroove.chords || []).map((name: string, i: number) => ({
      name,
      notes: generatedGroove.chordsNotes?.[i] || ['C4', 'E4', 'G4'],
    }));

    onApplyGroove({
      name: generatedGroove.name || 'AI Bespoke Jam',
      genre: generatedGroove.genre || 'AI Electronic',
      bpm: generatedGroove.bpm || 95,
      scale: generatedGroove.scale || 'Minor',
      chords: chordDefs,
      drums: generatedGroove.drums,
      synth: generatedGroove.synth,
      producerNote: generatedGroove.producerNote,
    });
  };

  const handleCopyLyrics = () => {
    if (!generatedLyrics) return;
    const text = generatedLyrics.sections
      .map((s: any) => `[${s.part} - ${s.chords}]\n${s.lines.join('\n')}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm flex flex-col gap-5">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white">Gemini Music Copilot</h2>
            <p className="text-xs text-neutral-400">Compose custom beats, lush progressions, and lyrics</p>
          </div>
        </div>

        {/* Segmented control for mode */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
          <button
            onClick={() => setActiveMode('groove')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'groove'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-amber-400" />
            Groove & Synth
          </button>
          <button
            onClick={() => setActiveMode('lyrics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'lyrics'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            Song Lyrics
          </button>
        </div>
      </div>

      {/* Input Form */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium text-neutral-300">
          {activeMode === 'groove'
            ? 'Describe the musical vibe or groove you want:'
            : 'What is your song about?'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                activeMode === 'groove' ? handleGenerateGroove() : handleGenerateLyrics();
              }
            }}
            placeholder={
              activeMode === 'groove'
                ? 'e.g. Atmospheric 80s synthwave with punchy bass and gated snare'
                : 'e.g. Finding peace in late night city drives and quiet melodies'
            }
            className="flex-1 px-4 py-2.5 rounded-lg bg-neutral-950 border border-neutral-700/80 text-neutral-100 placeholder:text-neutral-600 text-sm focus:outline-hidden focus:border-amber-400"
          />
          <button
            onClick={() => (activeMode === 'groove' ? handleGenerateGroove() : handleGenerateLyrics())}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.25)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Composing...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>

        {/* Suggestion tags */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-neutral-500 text-[11px] shrink-0">Try:</span>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPromptInput(s);
                if (activeMode === 'groove') handleGenerateGroove(s);
              }}
              className="px-2.5 py-1 rounded-md bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-neutral-700 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Groove Output Card */}
      {activeMode === 'groove' && generatedGroove && (
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-amber-500/30 flex flex-col gap-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-white">{generatedGroove.name}</h3>
                <span className="text-xs text-amber-400">({generatedGroove.genre})</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 italic">{generatedGroove.producerNote}</p>
            </div>

            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_18px_rgba(245,158,11,0.35)] cursor-pointer"
            >
              <span>Load Into Studio & Play</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 block uppercase">Tempo</span>
              <span className="font-mono text-base font-bold text-amber-300">{generatedGroove.bpm} BPM</span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 block uppercase">Scale</span>
              <span className="font-mono text-base font-bold text-neutral-200">{generatedGroove.scale}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 col-span-2">
              <span className="text-[10px] text-neutral-500 block uppercase">Chord Progression</span>
              <span className="font-mono text-sm font-semibold text-amber-200">
                {(generatedGroove.chords || []).join(' · ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics Output Card */}
      {activeMode === 'lyrics' && generatedLyrics && (
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-white">{generatedLyrics.title}</h3>
              <span className="text-xs text-amber-400">{generatedLyrics.vibe}</span>
            </div>
            <button
              onClick={handleCopyLyrics}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Lyrics'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {generatedLyrics.sections.map((sec: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                  <span className="font-semibold text-amber-400">{sec.part}</span>
                  <span className="font-mono text-[10px] text-neutral-400">{sec.chords}</span>
                </div>
                <div className="text-xs text-neutral-300 leading-relaxed font-sans space-y-0.5">
                  {sec.lines.map((line: string, lIdx: number) => (
                    <p key={lIdx}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
