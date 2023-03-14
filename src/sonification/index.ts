import * as Tone from 'tone';

export type SonifiedNote = {
  pitch?: number;
  volume?: number;
  duration?: number;
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

  private notes: SonifiedNote[];

  constructor() {
    if (instance) {
      throw new Error("Tried to create more than one instance of Sonifier");
    }
    instance = this;
    this.init();
  }

  private init() {
    window.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.key === 'p' && !e.repeat) {
        await Tone.start()
        console.log('keydown notes', this.notes);
        if (this.notes) {
          if (this.notes.length === 0) {
            this.play(null);
          }
          else if (this.notes.length === 1) {
            this.play(this.notes[0]);
          }
          else {
            if (Tone.Transport.state !== 'started') {
              this.playSequence(this.notes);
            }
            else {
              Tone.Transport.stop();
              Tone.Transport.position = 0;
              Tone.Transport.cancel();
            }
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.ctrlKey && e.key === 'p') {
        if (this.notes && this.notes.length === 1) {
          this.pause();
        }
      }
    });

    this.vol = new Tone.Volume().toDestination();
    this.vol.mute = false;

    this.noise = new Tone.NoiseSynth().connect(this.vol);

    this.synth = new Tone.Synth().connect(this.vol);
  }

  getInstance() {
    return this;
  }

  setNotes(notes: SonifiedNote[]) {
    this.notes = notes;
  }

  setVolume(value: number) {
    if (value) {
      this.vol.volume.rampTo(value, this.rampDuration);
    }
  }

  mute(shouldMute: boolean) {
    this.vol.mute = shouldMute;
  }

  play(note: SonifiedNote) {
    if (note) {
      this.setVolume(note?.volume);
      this.synth.triggerAttack(note?.pitch);
    }
    else {
      this.noise.triggerAttack();
    }
  }

  ping(note: SonifiedNote) {
    if (note) {
      this.setVolume(note?.volume);
      this.synth.triggerAttackRelease(note?.pitch, this.defaultDuration);
    }
    else {
      this.noise.triggerAttackRelease(this.defaultDuration);
    }
  }

  pause() {
    this.synth.triggerRelease();
  }

  playSequence(notes: SonifiedNote[]) {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel();
    let elapsed = 0;

    notes.forEach(note => {
      Tone.Transport.schedule((time) => {
        if (note) {
          if (Object.keys(note).length === 1 && note.duration) {
            // duration-only object to denote pause (janky i know)
          }
          else {
            this.setVolume(note?.volume);
            this.synth.triggerAttackRelease(note.pitch, note.duration || this.defaultDuration, time);
            console.log('synth', note.pitch, note.duration || this.defaultDuration, time)
          }
        }
        else {
          this.noise.triggerAttackRelease(this.noiseDuration, time);
          console.log('noise')
        }
      }, elapsed);

      elapsed += (note ? (note.duration || this.defaultDuration) : this.noiseDuration) + this.pauseDuration;
    })

    Tone.Transport.schedule(() => {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.cancel();
      elapsed = 0;
    }, elapsed - this.pauseDuration);

    Tone.Transport.start();

  }

  pingCurrentNotes() {
    if (this.notes) {
      if (this.notes.length === 0) {
        this.ping(null);
      }
      else if (this.notes.length === 1) {
        this.ping(this.notes[0]);
      }
      else {
        this.playSequence(this.notes);
      }
    }
  }

}

const singleton = new Sonifier();
export default singleton;
