/**
 * Audio export utilities: stereo WAV, MP3 encoding, and reliable download.
 */

/**
 * Ensure AudioBuffer is stereo (2 channels) for DAW compatibility.
 * If mono, duplicates the channel to create stereo.
 */
export function ensureStereo(audioBuffer: AudioBuffer): AudioBuffer {
  if (audioBuffer.numberOfChannels === 2) return audioBuffer;

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
    sampleRate: audioBuffer.sampleRate,
  });
  const stereoBuffer = ctx.createBuffer(2, audioBuffer.length, audioBuffer.sampleRate);
  const mono = audioBuffer.getChannelData(0);
  stereoBuffer.copyToChannel(mono, 0);
  stereoBuffer.copyToChannel(mono, 1);
  return stereoBuffer;
}

/**
 * Convert AudioBuffer to WAV format (16-bit PCM, stereo).
 */
export function convertToWav(audioBuffer: AudioBuffer): Blob | null {
  try {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;

    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  } catch (error) {
    console.error("Error converting to WAV:", error);
    return null;
  }
}

/**
 * Convert audio blob (WAV or other decodable format) to MP3 using lamejs.
 */
export async function convertToMp3(audioBlob: Blob): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : left;

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/mp3Encoder.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.postMessage({
      left: left,
      right: right,
      sampleRate,
    });

    worker.onmessage = (e: MessageEvent<{ mp3Buffer?: ArrayBuffer; error?: string }>) => {
      worker.terminate();
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else if (e.data.mp3Buffer) {
        resolve(new Blob([e.data.mp3Buffer], { type: "audio/mpeg" }));
      } else {
        reject(new Error("MP3 encoding failed"));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
  });
}

/**
 * Trigger a download of a blob with the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  requestAnimationFrame(() => {
    link.click();
    requestAnimationFrame(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  });
}
