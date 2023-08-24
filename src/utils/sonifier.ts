import * as Tone from 'tone';
import { AudioUnitFieldSelectedIndices } from '../UmweltAudioUnit';
import { DEFAULT_RANGES } from './scales';

export type SonifierNote = {
  duration: number; // duration in seconds
  elapsed: number; // elapsed time when should play in transport, in seconds
  speakBefore?: string; // text to speak before playing
  pauseAfter?: number; // how long in seconds to pause after playing
  noise?: boolean; // does this note represent noise
  pitch?: number; // midi
  volume?: number; // decibels
  ramp?: boolean; // should we ramp from this note
  indices: AudioUnitFieldSelectedIndices; // corresponding spec state
};

class UmweltSonifier {
  private vol: Tone.Volume;
  private noise: Tone.NoiseSynth;
  private synth: Tone.Synth;

  pauseDuration = 0.25; // in seconds
  private rampDuration = 0.001; // in seconds
  defaultSequenceDuration = 5;

  private synthIsPlaying = false;
  private noiseIsPlaying = false;

  constructor() {
    if ((window as any)._uw_sonifier) {
      throw new Error('Tried to create more than one instance of Sonifier');
    }
    (window as any)._uw_sonifier = this;
    this.init();
  }

  private init() {
    this.vol = new Tone.Volume().toDestination();
    this.vol.mute = false;

    this.synth = new Tone.Synth({ oscillator: { type: 'triangle' } }).connect(this.vol);

    this.noise = new Tone.NoiseSynth({
      envelope: {
        sustain: 0.1,
        attackCurve: 'sine',
      },
      volume: DEFAULT_RANGES.volume[0],
    }).connect(this.vol);

    Tone.Transport.on('pause', () => {
      this.releaseSynth();
    });
  }

  getInstance() {
    return (window as any)._uw_sonifier;
  }

  mute(shouldMute: boolean) {
    this.vol.mute = shouldMute;
  }

  resetTransport() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel();
  }

  midiToFreq(midi): Tone.Unit.Frequency {
    return Tone.Frequency(Math.round(midi), 'midi').toFrequency();
  }

  private noteToState(note: SonifierNote) {
    if (note) {
      if (note.ramp) {
        if (note.volume !== undefined) {
          this.synth.volume.rampTo(note.volume, this.rampDuration);
        }
        if (note.pitch !== undefined) {
          const freq = this.midiToFreq(note.pitch);
          this.synth.frequency.rampTo(freq, this.rampDuration);
        }
      } else {
        if (note.volume !== undefined) {
          this.synth.volume.value = note.volume;
        }
        if (note.pitch !== undefined) {
          const freq = this.midiToFreq(note.pitch);
          this.synth.frequency.value = freq;
        }
      }
    }
  }

  triggerSynth(note: SonifierNote, withRelease?: boolean) {
    this.noteToState(note);
    if (!note.noise) {
      this.noise.triggerRelease();
      this.noiseIsPlaying = false;
      if (!this.synthIsPlaying) {
        const freq = this.midiToFreq(note.pitch);
        if (!withRelease) {
          this.synth.triggerAttack(freq);
          this.synthIsPlaying = true;
        } else {
          this.synth.triggerAttackRelease(freq, note.duration);
        }
      }
    } else {
      this.synth.triggerRelease();
      this.synthIsPlaying = false;
      if (!this.noiseIsPlaying) {
        if (!withRelease) {
          this.noise.triggerAttack();
          this.noiseIsPlaying = true;
        } else {
          this.noise.triggerAttackRelease(note.duration);
        }
      }
    }
  }

  releaseSynth() {
    this.synth.triggerRelease();
    this.synthIsPlaying = false;
    this.noise.triggerRelease();
    this.noiseIsPlaying = false;
  }
}

if (!(window as any)._uw_sonifier) {
  (window as any)._uw_sonifier = new UmweltSonifier();
}

export const Sonifier: UmweltSonifier = (window as any)._uw_sonifier;
