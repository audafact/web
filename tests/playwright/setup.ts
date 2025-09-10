// Test setup for Playwright component tests
import { beforeAll } from "@playwright/experimental-ct-react";

// Mock global objects that might be needed
beforeAll(async () => {
  // Mock AudioContext if needed
  if (typeof window !== "undefined" && !window.AudioContext) {
    (window as any).AudioContext = class MockAudioContext {
      currentTime = 0;
      createBufferSource() {
        return {
          buffer: null,
          playbackRate: { value: 1 },
          loop: false,
          loopStart: 0,
          loopEnd: 0,
          start: () => {},
          stop: () => {},
          connect: () => {},
          disconnect: () => {},
          onended: null,
        };
      }
      createGain() {
        return {
          gain: { value: 1 },
          connect: () => {},
          disconnect: () => {},
        };
      }
      createBiquadFilter() {
        return {
          type: "lowpass",
          frequency: { value: 20000, setValueAtTime: () => {} },
          Q: { value: 1 },
          connect: () => {},
          disconnect: () => {},
        };
      }
      destination = {};
      getOutputTimestamp() {
        return { contextTime: 0 };
      }
    };
  }
});
