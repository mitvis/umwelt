import * as Tone from 'tone';
import { nodeIsTextInput } from '../utils/events';

export type SonifiedNote = {
  pitch?: number;
  volume?: number;
  duration?: number;
  ramp?: boolean;
}

export type SonifierSequence = {
  ramp: boolean,
  sequence: SonifiedNote[]
}

let instance;

class Sonifier {

  private vol: Tone.Volume;
  private noise: Tone.NoiseSynth;
  private synth: Tone.Synth;

  private rampDuration = 0.1; // in seconds
  private pauseDuration = .150; // in seconds
  private noiseDuration = 0.25; // in seconds
  private defaultDuration = 0.5; // in seconds

  // private notes: SonifierSequence[];

  private isPlaying = false;

  constructor() {
    if (instance) {
      throw new Error("Tried to create more than one instance of Sonifier");
    }
    instance = this;
    this.init();
  }

  private init() {

    this.vol = new Tone.Volume().toDestination();
    this.vol.mute = false;

    this.noise = new Tone.NoiseSynth().connect(this.vol);

    this.synth = new Tone.Synth().connect(this.vol);
  }

  getInstance() {
    return this;
  }

  mute(shouldMute: boolean) {
    this.vol.mute = shouldMute;
  }

  play(note: SonifiedNote) {
    if (note) {
      if (note.ramp) {
        if (note.volume) {
          this.synth.volume.rampTo(note.volume, this.rampDuration);
        }
        if (note.pitch) {
          this.synth.frequency.rampTo(note.pitch, this.rampDuration);
        }
      }
      else {
        if (note.volume) {
          this.synth.volume.value = note.volume;
        }
        if (note.pitch) {
          this.synth.frequency.value = note.pitch;
        }
      }
      if (!this.isPlaying) {
        this.synth.triggerAttack(note.pitch); // TODO set default pitch
        this.isPlaying = true;
      }
    }
    else {
      // TODO noise
    }
  }

  pause() {
    this.isPlaying = true;
    this.synth.triggerRelease();
  }

  ping(note: SonifiedNote) {
    if (note) {
      if (note.volume) {
        this.synth.volume.value = note.volume;
      }
      this.synth.triggerAttackRelease(note.pitch, note.duration || this.defaultDuration);
    }
    else {
      this.noise.triggerAttackRelease(this.defaultDuration);
    }
  }


}

const singleton = new Sonifier();
export default singleton;
