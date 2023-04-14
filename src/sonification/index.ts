import * as Tone from 'tone';
import { nodeIsTextInput } from '../utils/events';

export type SonifiedNote = {
  pitch?: number;
  volume?: number;
  duration?: number;
  ramp?: boolean;
  pauseBefore?: boolean;
}

class UmweltSonifier {

  private vol: Tone.Volume;
  private noise: Tone.NoiseSynth;
  private synth: Tone.Synth;

  pauseDuration = .25; // in seconds
  defaultDuration = 0.5; // in seconds
  private rampDuration = this.defaultDuration / 2; // in seconds
  private noiseDuration = 0.25; // in seconds

  // private notes: SonifierSequence[];

  private isPlaying = false;

  constructor() {
    if ((window as any)._uw_sonifier) {
      throw new Error("Tried to create more than one instance of Sonifier");
    }
    (window as any)._uw_sonifier = this;
    this.init();
  }

  private init() {

    this.vol = new Tone.Volume().toDestination();
    this.vol.mute = false;

    this.noise = new Tone.NoiseSynth().connect(this.vol);

    this.synth = new Tone.Synth().connect(this.vol);
  }

  getInstance() {
    return (window as any)._uw_sonifier;
  }

  mute(shouldMute: boolean) {
    this.vol.mute = shouldMute;
  }

  play(note: SonifiedNote) {

    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel();

    if (note?.pauseBefore) {
      this.synth.triggerRelease();
      this.isPlaying = false;
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
          this.synth.triggerAttack(Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency()); // TODO set default pitch
        }
      }
      else {
        this.synth.triggerRelease();
        this.isPlaying = false;
        this.noise.triggerAttackRelease(this.noiseDuration);
      }

    }, note?.pauseBefore ? this.pauseDuration : 0);

    Tone.Transport.start();
  }

  pause() {
    window.requestAnimationFrame(() => {
      Tone.Transport.cancel();
      if (this.isPlaying) {
        this.synth.triggerRelease();
        this.isPlaying = false;
      }
    })
  }

  ping(note: SonifiedNote) {
    console.log('ping')
    window.requestAnimationFrame(() => {
      if (note) {
        // if (note.ramp) {
        //   if (note.volume) {
        //     this.synth.volume.rampTo(note.volume, this.rampDuration);
        //   }
        //   if (note.pitch) {
        //     const freq = Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency();
        //     this.synth.frequency.rampTo(freq, this.rampDuration);
        //   }
        // }
        // else {
          if (note.volume) {
            this.synth.volume.value = note.volume;
          }
        // }
        this.synth.triggerAttackRelease(Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency(), note.duration || this.defaultDuration); // TODO set default pitch
      }
      else {
        this.noise.triggerAttackRelease(this.noiseDuration);
      }

    })
  }

}

if (!(window as any)._uw_sonifier) {
  (window as any)._uw_sonifier = new UmweltSonifier();
}

export const Sonifier: UmweltSonifier = (window as any)._uw_sonifier;
