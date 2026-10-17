// Classic script shared by the offscreen page and unit tests.
globalThis.HidariAudio = {
  encodeWav(samples, sampleRate = 16000) {
    const bytes = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(bytes);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const value = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    }
    return new Blob([bytes], {type: 'audio/wav'});
  },
  async prepare(blob, context) {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const renderer = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = renderer.createBufferSource(); source.buffer = decoded;
    source.connect(renderer.destination); source.start();
    const mono = (await renderer.startRendering()).getChannelData(0);
    // Skip essentially silent chunks. This is an energy gate, not speech detection.
    const rms = Math.sqrt(mono.reduce((sum, value) => sum + value * value, 0) / mono.length);
    return rms < 0.0005 ? null : this.encodeWav(mono);
  }
};
