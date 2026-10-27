// 逛厂 Demo 视频 v2（2026-10-28）
// 1600x900，旁白驱动；真实操作幕用线上 R7/R8 构建录制的素材片，展示幕用本地 overlay。
export default {
  name: '逛厂 · 把画的饼砌成真的山',
  finalVideo: '逛厂-演示-v2.mp4',
  viewport: { width: 1600, height: 900 },
  fps: 25,
  baseUrl: process.env.DV_BASE_URL || 'https://zgqy379.github.io/guangchang/',
  tts: {
    role: 'warm',
    rate: '-4%',
    proxy: process.env.DV_TTS_PROXY ? process.env.DV_TTS_PROXY.split(',') : [],
    defaultFixes: true,
    fixes: [],
  },
  compose: { crf: 18, preset: 'medium', audioBitrate: '192k', sampleRate: 44100, padSeconds: 8 },
  scenes: [
    { id: 'm00', title: '片头', overlay: 'overlay/title.html' },
    { id: 'm01', title: '问题', overlay: 'overlay/problem.html' },
    { id: 'm02', title: '角色门', asset: 'assets/m02-rolegate.mp4' },
    { id: 'm03', title: '街区与投递', asset: 'assets/m03-street.mp4' },
    { id: 'm04', title: '对比与夜间', asset: 'assets/m04-compare-night.mp4' },
    { id: 'm05', title: '单人模式', asset: 'assets/m05-single.mp4' },
    { id: 'm06', title: '办公室', overlay: 'overlay/stack.html' },
    { id: 'm07', title: '过程与诚实', overlay: 'overlay/process.html' },
    { id: 'm08', title: '片尾', overlay: 'overlay/outro.html' },
  ],
};
