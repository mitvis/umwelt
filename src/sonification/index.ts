import * as Tone from 'tone';
import { nodeIsTextInput } from '../utils/events';

export type SonifiedNote = {
  pitch?: number;
  volume?: number;
  duration?: number;
  ramp?: boolean;
  pauseBefore?: boolean;
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
  private noiseDuration = 0.25; // in seconds
  pauseDuration = .20; // in seconds
  defaultDuration = 0.5; // in seconds

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

    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel();

    if (note.pauseBefore) {
      this.pause();
    }

    Tone.Transport.schedule((time) => {
      if (note) {
        if (note.ramp) {
          if (note.volume) {
            this.synth.volume.rampTo(note.volume, this.rampDuration);
          }
          if (note.pitch) {
            const freq = Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency();
            this.synth.frequency.rampTo(freq, this.rampDuration);
          }
        }
        else {
          if (note.volume) {
            this.synth.volume.value = note.volume;
          }
          if (note.pitch) {
            const freq = Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency();
            this.synth.frequency.value = freq;
          }
        }
        if (!this.isPlaying) {
          this.isPlaying = true;
          this.synth.triggerAttack(note.pitch); // TODO set default pitch
        }
      }
      else {
        // TODO noise
      }

    }, note.pauseBefore ? this.pauseDuration : 0);

    Tone.Transport.start();
  }

  pause() {
    this.isPlaying = false;
    this.synth.triggerRelease();
  }

}

const singleton = new Sonifier();
export default singleton;
