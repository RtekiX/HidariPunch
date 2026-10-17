globalThis.HidariConfig = {
  normalize(settings = {}) {
    const port = Number(settings.localPort ?? 8080);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('本地端口必须为 1024–65535 的整数');
    return {
      pipeline: 'local-deepseek', localPort: port,
      translate: settings.translate === true,
      model: settings.pipeline === 'local-deepseek' ? (settings.model?.trim() || 'deepseek-flash') : 'deepseek-flash',
      seconds: [3, 5, 8].includes(Number(settings.seconds)) ? Number(settings.seconds) : 5
    };
  },
  localURL(settings, path) { return `http://127.0.0.1:${this.normalize(settings).localPort}/${path}`; }
};
