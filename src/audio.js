/**
 * Tiny synthesized pad + chime. Nothing is audible until the visitor opts in,
 * and the context stays suspended until that gesture.
 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let nodes = [];
  let enabled = false;

  function build() {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    filter.Q.value = 0.45;
    filter.connect(gain);

    const voice = (freq, type, amount, detune) => {
      const osc = context.createOscillator();
      const voiceGain = context.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      voiceGain.gain.value = amount;
      osc.connect(voiceGain);
      voiceGain.connect(filter);
      osc.start();
      nodes.push(osc);
    };

    voice(110, 'sine', 0.05, 0);
    voice(110, 'sine', 0.025, 7);
    voice(164.81, 'sine', 0.02, -4);
    voice(329.63, 'triangle', 0.008, 0);

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);

    ctx = context;
    master = gain;
  }

  function chime() {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + index * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.028, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 1.6);
    });
  }

  async function setEnabled(next) {
    if (next && !ctx) build();
    if (!ctx || !master) {
      enabled = false;
      return false;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    enabled = next;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.linearRampToValueAtTime(next ? 0.85 : 0.0001, now + 0.4);
    if (next) chime();
    if (!next) {
      window.setTimeout(() => {
        if (!enabled && ctx && ctx.state === 'running') ctx.suspend();
      }, 500);
    }
    return enabled;
  }

  return {
    get enabled() {
      return enabled;
    },
    async toggle() {
      return setEnabled(!enabled);
    },
    playChime() {
      if (enabled) chime();
    },
  };
}
