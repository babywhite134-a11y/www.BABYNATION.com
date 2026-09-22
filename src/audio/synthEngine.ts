import { SynthParams, DrumSound } from './types';
import { noteToFreq } from './notes';

class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // FX Nodes
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Active synth voices: noteName -> { osc, subOsc, gain, filter }
  private activeVoices: Map<
    string,
    {
      osc: OscillatorNode;
      subOsc: OscillatorNode;
      filter: BiquadFilterNode;
      gain: GainNode;
      startTime: number;
    }
  > = new Map();

  // Current parameters
  public params: SynthParams = {
    waveform: 'sawtooth',
    attack: 0.02,
    decay: 0.25,
    sustain: 0.5,
    release: 0.4,
    filterCutoff: 3200,
    filterResonance: 3,
    filterType: 'lowpass',
    delayTime: 0.28,
    delayFeedback: 0.35,
    delayWet: 0.25,
    reverbWet: 0.3,
    volume: 0.8,
    subOscVolume: 0.3,
    vinylCrackle: false,
  };

  private vinylSource: AudioBufferSourceNode | null = null;
  private vinylGain: GainNode | null = null;

  public init() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Compressor (limiter + punch)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.params.volume, this.ctx.currentTime);

    // Master Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.82;

    // Media stream destination for live recording
    this.mediaStreamDest = this.ctx.createMediaStreamDestination();

    // Routing: masterGain -> compressor -> analyser -> ctx.destination & mediaStreamDest
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.compressor.connect(this.mediaStreamDest);

    // Create Stereo Delay FX
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.params.delayTime, this.ctx.currentTime);
    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.setValueAtTime(this.params.delayFeedback, this.ctx.currentTime);
    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.setValueAtTime(this.params.delayWet, this.ctx.currentTime);

    // Delay loop: delay -> feedback -> delay
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.masterGain);

    // Algorithmic Reverb
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this.createImpulseResponse(2.2, 2.0);
    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(this.params.reverbWet, this.ctx.currentTime);
    this.convolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterGain);

    // Create 3-second reusable noise buffer
    this.noiseBuffer = this.createNoiseBuffer(3.0);
  }

  public resume() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // --- Effects & Master Controls ---

  public setMasterVolume(vol: number) {
    this.params.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.params.volume, this.ctx.currentTime, 0.02);
    }
  }

  public updateSynthParams(newParams: Partial<SynthParams>) {
    this.params = { ...this.params, ...newParams };
    if (!this.ctx) return;

    if (newParams.delayTime !== undefined && this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(this.params.delayTime, this.ctx.currentTime, 0.05);
    }
    if (newParams.delayFeedback !== undefined && this.delayFeedbackGain) {
      this.delayFeedbackGain.gain.setTargetAtTime(this.params.delayFeedback, this.ctx.currentTime, 0.05);
    }
    if (newParams.delayWet !== undefined && this.delayWetGain) {
      this.delayWetGain.gain.setTargetAtTime(this.params.delayWet, this.ctx.currentTime, 0.05);
    }
    if (newParams.reverbWet !== undefined && this.reverbWetGain) {
      this.reverbWetGain.gain.setTargetAtTime(this.params.reverbWet, this.ctx.currentTime, 0.05);
    }
    if (newParams.vinylCrackle !== undefined) {
      this.toggleVinylCrackle(newParams.vinylCrackle);
    }
  }

  private toggleVinylCrackle(enable: boolean) {
    if (!this.ctx || !this.masterGain) return;
    if (enable) {
      if (this.vinylSource) return;
      const buffer = this.createVinylCrackleBuffer(4.0);
      this.vinylSource = this.ctx.createBufferSource();
      this.vinylSource.buffer = buffer;
      this.vinylSource.loop = true;

      this.vinylGain = this.ctx.createGain();
      this.vinylGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 1.0;

      this.vinylSource.connect(filter);
      filter.connect(this.vinylGain);
      this.vinylGain.connect(this.masterGain);
      this.vinylSource.start();
    } else {
      if (this.vinylSource) {
        try {
          this.vinylSource.stop();
          this.vinylSource.disconnect();
        } catch (_) {}
        this.vinylSource = null;
      }
    }
  }

  // --- Polyphonic Synthesizer ---

  public triggerAttack(note: string, velocity = 0.8, atTime?: number) {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    // Stop existing voice on same note to prevent buildup
    this.triggerRelease(note, atTime);

    const time = atTime ?? this.ctx.currentTime;
    const freq = noteToFreq(note);

    // Main Oscillator
    const osc = this.ctx.createOscillator();
    osc.type = this.params.waveform;
    osc.frequency.setValueAtTime(freq, time);

    // Sub Oscillator (1 octave lower for deep harmonic body)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(freq / 2, time);

    // Filter Node
    const filter = this.ctx.createBiquadFilter();
    filter.type = this.params.filterType || 'lowpass';
    filter.frequency.setValueAtTime(this.params.filterCutoff, time);
    filter.Q.setValueAtTime(this.params.filterResonance, time);

    // Sub Gain
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(this.params.subOscVolume, time);

    // Voice Envelope Gain
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, time);

    // ADSR Envelope
    const attackTime = Math.max(0.005, this.params.attack);
    const decayTime = Math.max(0.01, this.params.decay);
    const sustainLevel = Math.max(0.001, this.params.sustain * velocity);

    // Attack to peak
    voiceGain.gain.linearRampToValueAtTime(velocity, time + attackTime);
    // Decay to sustain
    voiceGain.gain.exponentialRampToValueAtTime(sustainLevel, time + attackTime + decayTime);

    // Filter envelope sweep
    const targetCutoff = Math.min(20000, this.params.filterCutoff * (1 + velocity * 1.5));
    filter.frequency.setValueAtTime(this.params.filterCutoff * 0.5, time);
    filter.frequency.exponentialRampToValueAtTime(targetCutoff, time + attackTime);
    filter.frequency.exponentialRampToValueAtTime(this.params.filterCutoff, time + attackTime + decayTime);

    // Connect Main Osc -> Filter
    osc.connect(filter);
    // Sub Osc -> subGain -> Filter
    subOsc.connect(subGain);
    subGain.connect(filter);

    // Filter -> Voice Gain
    filter.connect(voiceGain);

    // Voice Gain -> Master, Delay, Reverb
    voiceGain.connect(this.masterGain);
    if (this.delayNode) voiceGain.connect(this.delayNode);
    if (this.convolver) voiceGain.connect(this.convolver);

    osc.start(time);
    subOsc.start(time);

    this.activeVoices.set(note, {
      osc,
      subOsc,
      filter,
      gain: voiceGain,
      startTime: time,
    });
  }

  public triggerRelease(note: string, atTime?: number) {
    if (!this.ctx) return;
    const voice = this.activeVoices.get(note);
    if (!voice) return;

    const time = atTime ?? this.ctx.currentTime;
    const releaseTime = Math.max(0.04, this.params.release);

    try {
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, time);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, time + releaseTime);

      voice.osc.stop(time + releaseTime + 0.05);
      voice.subOsc.stop(time + releaseTime + 0.05);

      setTimeout(() => {
        voice.osc.disconnect();
        voice.subOsc.disconnect();
        voice.filter.disconnect();
        voice.gain.disconnect();
      }, (releaseTime + 0.1) * 1000);
    } catch (_) {}

    this.activeVoices.delete(note);
  }

  public playChord(notes: string[], duration = 1.2, velocity = 0.7, atTime?: number) {
    const time = atTime ?? (this.ctx ? this.ctx.currentTime : 0);
    notes.forEach((note) => {
      this.triggerAttack(note, velocity, time);
      this.triggerRelease(note, time + duration);
    });
  }

  // --- Drum Voice Synthesis ---

  public playDrum(type: DrumSound, velocity = 0.9, atTime?: number) {
    this.resume();
    if (!this.ctx || !this.masterGain) return;
    const time = atTime ?? this.ctx.currentTime;

    switch (type) {
      case 'kick':
        this.synthesizeKick(time, velocity);
        break;
      case 'snare':
        this.synthesizeSnare(time, velocity);
        break;
      case 'hihat':
        this.synthesizeHiHat(time, velocity);
        break;
      case 'clap':
        this.synthesizeClap(time, velocity);
        break;
      case 'perc':
        this.synthesizePerc(time, velocity);
        break;
      case 'bass808':
        this.synthesize808(time, velocity);
        break;
    }
  }

  private synthesizeKick(time: number, velocity: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Pitch envelope: drops fast from 160Hz to 38Hz
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

    // Punch envelope
    gain.gain.setValueAtTime(velocity * 1.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    // Click transient (adds high-end punch)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.frequency.setValueAtTime(450, time);
    clickGain.gain.setValueAtTime(velocity * 0.5, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    clickOsc.start(time);
    osc.stop(time + 0.4);
    clickOsc.stop(time + 0.03);
  }

  private synthesizeSnare(time: number, velocity: number) {
    if (!this.ctx || !this.masterGain) return;

    // Body tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.1);
    oscGain.gain.setValueAtTime(velocity * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    // White noise snap
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.85, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    if (this.convolver) noiseGain.connect(this.convolver);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(time);
    noiseSource.start(time);
    osc.stop(time + 0.18);
    noiseSource.stop(time + 0.25);
  }

  private synthesizeHiHat(time: number, velocity: number) {
    if (!this.ctx || !this.masterGain) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.08);
  }

  private synthesizeClap(time: number, velocity: number) {
    if (!this.ctx || !this.masterGain) return;

    // Staggered burst clap
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.Q.setValueAtTime(2.0, time);

    const gain = this.ctx.createGain();
    gain.connect(this.masterGain);
    if (this.convolver) gain.connect(this.convolver);
    filter.connect(gain);

    const bursts = [0, 0.012, 0.024];
    bursts.forEach((offset) => {
      if (!this.ctx) return;
      const burst = this.ctx.createBufferSource();
      burst.buffer = this.noiseBuffer;
      const burstGain = this.ctx.createGain();
      burstGain.gain.setValueAtTime(velocity * 0.6, time + offset);
      burstGain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.018);

      burst.connect(burstGain);
      burstGain.connect(filter);
      burst.start(time + offset);
      burst.stop(time + offset + 0.03);
    });

    // Main decay tail
    const tail = this.ctx.createBufferSource();
    tail.buffer = this.noiseBuffer;
    const tailGain = this.ctx.createGain();
    tailGain.gain.setValueAtTime(velocity * 0.7, time + 0.036);
    tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

    tail.connect(tailGain);
    tailGain.connect(filter);
    tail.start(time + 0.036);
    tail.stop(time + 0.26);
  }

  private synthesizePerc(time: number, velocity: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, time);
    osc.frequency.exponentialRampToValueAtTime(280, time + 0.06);

    gain.gain.setValueAtTime(velocity * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.1);
  }

  private synthesize808(time: number, velocity: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Starting pitch with subtle pitch glide
    osc.frequency.setValueAtTime(55, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    // Warm sub-bass saturation curve
    gain.gain.setValueAtTime(velocity * 1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.6);
  }

  // --- Buffer Generators ---

  private createNoiseBuffer(seconds: number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createVinylCrackleBuffer(seconds: number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Sporadic dust clicks
      if (Math.random() < 0.0006) {
        data[i] = (Math.random() * 2 - 1) * 0.8;
      } else {
        data[i] = (Math.random() * 2 - 1) * 0.015;
      }
    }
    return buffer;
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const decayFactor = Math.pow(1 - n, decay);
      left[i] = (Math.random() * 2 - 1) * decayFactor;
      right[i] = (Math.random() * 2 - 1) * decayFactor;
    }
    return impulse;
  }

  // --- Live Recording ---

  public startRecording() {
    this.resume();
    if (!this.mediaStreamDest) return;
    this.recordedChunks = [];

    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    let selectedMime: string | undefined = undefined;
    for (const mime of mimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    try {
      this.mediaRecorder = selectedMime
        ? new MediaRecorder(this.mediaStreamDest.stream, { mimeType: selectedMime })
        : new MediaRecorder(this.mediaStreamDest.stream);
    } catch (_) {
      this.mediaRecorder = new MediaRecorder(this.mediaStreamDest.stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    // Collect chunks every 100ms
    this.mediaRecorder.start(100);
  }

  public stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const mime = this.mediaRecorder?.mimeType || 'audio/webm';
        resolve(new Blob(this.recordedChunks, { type: mime }));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mime });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public async decodeRecordedBlob(blob: Blob): Promise<AudioBuffer> {
    if (!this.ctx) {
      this.init();
    }
    const arrayBuffer = await blob.arrayBuffer();
    return await this.ctx!.decodeAudioData(arrayBuffer);
  }
}

export const synthEngine = new SynthEngine();
