// Web Audio API Keyboard Switch Synthesizer
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playKeySound(type, volume = 0.5) {
  if (type === 'mute' || type === 'none' || volume <= 0) return;
  
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;
    
    // Core output gain node for volume control
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, time); // Scale volume to prevent clipping
    masterGain.connect(ctx.destination);

    switch (type) {
      case 'mechanical': {
        // Cherry MX Switch click emulation (Oscillator + Noise Burst)
        
        // 1. Friction Noise
        const bufferSize = ctx.sampleRate * 0.015; // 15ms burst
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(2000, time);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.015);

        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        // 2. Solid bottoming out thud
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        
        thudOsc.type = 'triangle';
        thudOsc.frequency.setValueAtTime(450, time);
        thudOsc.frequency.exponentialRampToValueAtTime(80, time + 0.035);
        
        thudGain.gain.setValueAtTime(1.2, time);
        thudGain.gain.exponentialRampToValueAtTime(0.01, time + 0.035);
        
        thudOsc.connect(thudGain);
        thudGain.connect(masterGain);
        
        // Start sources
        noiseNode.start(time);
        thudOsc.start(time);
        thudOsc.stop(time + 0.04);
        break;
      }

      case 'bubble': {
        // Pop sound: Resonant fast pitch sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, time);
        osc.frequency.exponentialRampToValueAtTime(70, time + 0.05);
        
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.06);
        break;
      }

      case 'synth': {
        // Retro 8-bit retro sound: square wave
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, time);
        osc.frequency.setValueAtTime(440, time + 0.01);
        
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.03);
        break;
      }

      case 'click': 
      default: {
        // High frequency transient click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4000, time);
        osc.frequency.exponentialRampToValueAtTime(1000, time + 0.008);
        
        gain.gain.setValueAtTime(1.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.01);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.012);
        break;
      }
    }
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}
