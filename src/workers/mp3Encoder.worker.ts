/**
 * Web Worker for MP3 encoding via lamejs.
 * Receives Float32Array PCM data, returns MP3 ArrayBuffer.
 */
import lamejs from "lamejs";

self.onmessage = (e: MessageEvent<{ left: Float32Array; right: Float32Array; sampleRate: number }>) => {
  const { left, right, sampleRate } = e.data;

  try {
    const mp3encoder = new lamejs.Mp3Encoder(2, sampleRate, 128);
    const sampleBlockSize = 1152;
    const mp3Data: Int8Array[] = [];

    const maxSamples = Math.max(left.length, right.length);

    for (let i = 0; i < maxSamples; i += sampleBlockSize) {
      const end = Math.min(i + sampleBlockSize, maxSamples);
      const len = end - i;

      const leftChunk = i < left.length ? left.subarray(i, Math.min(end, left.length)) : new Float32Array(len);
      const rightChunk = i < right.length ? right.subarray(i, Math.min(end, right.length)) : new Float32Array(len);

      // Pad if one channel is shorter
      const leftPadded = leftChunk.length >= len ? leftChunk : new Float32Array(len);
      const rightPadded = rightChunk.length >= len ? rightChunk : new Float32Array(len);
      if (leftChunk.length < len) leftPadded.set(leftChunk);
      if (rightChunk.length < len) rightPadded.set(rightChunk);

      const leftInt16 = floatTo16BitPCM(leftPadded);
      const rightInt16 = floatTo16BitPCM(rightPadded);

      const mp3buf = mp3encoder.encodeBuffer(leftInt16, rightInt16);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const flush = mp3encoder.flush();
    if (flush.length > 0) {
      mp3Data.push(flush);
    }

    const totalLength = mp3Data.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of mp3Data) {
      result.set(arr, offset);
      offset += arr.length;
    }

    self.postMessage({ mp3Buffer: result.buffer });
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
