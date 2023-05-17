import * as Tone from 'tone';
import { AudioSpecIndices } from '../UmweltAudio';
import { RefObject } from 'react';

export type SonifierNote = {
  duration: number; // duration in seconds
  elapsed: number; // elapsed time when should play in transport, in seconds
  pauseAfter?: number; // how long in seconds to pause after playing
  noise?: boolean; // does this note represent noise
  pitch?: number;
  volume?: number;
  ramp?: boolean; // should we ramp from this note
  indices: AudioSpecIndices; // corresponding spec state
}

class UmweltSonifier {

  private vol: Tone.Volume;
  private noise: Tone.NoiseSynth;
  private synth: Tone.Synth;

  pauseDuration = .25; // in seconds
  private rampDuration = 0.001; // in seconds
  defaultSequenceDuration = 5;

  private synthIsPlaying = false;
  private noiseIsPlaying = false;

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

    this.noise = new Tone.NoiseSynth({
      envelope: {
        sustain: 0.1
      }
    }).connect(this.vol);

    this.synth = new Tone.Synth().connect(this.vol);

    Tone.Transport.on('pause', () => {
      console.log('pause');
      window.requestAnimationFrame(() => {
        this.releaseSynth();
      })
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
    console.log('reset transport')
  }

  midiToFreq(midi): Tone.Unit.Frequency {
    return Tone.Frequency(Math.round(midi), "midi").toFrequency();
  }

  noteToState(note: SonifierNote) {
    if (note) {
      if (note.ramp) {
        if (note.volume) {
          this.synth.volume.rampTo(note.volume, this.rampDuration);
        }
        if (note.pitch) {
          const freq = this.midiToFreq(note.pitch);
          this.synth.frequency.rampTo(freq, this.rampDuration);
        }
      }
      else {
        if (note.volume) {
          this.synth.volume.value = note.volume;
        }
        if (note.pitch) {
          const freq = this.midiToFreq(note.pitch);
          this.synth.frequency.value = freq;
        }
      }
    }
  }

  triggerSynth(note: SonifierNote) {
    if (note.pitch) {
      this.noise.triggerRelease();
      this.noiseIsPlaying = false;
      if (!this.synthIsPlaying) {
        const freq = this.midiToFreq(note.pitch);
        this.synth.triggerAttack(freq);
        this.synthIsPlaying = true;
      }
    }
    else if (note.noise) {
      this.synth.triggerRelease();
      this.synthIsPlaying = false;
      if (!this.noiseIsPlaying) {
        this.noise.triggerAttack();
        this.noiseIsPlaying = true;
      }
    }
  }

  releaseSynth() {
    this.synth.triggerRelease();
    this.synthIsPlaying = false;
    this.noise.triggerRelease();
    this.noiseIsPlaying = false;
  }

  playCurrent() {

  }

  stopSequence() {

  }

  // play(note: SonifiedNote) {


  //   if (note?.pauseBefore) {
  //     this.synth.triggerRelease();
  //     this.isPlaying = false;
  //   }

  //   Tone.Transport.schedule((time) => {
  //     if (note) {
  //       if (!this.isPlaying) {
  //         this.isPlaying = true;
  //         this.synth.triggerAttack(Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency()); // TODO set default pitch
  //       }
  //     }
  //     else {
  //       this.synth.triggerRelease();
  //       this.isPlaying = false;
  //       this.noise.triggerAttackRelease(this.noiseDuration);
  //     }

  //   }, note?.pauseBefore ? this.pauseDuration : 0);

  //   Tone.Transport.start();
  // }

  // pause() {
  //   window.requestAnimationFrame(() => {
  //     Tone.Transport.cancel();
  //     if (this.isPlaying) {
  //       this.synth.triggerRelease();
  //       this.isPlaying = false;
  //     }
  //   })
  // }

  // ping(note: SonifiedNote) {
  //   console.log('ping')
  //   window.requestAnimationFrame(() => {
  //     if (note) {
  //       // if (note.ramp) {
  //       //   if (note.volume) {
  //       //     this.synth.volume.rampTo(note.volume, this.rampDuration);
  //       //   }
  //       //   if (note.pitch) {
  //       //     const freq = this.midiToFreq(note.pitch);
  //       //     this.synth.frequency.rampTo(freq, this.rampDuration);
  //       //   }
  //       // }
  //       // else {
  //         if (note.volume) {
  //           this.synth.volume.value = note.volume;
  //         }
  //       // }
  //       this.synth.triggerAttackRelease(Tone.Frequency(Math.floor(note.pitch), "midi").toFrequency(), note.duration || this.defaultDuration); // TODO set default pitch
  //     }
  //     else {
  //       this.noise.triggerAttackRelease(this.noiseDuration);
  //     }

  //   })
  // }

}

if (!(window as any)._uw_sonifier) {
  (window as any)._uw_sonifier = new UmweltSonifier();
}

export const Sonifier: UmweltSonifier = (window as any)._uw_sonifier;
