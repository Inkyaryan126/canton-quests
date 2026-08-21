import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Canton Quests — Tactical & Cinematic Audio Asset Synthesizer
 * Generates custom, pristine 44.1kHz 16-bit PCM RIFF audio files for the CQ sound system.
 */

const SAMPLE_RATE = 44100;

function createWavBuffer(samples: Float32Array): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (SAMPLE_RATE * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Format chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // Data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples with soft limiting
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Soft clip tanh limiter
    const sample = Math.tanh(samples[i]);
    const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// Synthesis Helpers
function createOscillator(
  samples: Float32Array,
  freq: number | ((t: number) => number),
  durationSec: number,
  type: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise' = 'sine',
  gainEnvelope?: (t: number) => number,
  startOffsetSec: number = 0
) {
  const startSample = Math.floor(startOffsetSec * SAMPLE_RATE);
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const idx = startSample + i;
    if (idx >= samples.length) break;

    const t = i / SAMPLE_RATE;
    const currentFreq = typeof freq === 'function' ? freq(t) : freq;
    phase += (2 * Math.PI * currentFreq) / SAMPLE_RATE;

    let val = 0;
    if (type === 'sine') {
      val = Math.sin(phase);
    } else if (type === 'triangle') {
      val = (2 / Math.PI) * Math.asin(Math.sin(phase));
    } else if (type === 'sawtooth') {
      val = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
    } else if (type === 'square') {
      val = Math.sin(phase) >= 0 ? 0.7 : -0.7;
    } else if (type === 'noise') {
      val = Math.random() * 2 - 1;
    }

    const gain = gainEnvelope ? gainEnvelope(t) : 1.0;
    samples[idx] += val * gain;
  }
}

// 1. UI Click: Very short, tactile, subtle, low volume micro-transient
function synthUiClick(): Float32Array {
  const duration = 0.045;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // High transient click
  createOscillator(
    samples,
    (t) => 1800 * Math.exp(-t * 80),
    0.02,
    'sine',
    (t) => 0.4 * Math.exp(-t * 120)
  );

  // Soft low body tap
  createOscillator(
    samples,
    (t) => 320 * Math.exp(-t * 60),
    0.045,
    'sine',
    (t) => 0.25 * Math.exp(-t * 50)
  );

  return samples;
}

// 2. UI Confirm: Crisp positive tactile stinger
function synthUiConfirm(): Float32Array {
  const duration = 0.12;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Dual tone confirmation
  createOscillator(
    samples,
    880,
    0.06,
    'sine',
    (t) => 0.3 * Math.exp(-t * 30),
    0
  );
  createOscillator(
    samples,
    1320,
    0.09,
    'sine',
    (t) => 0.35 * Math.exp(-t * 25),
    0.03
  );

  return samples;
}

// 3. UI Back: Subtle descending tactile release
function synthUiBack(): Float32Array {
  const duration = 0.08;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  createOscillator(
    samples,
    (t) => 800 - t * 4000,
    0.07,
    'triangle',
    (t) => 0.25 * Math.exp(-t * 35)
  );

  return samples;
}

// 4. UI Error: Low tactical rejection double thud (not loud arcade buzzer)
function synthUiError(): Float32Array {
  const duration = 0.22;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // First thud
  createOscillator(
    samples,
    (t) => 160 * Math.exp(-t * 20),
    0.09,
    'triangle',
    (t) => 0.4 * Math.exp(-t * 25),
    0
  );

  // Second thud
  createOscillator(
    samples,
    (t) => 130 * Math.exp(-t * 20),
    0.11,
    'triangle',
    (t) => 0.45 * Math.exp(-t * 22),
    0.09
  );

  return samples;
}

// 5. UI Locked: Mechanical resistance latch click
function synthUiLocked(): Float32Array {
  const duration = 0.15;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  createOscillator(
    samples,
    (t) => 2400 * Math.exp(-t * 100),
    0.03,
    'triangle',
    (t) => 0.3 * Math.exp(-t * 60)
  );
  createOscillator(
    samples,
    380,
    0.1,
    'sine',
    (t) => 0.3 * Math.exp(-t * 30),
    0.02
  );

  return samples;
}

// 6. Quest Select: Quick tactical scanner lock-on pulse
function synthQuestSelect(): Float32Array {
  const duration = 0.22;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Tactical frequency ramp
  createOscillator(
    samples,
    (t) => 480 + 1200 * Math.sin(t * 12),
    0.18,
    'sine',
    (t) => (t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 15)) * 0.35
  );

  // Reticle lock snap
  createOscillator(
    samples,
    1760,
    0.06,
    'triangle',
    (t) => 0.25 * Math.exp(-t * 40),
    0.05
  );

  return samples;
}

// 7. Quest Start: Deployment surge & tactical lock
function synthQuestStart(): Float32Array {
  const duration = 0.38;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Ascending energetic triad
  const freqs = [392, 587, 880];
  freqs.forEach((f, idx) => {
    createOscillator(
      samples,
      f,
      0.28,
      'sine',
      (t) => 0.28 * Math.exp(-t * 10),
      idx * 0.05
    );
  });

  // Low punch
  createOscillator(
    samples,
    (t) => 120 * Math.exp(-t * 15),
    0.3,
    'sine',
    (t) => 0.4 * Math.exp(-t * 12)
  );

  return samples;
}

// 8. Quest Complete: Strong impact + rising warm confirmation tone
function synthQuestComplete(): Float32Array {
  const duration = 0.85;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // 1. Sub-bass grounded body hit
  createOscillator(
    samples,
    (t) => 130 * Math.exp(-t * 8),
    0.5,
    'sine',
    (t) => 0.5 * Math.exp(-t * 7)
  );

  // 2. Rising harmonic chord (C major 9th warmth: C5, E5, G5, B5, D6)
  const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
  notes.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.65,
      'sine',
      (t) => (t < 0.02 ? (t / 0.02) * 0.22 : 0.22 * Math.exp(-(t - 0.02) * 4.5)),
      0.08 + idx * 0.06
    );
    // Subtle second harmonic shimmer
    createOscillator(
      samples,
      freq * 2,
      0.45,
      'triangle',
      (t) => 0.06 * Math.exp(-t * 6),
      0.08 + idx * 0.06
    );
  });

  return samples;
}

// 9. Chain Unlock: Mechanical multi-latch sequence + chime
function synthChainUnlock(): Float32Array {
  const duration = 0.75;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Sequential lock clicks
  for (let i = 0; i < 3; i++) {
    createOscillator(
      samples,
      (t) => 1400 * Math.exp(-t * 50),
      0.05,
      'triangle',
      (t) => 0.25 * Math.exp(-t * 40),
      i * 0.09
    );
  }

  // Harmonic unlock resonance
  const notes = [440, 659.25, 880, 1318.51];
  notes.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.5,
      'sine',
      (t) => 0.2 * Math.exp(-t * 5),
      0.28 + idx * 0.05
    );
  });

  return samples;
}

// 10. Secret Reveal: Low pulse + reverse swell + reveal click + cryptic shimmer
function synthSecretReveal(): Float32Array {
  const duration = 0.95;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Reverse swell (rising amplitude)
  createOscillator(
    samples,
    (t) => 220 + t * 240,
    0.45,
    'sine',
    (t) => 0.35 * Math.pow(t / 0.45, 2.5),
    0
  );

  // Sub pulse
  createOscillator(
    samples,
    (t) => 80 * Math.exp(-t * 5),
    0.6,
    'sine',
    (t) => 0.5 * Math.exp(-t * 4),
    0.42
  );

  // Reveal snap
  createOscillator(
    samples,
    (t) => 2800 * Math.exp(-t * 80),
    0.04,
    'triangle',
    (t) => 0.35 * Math.exp(-t * 60),
    0.44
  );

  // Cryptic minor chord shimmer (D minor / F# harmonic)
  const mysterious = [293.66, 349.23, 440, 587.33, 880];
  mysterious.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.5,
      'sine',
      (t) => 0.18 * Math.exp(-t * 4.2),
      0.46 + idx * 0.03
    );
  });

  return samples;
}

// 11. Badge Unlock: Metallic shimmer + crisp bell reward accent
function synthBadgeUnlock(): Float32Array {
  const duration = 0.72;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Metallic inharmonic partials
  const partials = [
    { f: 587.33, g: 0.35 },
    { f: 880, g: 0.3 },
    { f: 1174.66, g: 0.28 },
    { f: 1760, g: 0.22 },
    { f: 2349.32, g: 0.18 },
    { f: 3520, g: 0.12 },
  ];

  partials.forEach((p, idx) => {
    createOscillator(
      samples,
      p.f,
      0.65,
      'sine',
      (t) => (t < 0.015 ? (t / 0.015) * p.g : p.g * Math.exp(-(t - 0.015) * 4.5)),
      idx * 0.02
    );
  });

  return samples;
}

// 12. Rank Up: Cinematic hit + ascending brass fanfare
function synthRankUp(): Float32Array {
  const duration = 1.1;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Sub bass boom
  createOscillator(
    samples,
    (t) => 110 * Math.exp(-t * 6),
    0.8,
    'sine',
    (t) => 0.55 * Math.exp(-t * 4.5)
  );

  // Ascending fanfare triad
  const fanfare = [349.23, 440, 523.25, 698.46, 880, 1046.5];
  fanfare.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.75,
      'triangle',
      (t) => (t < 0.03 ? (t / 0.03) * 0.22 : 0.22 * Math.exp(-(t - 0.03) * 3.8)),
      idx * 0.07
    );
  });

  return samples;
}

// 13. XP Gain: Crisp micro-particle sparkle hit
function synthXpGain(): Float32Array {
  const duration = 0.14;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  createOscillator(
    samples,
    (t) => 1200 + t * 3000,
    0.1,
    'sine',
    (t) => 0.28 * Math.exp(-t * 28)
  );
  createOscillator(
    samples,
    2400,
    0.08,
    'sine',
    (t) => 0.2 * Math.exp(-t * 35),
    0.02
  );

  return samples;
}

// 14. Flash Drop: Urgent tactical alert pulse
function synthFlashDrop(): Float32Array {
  const duration = 0.65;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // 3 tactical pulses
  for (let i = 0; i < 3; i++) {
    createOscillator(
      samples,
      (t) => 880 - t * 400,
      0.1,
      'triangle',
      (t) => 0.35 * Math.exp(-t * 18),
      i * 0.14
    );
    createOscillator(
      samples,
      1760,
      0.08,
      'sine',
      (t) => 0.2 * Math.exp(-t * 25),
      i * 0.14 + 0.02
    );
  }

  return samples;
}

// 15. Transmission: Radio incoming chirp
function synthTransmission(): Float32Array {
  const duration = 0.38;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  createOscillator(
    samples,
    1400,
    0.08,
    'sine',
    (t) => 0.25 * Math.exp(-t * 30),
    0
  );
  createOscillator(
    samples,
    2100,
    0.12,
    'sine',
    (t) => 0.28 * Math.exp(-t * 25),
    0.08
  );

  return samples;
}

// 16. Finale Qualified: The most important sound in the system — cinematic orchestral resonance
function synthFinaleQualified(): Float32Array {
  const duration = 1.65;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // 1. Deep Sub Impact (40Hz)
  createOscillator(
    samples,
    (t) => 90 * Math.exp(-t * 4),
    1.2,
    'sine',
    (t) => 0.6 * Math.exp(-t * 3)
  );

  // 2. Majestic Celestial Chord (D major overtone series: D, A, D, F#, A, D, F#)
  const overtoneNotes = [
    { f: 146.83, delay: 0.0, gain: 0.35 },
    { f: 220.0, delay: 0.04, gain: 0.3 },
    { f: 293.66, delay: 0.08, gain: 0.28 },
    { f: 369.99, delay: 0.12, gain: 0.26 },
    { f: 440.0, delay: 0.16, gain: 0.24 },
    { f: 587.33, delay: 0.2, gain: 0.22 },
    { f: 739.99, delay: 0.24, gain: 0.2 },
    { f: 880.0, delay: 0.28, gain: 0.18 },
    { f: 1174.66, delay: 0.32, gain: 0.16 },
    { f: 1479.98, delay: 0.36, gain: 0.12 },
  ];

  overtoneNotes.forEach((n) => {
    createOscillator(
      samples,
      n.f,
      1.3,
      'sine',
      (t) => (t < 0.06 ? (t / 0.06) * n.gain : n.gain * Math.exp(-(t - 0.06) * 2.2)),
      n.delay
    );
    // Harmonic sheen
    createOscillator(
      samples,
      n.f * 2,
      0.9,
      'triangle',
      (t) => 0.04 * Math.exp(-t * 3.5),
      n.delay
    );
  });

  return samples;
}

// 17. Path Family: Warm, bright, welcoming, energetic
function synthPathFamily(): Float32Array {
  const duration = 0.65;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Warm A Major arpeggio (A4, C#5, E5, A5)
  const chord = [440, 554.37, 659.25, 880];
  chord.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.55,
      'sine',
      (t) => 0.28 * Math.exp(-t * 5),
      idx * 0.06
    );
  });

  // Soft low body
  createOscillator(
    samples,
    110,
    0.4,
    'sine',
    (t) => 0.3 * Math.exp(-t * 6)
  );

  return samples;
}

// 18. Path Challenge: Sharp, heavy, driving mechanical impact
function synthPathChallenge(): Float32Array {
  const duration = 0.65;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Sub punch
  createOscillator(
    samples,
    (t) => 140 * Math.exp(-t * 12),
    0.4,
    'sine',
    (t) => 0.55 * Math.exp(-t * 8)
  );

  // Aggressive power 5ths (E3, B3, E4, B4)
  const power = [164.81, 246.94, 329.63, 493.88];
  power.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.5,
      'sawtooth',
      (t) => 0.15 * Math.exp(-t * 6),
      0.02 + idx * 0.04
    );
  });

  return samples;
}

// 19. Path Secret: Dark, mysterious, sonar pulse
function synthPathSecret(): Float32Array {
  const duration = 0.75;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Deep resonant D minor swell
  const dMinor = [146.83, 220, 293.66, 349.23, 440];
  dMinor.forEach((freq, idx) => {
    createOscillator(
      samples,
      freq,
      0.65,
      'sine',
      (t) => (t < 0.04 ? (t / 0.04) * 0.24 : 0.24 * Math.exp(-(t - 0.04) * 4.5)),
      idx * 0.05
    );
  });

  return samples;
}

// 20. Scan: Radar ping + satellite sweep
function synthScan(): Float32Array {
  const duration = 0.55;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Frequency sweep chirp
  createOscillator(
    samples,
    (t) => 600 + 1600 * (t / 0.4),
    0.4,
    'sine',
    (t) => (t < 0.04 ? (t / 0.04) * 0.3 : 0.3 * Math.exp(-(t - 0.04) * 6))
  );

  return samples;
}

// 21. Lock On: Precision reticle snap
function synthLockOn(): Float32Array {
  const duration = 0.18;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  createOscillator(
    samples,
    1400,
    0.06,
    'sine',
    (t) => 0.35 * Math.exp(-t * 40),
    0
  );
  createOscillator(
    samples,
    2400,
    0.1,
    'triangle',
    (t) => 0.3 * Math.exp(-t * 30),
    0.04
  );

  return samples;
}

// 22. Node Ping: Subtle field beacon sonar ping
function synthNodePing(): Float32Array {
  const duration = 0.3;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  createOscillator(
    samples,
    980,
    0.25,
    'sine',
    (t) => 0.28 * Math.exp(-t * 12)
  );

  return samples;
}

// Audio Map
const SOUND_GENERATORS: Record<string, () => Float32Array> = {
  'ui-click.mp3': synthUiClick,
  'ui-confirm.mp3': synthUiConfirm,
  'ui-back.mp3': synthUiBack,
  'ui-error.mp3': synthUiError,
  'ui-locked.mp3': synthUiLocked,
  'quest-select.mp3': synthQuestSelect,
  'quest-start.mp3': synthQuestStart,
  'quest-complete.mp3': synthQuestComplete,
  'chain-unlock.mp3': synthChainUnlock,
  'secret-reveal.mp3': synthSecretReveal,
  'badge-unlock.mp3': synthBadgeUnlock,
  'rank-up.mp3': synthRankUp,
  'xp-gain.mp3': synthXpGain,
  'flash-drop.mp3': synthFlashDrop,
  'transmission.mp3': synthTransmission,
  'finale-qualified.mp3': synthFinaleQualified,
  'path-family.mp3': synthPathFamily,
  'path-challenge.mp3': synthPathChallenge,
  'path-secret.mp3': synthPathSecret,
  'scan.mp3': synthScan,
  'lock-on.mp3': synthLockOn,
  'node-ping.mp3': synthNodePing,
};

export function generateAllAudioFiles(outputDir: string) {
  mkdirSync(outputDir, { recursive: true });

  for (const [filename, generator] of Object.entries(SOUND_GENERATORS)) {
    const samples = generator();
    const wavBuffer = createWavBuffer(samples);
    const targetPath = join(outputDir, filename);
    writeFileSync(targetPath, wavBuffer);
    console.log(`Generated CQ Audio Asset: ${filename} (${wavBuffer.length} bytes)`);
  }
}

// Run directly
const out = join(process.cwd(), 'public/audio/cq');
generateAllAudioFiles(out);
console.log('✅ All 22 Canton Quests audio assets synthesized successfully.');
