/**
 * Extract downsampled peaks from AudioBuffer for WaveSurfer.
 * Skips WaveSurfer's decode step when passed to useWavesurfer - faster load.
 */
const DEFAULT_PEAK_LENGTH = 6000;

export function extractPeaksFromBuffer(
  buffer: AudioBuffer,
  length: number = DEFAULT_PEAK_LENGTH
): number[][] {
  const channels: number[][] = [];
  const numChannels = buffer.numberOfChannels;
  const totalSamples = buffer.length * numChannels;

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    const step = Math.floor(channelData.length / length);
    const peaks: number[] = [];

    for (let i = 0; i < length; i++) {
      let max = 0;
      const start = Math.min(i * step, channelData.length - 1);
      const end = Math.min(start + step, channelData.length);

      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }

    // Normalize to 0-1 (WaveSurfer accepts and will normalize if needed)
    const peakMax = Math.max(...peaks, 1e-7);
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] = peaks[i] / peakMax;
    }
    channels.push(peaks);
  }

  return channels;
}
