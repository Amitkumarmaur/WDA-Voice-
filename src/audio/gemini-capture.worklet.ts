/**
 * PCM capture at the audio rendering quantum rate (128 frames typical).
 * Sends Int16 mono buffers to the main thread for Gemini Live upload.
 */
class GeminiCaptureProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]) {
    const input = inputs[0];
    if (!input?.length) return true;
    const channelData = input[0];
    const n = channelData.length;
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]!));
      pcm[i] = (s < 0 ? s * 0x8000 : s * 0x7fff) | 0;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor('gemini-capture', GeminiCaptureProcessor);
