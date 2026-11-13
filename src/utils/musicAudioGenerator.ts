import { MenderMusicTrack, MenderMusicAlbum, MenderMusicArtist, MusicGenre } from '../types';
import coverMain from '../assets/images/mender_cover_main_1794588967774.jpg';
import coverLofi from '../assets/images/mender_cover_lofi_1794588970525.jpg';
import coverSynth from '../assets/images/mender_cover_synth_1794588968890.jpg';
import coverAmbient from '../assets/images/mender_cover_ambient_1794588969528.jpg';

export const MUSIC_GENRES: MusicGenre[] = [
  'Электроника',
  'Lo-Fi & Chill',
  'Синтвейв',
  'Хип-Хоп & R&B',
  'Инди & Рок',
  'Эмбиент',
  'Неоклассика',
  'Поп',
];

export const BUILTIN_MUSIC_COVERS = {
  aurora: coverMain,
  lofiNight: coverLofi,
  cyberDrive: coverSynth,
  northernLights: coverAmbient,
};

// Единственный базовый исполнитель по умолчанию — Официальное сообщество Mender (остальные добавляются при загрузке треков пользователями)
export const BUILTIN_MUSIC_ARTISTS: MenderMusicArtist[] = [
  {
    artistId: 'art_mender_official',
    name: 'Mender',
    genre: 'Электроника',
    avatarUrl: BUILTIN_MUSIC_COVERS.aurora,
    coverBannerUrl: BUILTIN_MUSIC_COVERS.aurora,
    bio: 'Единый общий плейлист от Mender. Фирменные инструментальные темы для фонового прослушивания и работы в мессенджере.',
    monthlyListeners: 1,
    verified: true,
  },
];

// Единственный общий плейлист / альбом от Mender по умолчанию
export const BUILTIN_MUSIC_ALBUMS: MenderMusicAlbum[] = [
  {
    albumId: 'alb_mender_common',
    title: 'Общий плейлист от Mender',
    artist: 'Mender',
    artistId: 'art_mender_official',
    genre: 'Электроника',
    releaseYear: 2026,
    coverUrl: BUILTIN_MUSIC_COVERS.aurora,
    description: 'Официальный общий плейлист Mender Music. Сюда также попадают публичные треки сообщества и фирменные мелодии Mender.',
    trackIds: [
      'trk_mender_1',
      'trk_mender_2',
      'trk_mender_3',
      'trk_mender_4',
    ],
  },
];

// Компактный официальный набор треков внутри единого «Общего плейлиста от Mender»
export const BUILTIN_MUSIC_TRACKS: MenderMusicTrack[] = [
  {
    trackId: 'trk_mender_1',
    uploaderId: 'mender_official',
    uploaderName: 'Mender',
    uploaderUsername: 'mender_official',
    uploaderAvatar: BUILTIN_MUSIC_COVERS.aurora,
    title: 'Mender — Основная тема (Original Mix)',
    artist: 'Mender',
    artistId: 'art_mender_official',
    albumTitle: 'Общий плейлист от Mender',
    albumId: 'alb_mender_common',
    genre: 'Электроника',
    releaseYear: 2026,
    audioUrl: 'synth://aurora_pulse',
    coverUrl: BUILTIN_MUSIC_COVERS.aurora,
    duration: 38,
    sizeBytes: 3350000,
    mimeType: 'audio/wav',
    visibility: 'public',
    playsCount: 0,
    likesCount: 0,
    lyrics: 'Официальная инструментальная тема из общего плейлиста Mender.',
    isBuiltIn: true,
    synthPreset: 'aurora_pulse',
    createdAt: Date.now() - 3600000 * 4,
  },
  {
    trackId: 'trk_mender_2',
    uploaderId: 'mender_official',
    uploaderName: 'Mender',
    uploaderUsername: 'mender_official',
    uploaderAvatar: BUILTIN_MUSIC_COVERS.lofiNight,
    title: 'Mender — Ночной Lo-Fi (Chill Beat)',
    artist: 'Mender',
    artistId: 'art_mender_official',
    albumTitle: 'Общий плейлист от Mender',
    albumId: 'alb_mender_common',
    genre: 'Lo-Fi & Chill',
    releaseYear: 2026,
    audioUrl: 'synth://lofi_rain',
    coverUrl: BUILTIN_MUSIC_COVERS.lofiNight,
    duration: 42,
    sizeBytes: 3700000,
    mimeType: 'audio/wav',
    visibility: 'public',
    playsCount: 0,
    likesCount: 0,
    lyrics: 'Спокойный инструментальный Lo-Fi бит из общего плейлиста Mender.',
    isBuiltIn: true,
    synthPreset: 'lofi_rain',
    createdAt: Date.now() - 3600000 * 3,
  },
  {
    trackId: 'trk_mender_3',
    uploaderId: 'mender_official',
    uploaderName: 'Mender',
    uploaderUsername: 'mender_official',
    uploaderAvatar: BUILTIN_MUSIC_COVERS.cyberDrive,
    title: 'Mender — Неоновый импульс (Synthwave)',
    artist: 'Mender',
    artistId: 'art_mender_official',
    albumTitle: 'Общий плейлист от Mender',
    albumId: 'alb_mender_common',
    genre: 'Синтвейв',
    releaseYear: 2026,
    audioUrl: 'synth://synthwave_drive',
    coverUrl: BUILTIN_MUSIC_COVERS.cyberDrive,
    duration: 38,
    sizeBytes: 3350000,
    mimeType: 'audio/wav',
    visibility: 'public',
    playsCount: 0,
    likesCount: 0,
    lyrics: 'Синтвейв-композиция из общего плейлиста Mender.',
    isBuiltIn: true,
    synthPreset: 'synthwave_drive',
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    trackId: 'trk_mender_4',
    uploaderId: 'mender_official',
    uploaderName: 'Mender',
    uploaderUsername: 'mender_official',
    uploaderAvatar: BUILTIN_MUSIC_COVERS.northernLights,
    title: 'Mender — Глубокий космос (Ambient)',
    artist: 'Mender',
    artistId: 'art_mender_official',
    albumTitle: 'Общий плейлист от Mender',
    albumId: 'alb_mender_common',
    genre: 'Эмбиент',
    releaseYear: 2026,
    audioUrl: 'synth://ambient_cosmos',
    coverUrl: BUILTIN_MUSIC_COVERS.northernLights,
    duration: 45,
    sizeBytes: 3960000,
    mimeType: 'audio/wav',
    visibility: 'public',
    playsCount: 0,
    likesCount: 0,
    lyrics: 'Атмосферный эмбиент из общего плейлиста Mender для концентрации и отдыха.',
    isBuiltIn: true,
    synthPreset: 'ambient_cosmos',
    createdAt: Date.now() - 3600000,
  },
];

// Cache of generated playable WAV ObjectURLs so each synth track is synthesized once per session
const wavUrlCache = new Map<string, string>();

interface PresetConfig {
  bpm: number;
  durationSec: number;
  chords: number[][];
  arpNotes: number[];
  bassRatio: number;
  warmth: number;
  percussionLevel: number;
}

const PRESET_CONFIGS: Record<string, PresetConfig> = {
  aurora_pulse: {
    bpm: 122,
    durationSec: 38,
    chords: [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66],
    ],
    arpNotes: [440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 440.0, 392.0],
    bassRatio: 0.5,
    warmth: 0.65,
    percussionLevel: 0.85,
  },
  lofi_rain: {
    bpm: 82,
    durationSec: 42,
    chords: [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [293.66, 349.23, 440.0, 523.25],
      [196.0, 246.94, 293.66, 349.23],
    ],
    arpNotes: [523.25, 659.25, 587.33, 493.88, 523.25, 392.0, 440.0, 329.63],
    bassRatio: 0.5,
    warmth: 0.9,
    percussionLevel: 0.55,
  },
  synthwave_drive: {
    bpm: 110,
    durationSec: 38,
    chords: [
      [164.81, 196.0, 246.94],
      [261.63, 329.63, 392.0],
      [293.66, 369.99, 440.0],
      [246.94, 293.66, 369.99],
    ],
    arpNotes: [329.63, 392.0, 493.88, 659.25, 493.88, 392.0, 329.63, 246.94],
    bassRatio: 0.5,
    warmth: 0.55,
    percussionLevel: 0.85,
  },
  ambient_cosmos: {
    bpm: 64,
    durationSec: 45,
    chords: [
      [146.83, 220.0, 293.66, 369.99],
      [196.0, 246.94, 293.66, 369.99],
      [246.94, 293.66, 369.99, 440.0],
      [220.0, 277.18, 329.63, 440.0],
    ],
    arpNotes: [293.66, 369.99, 440.0, 587.33, 440.0, 369.99, 293.66, 246.94],
    bassRatio: 0.5,
    warmth: 0.96,
    percussionLevel: 0.12,
  },
};

/**
 * Generates a real playable 16-bit PCM WAV Blob URL for any `synth://...` preset.
 */
export function resolveSynthAudioUrl(synthUrlOrPreset: string): string {
  const presetKey = synthUrlOrPreset.replace(/^synth:\/\//, '');
  const cached = wavUrlCache.get(presetKey);
  if (cached) return cached;

  const cfg = PRESET_CONFIGS[presetKey] || PRESET_CONFIGS.aurora_pulse;
  const sampleRate = 22050;
  const numChannels = 2;
  const totalSamples = Math.floor(sampleRate * cfg.durationSec);
  const dataBytes = totalSamples * numChannels * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  const beatDuration = 60 / cfg.bpm;
  const stepDuration = beatDuration / 2;
  const barDuration = beatDuration * 4;

  let offset = 44;
  const twoPi = Math.PI * 2;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    let masterEnv = 1.0;
    if (t < 1.2) {
      masterEnv = t / 1.2;
    } else if (t > cfg.durationSec - 2.0) {
      masterEnv = Math.max(0, (cfg.durationSec - t) / 2.0);
    }

    const barIndex = Math.floor(t / barDuration);
    const chord = cfg.chords[barIndex % cfg.chords.length];

    let padL = 0;
    let padR = 0;
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const detune = c % 2 === 0 ? 1.0015 : 0.9985;
      const s1 = Math.sin(twoPi * freq * t);
      const s2 = Math.sin(twoPi * freq * detune * t + 0.4);
      padL += s1 * 0.11;
      padR += s2 * 0.11;
    }

    const rootFreq = chord[0] * cfg.bassRatio;
    const beatPos = (t % beatDuration) / beatDuration;
    const bassEnv = Math.exp(-beatPos * 3.2);
    const bassSample =
      (Math.sin(twoPi * rootFreq * t) * 0.75 +
        Math.sin(twoPi * rootFreq * 2 * t) * 0.25) *
      0.26 *
      bassEnv;

    const stepIndex = Math.floor(t / stepDuration);
    const stepPos = (t % stepDuration) / stepDuration;
    const arpFreq = cfg.arpNotes[stepIndex % cfg.arpNotes.length];
    const arpEnv = Math.exp(-stepPos * 5.5) * (1 - Math.exp(-stepPos * 80));
    const arpPan = 0.5 + 0.35 * Math.sin(stepIndex * 0.9);
    const arpWave =
      (Math.sin(twoPi * arpFreq * t) +
        (1 - cfg.warmth) * 0.35 * Math.sin(twoPi * arpFreq * 2 * t)) *
      0.19 *
      arpEnv;

    let drumSample = 0;
    if (cfg.percussionLevel > 0.05) {
      const beatInBar = Math.floor(t / beatDuration) % 4;
      if ((beatInBar === 0 || beatInBar === 2) && beatPos < 0.28) {
        const kickFreq = 115 * Math.exp(-beatPos * 26) + 42;
        const kickEnv = Math.exp(-beatPos * 16);
        drumSample += Math.sin(twoPi * kickFreq * beatPos) * 0.28 * kickEnv * cfg.percussionLevel;
      }
      if ((beatInBar === 1 || beatInBar === 3) && beatPos < 0.22) {
        const snareEnv = Math.exp(-beatPos * 24);
        const pseudoNoise = Math.sin(i * 12.9898) * 43758.5453;
        const noise = pseudoNoise - Math.floor(pseudoNoise) - 0.5;
        drumSample +=
          (noise * 0.24 + Math.sin(twoPi * 185 * beatPos) * 0.12) *
          snareEnv *
          cfg.percussionLevel;
      }
      if (stepPos < 0.08) {
        const hatEnv = Math.exp(-stepPos * 55);
        const pseudoNoise = Math.sin(i * 78.233) * 43758.5453;
        const noise = pseudoNoise - Math.floor(pseudoNoise) - 0.5;
        drumSample += noise * 0.08 * hatEnv * cfg.percussionLevel;
      }
    }

    const left = Math.max(
      -0.98,
      Math.min(0.98, (padL + bassSample + arpWave * arpPan + drumSample) * masterEnv)
    );
    const right = Math.max(
      -0.98,
      Math.min(0.98, (padR + bassSample + arpWave * (1 - arpPan) + drumSample) * masterEnv)
    );

    view.setInt16(offset, Math.floor(left * 32767), true);
    view.setInt16(offset + 2, Math.floor(right * 32767), true);
    offset += 4;
  }

  const wavBlob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(wavBlob);
  wavUrlCache.set(presetKey, url);
  return url;
}

export function formatMusicDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
