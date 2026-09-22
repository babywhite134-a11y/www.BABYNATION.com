import * as lamejs from 'lamejs';

/**
 * Decodes a recorded audio blob into an AudioBuffer using the AudioContext.
 */
export async function blobToAudioBuffer(blob: Blob, ctx: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  // Use decodeAudioData promise syntax
  return await ctx.decodeAudioData(arrayBuffer);
}

/**
 * Encodes an AudioBuffer into an uncompressed 16-bit Stereo PCM WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;
  const numSamples = leftChannel.length;
  const dataByteLength = numSamples * blockAlign;
  const wavHeaderLength = 44;
  const totalLength = wavHeaderLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII string to DataView
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // 1. RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // ChunkSize
  writeString(8, 'WAVE');

  // 2. "fmt " Sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // 3. "data" Sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true); // Subchunk2Size

  // Write interleaved 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Left sample
    let sampleL = Math.max(-1, Math.min(1, leftChannel[i]));
    let intSampleL = sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff;
    view.setInt16(offset, intSampleL, true);
    offset += 2;

    // Right sample (if mono, duplicate left)
    if (numChannels > 1) {
      let sampleR = Math.max(-1, Math.min(1, rightChannel[i]));
      let intSampleR = sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff;
      view.setInt16(offset, intSampleR, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Encodes an AudioBuffer into an MP3 Blob using lamejs at the specified bitrate.
 */
export function audioBufferToMp3(buffer: AudioBuffer, kbps = 192): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;

  // lamejs can be imported either as default or namespace depending on bundler
  const Mp3Encoder = (lamejs as any).Mp3Encoder || (lamejs as any).default?.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error('MP3 Encoder could not be initialized');
  }

  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: BlobPart[] = [];

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;
  const numSamples = leftChannel.length;

  // Convert Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
  const leftInt16 = new Int16Array(numSamples);
  const rightInt16 = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const sL = Math.max(-1, Math.min(1, leftChannel[i]));
    leftInt16[i] = sL < 0 ? sL * 0x8000 : sL * 0x7fff;

    const sR = Math.max(-1, Math.min(1, rightChannel[i]));
    rightInt16[i] = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
  }

  // Encode in chunks (1152 samples is standard MP3 frame size)
  const sampleBlockSize = 1152;
  for (let i = 0; i < numSamples; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    const rightChunk = numChannels > 1 ? rightInt16.subarray(i, i + sampleBlockSize) : leftChunk;
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.length));
    }
  }

  // Flush remaining buffer
  const mp3buf = encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.length));
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/**
 * Triggers a client-side file download for the given Blob.
 */
export function downloadAudioBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
