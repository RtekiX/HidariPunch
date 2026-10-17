const standard = {
  tiny:'bd577a113a864445d4c299885e0cb97d4ba92b5f',
  base:'465707469ff3a37a2b9b8d8f89f2f99de7299dac',
  small:'55356645c2b361a969dfd0ef2c5a50d530afd8d5',
  medium:'fd9727b6e1217c2f614f9b698455c4ffd82463b4',
  'large-v3-turbo':'4af2b29d7ec73d781377bfd1758ca957a807e941'
};
const models = Object.fromEntries(Object.entries(standard).map(([name, hash]) => [name, {
  repo:'ggerganov/whisper.cpp',file:`ggml-${name}.bin`,hash
}]));
models['kotoba-v2'] = {
  repo:'kotoba-tech/kotoba-whisper-v2.0-ggml',
  file:'ggml-kotoba-whisper-v2.0-q5_0.bin',
  hash:'4a3b92192b5d3578ff854a5876213e2e27af0c2d357492c2d14271e82c303658'
};
module.exports=models;
