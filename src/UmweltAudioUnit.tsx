import { OlliDataset, OlliValue } from 'olli';
import { useCallback, useEffect } from 'react';
import useState from 'react-usestateref';
import { AudioUnitSpec, FieldDef, UmweltPredicate } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { SelectionCtrl } from './Umwelt';
import { Sonifier, SonifierNote } from './utils/sonifier';
import { audioStateToPredicate, generateSequence } from './utils/audioState';
import { getBins } from './utils/bin';
import * as Tone from 'tone';
import { nodeIsTextInput } from './utils/events';
import { debounce } from 'vega';
import { fmtValue } from './utils/values';
import { FieldEqualPredicate } from 'vega-lite/src/predicate';

interface AudioUnitProps {
  audioUnitSpec: AudioUnitSpec,
  fields: FieldDef[]
  data: OlliDataset,
  onAudioState: (selection: UmweltPredicate) => void;
  selection: UmweltPredicate;
  selectionCtrl: SelectionCtrl;
  muted: boolean;
  setMuted: any;
}

export type AudioUnitFieldSelectedIndices = {
  [field: string]: number // maps field to an index in the domain (or binned domain)
}

export type AudioUnitFieldDomains = {
  [field: string]: OlliValue[] | [number, number][] // maps field to its domain (or binned domain)
}

export type SonifierNoteMap = {
  [key: string]: SonifierNote
}

export type AudioCtrl = 'interaction' | 'sequence' | 'umwelt';

const UmweltAudioUnit = ({audioUnitSpec, fields, data, onAudioState, selection, selectionCtrl, muted, setMuted}: AudioUnitProps) => {

  const [domainFilter, setDomainFilter] = useState<UmweltPredicate>();
  const [specIndices, setSpecIndices] = useState<AudioUnitFieldSelectedIndices>(getFieldSelectedIndices(audioUnitSpec));
  const [specDomains, setSpecDomains] = useState<AudioUnitFieldDomains>(getFieldDomains(audioUnitSpec));
  const [_, setAudioCtrl, audioCtrl] = useState<AudioCtrl>('umwelt');
  const [notes, setNotes] = useState<SonifierNote[]>([]);

  function getFieldSelectedIndices(audioUnitSpec: AudioUnitSpec): AudioUnitFieldSelectedIndices {
    return Object.fromEntries(audioUnitSpec.traversal.map(({field}) => {
      return [field, 0];
    }))
  }

  function getFieldDomains(audioUnitSpec: AudioUnitSpec): AudioUnitFieldDomains {
    return Object.fromEntries(
      audioUnitSpec.traversal.map((fieldDef) => {
        return [fieldDef.field, (
          fieldDef.bin ?
          getBins(fieldDef, data, domainFilter) :
          getDomain(fieldDef, data, domainFilter)
        )];
      })
    )
  }

  useEffect(() => {
    Sonifier.mute(muted)
  }, [muted])


  const playCurrentValue = useCallback(() => {
    const note = notes.find(note => {
      return Object.keys(note.indices).every((field) => {
        return note.indices[field] === specIndices[field]
      });
    });
    if (note) {
      Tone.Transport.seconds = note.elapsed;
      Sonifier.triggerSynth(note, true);
    }
  }, [notes, specIndices]);

  const playFromBeginning = useCallback(() => {
    setAudioCtrl('sequence');

    const startNote = notes.find(note => {
      return Object.keys(note.indices).every((field) => {
        return note.indices[field] === 0
      });
    });
    const endNote = notes.find(note => {
      return Object.keys(note.indices).every((field) => {
        return note.indices[field] === specDomains[field].length - 1
      });
    });
    if (startNote && endNote) {
      Tone.Transport.seconds = startNote.elapsed;
      Tone.Transport.scheduleOnce(() => {
        console.log('scheduleOnce');
        Tone.Transport.pause();
      }, endNote.elapsed + endNote.duration);
      Tone.Transport.start();
    }

  }, [notes, setAudioCtrl, specDomains]);

  const play = useCallback(() => {
    if (notes.length && Tone.Transport.state !== 'started' && Tone.Transport.seconds > notes[notes.length - 1].elapsed) {
      playFromBeginning();
    }
    else {
      setAudioCtrl('sequence');
      Tone.Transport.start();
    }
  }, [notes, playFromBeginning, setAudioCtrl]);

  const pause = useCallback(() => {
    setAudioCtrl('interaction');
    Tone.Transport.pause();
  }, [setAudioCtrl]);

  const playPredicate = useCallback((predicate: FieldEqualPredicate) => {
    setDomainFilter(predicate);
    // playFromBeginning();
    // const fieldIndex = specDomains[predicate.field].findIndex(v => v === predicate.equal);
    // const predNotes = notes.filter(note => {
    //   return note.indices[predicate.field] === fieldIndex;
    // });
    // debugger;
    // if (predNotes.length) {
    //   setAudioCtrl('sequence');
    //   predNotes.forEach(note => {
    //     Tone.Transport
    //   });
    // }
  }, [notes]);

  useEffect(() => {
    // re-initialize when spec changes
    setAudioCtrl('umwelt');
    setDomainFilter(null);
    setSpecIndices(getFieldSelectedIndices(audioUnitSpec));
    setSpecDomains(getFieldDomains(audioUnitSpec));
  }, [audioUnitSpec])

  useEffect(() => {
    // update domain filter on external selection change
    if (selectionCtrl !== 'audio' && selection) {
      setDomainFilter(selection);
    }
  }, [selection, selectionCtrl]);

  useEffect(() => {
    console.log('domainFilter', new Date().getTime())
    // update specStates using domain filter
    const nextDomains = getFieldDomains(audioUnitSpec);
    const selectedValues = Object.fromEntries(
      Object.entries(specIndices).map(([field, index]) => {
        return [field, specDomains[field][index]];
      })
    );
    // if a value exists in the new domain, use its new index
    const remappedIndices = Object.fromEntries(
      Object.keys(specIndices).map((field) => {
        const nextIndex = nextDomains[field]?.findIndex(v => v === selectedValues[field]) || -1;
        return [field, nextIndex === -1 ? 0 : nextIndex];
      })
    )

    setAudioCtrl('umwelt');
    setSpecDomains(nextDomains);
    setSpecIndices(remappedIndices);
  }, [domainFilter]);

  useEffect(debounce(250, () => {
    // emit sonifier state to umwelt
    if (specIndices && Object.keys(specIndices).length) {
      if (audioCtrl.current !== 'umwelt') {
        const pred = audioStateToPredicate(specIndices, specDomains);
        onAudioState(pred);
      }
    }
  }), [specIndices, specDomains]);

  useEffect(() => {
    // generate sequence from domains
    const notes = generateSequence(audioUnitSpec, specDomains, fields, data);
    setNotes(notes);
  }, [specDomains]);

  useEffect(() => {
    // schedule notes in transport
    Sonifier.resetTransport();
    notes.forEach((note, idx) => {
      Tone.Transport.schedule(() => {
        if (audioCtrl.current === 'sequence') {
          // play note
          Sonifier.noteToState(note);
          Sonifier.triggerSynth(note);

          setSpecIndices(note.indices);
        }
      }, note.elapsed)

      if (note.pauseAfter) {
        Tone.Transport.schedule(() => {
          // release synth
          Sonifier.releaseSynth();
        }, note.elapsed + note.duration)
      }

      if (idx === notes.length - 1) {
        Tone.Transport.schedule(() => {
          Tone.Transport.pause();
        }, note.elapsed + note.duration)
      }
    });
    console.log('done updating transport', new Date().getTime())
  }, [notes]);

  useEffect(() => {
    if (audioCtrl.current === 'interaction') {
      playCurrentValue();
    }
  }, [notes, specIndices]);

  const onKeyDown = useCallback(async (e) => {
    await Tone.start();
    if (document.activeElement?.closest(".audio-container") || !nodeIsTextInput(document.activeElement) || document.activeElement.className === 'uv_mute') {
      switch (e.key) {
        case 'P':
          if (Tone.Transport.state === 'started') {
            pause();
          }
          else {
            play();
          }
        break;
        case 'p':
          if (!e.repeat) {
            if (Tone.Transport.state === 'started') {
              pause();
            }
            else {
              playCurrentValue();
            }
          }
          break;
        case 'm': // TODO this should be global probably
          setMuted(!muted);
          break;

      }
    }
  }, [muted, pause, play, playCurrentValue, setMuted]);

  const onClick = useCallback(async (e) => {
    await Tone.start();
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('click', onClick);

    // cleanup this component
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
    };
  });

  function audioStateFieldsAreCurrent() {
    return Object.keys(specIndices).every(field => getFieldDef(field, fields));
  }

  if (!audioStateFieldsAreCurrent()) {
    return <div className="audio-spec"></div>;
  }

  return (
    <div className="audio-spec">
      {
        audioUnitSpec.traversal.map((traversalFieldDef) => {
          const field = traversalFieldDef.field;
          const fieldDef = getFieldDef(field, fields);
          const domain = specDomains[field];

          if (domain.length === 1) {
            const id = `${field}-value`;
            return (
              <div key={field}>
                <label htmlFor={id}>{field}</label>
                <input id={id} type="text" readOnly={true} value={fmtValue(domain[specIndices?.[field]], traversalFieldDef)}></input>
                <button onClick={() => playPredicate({field, equal: domain[specIndices?.[field]]})}>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button>
              </div>
            );
          }

          if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal') {
            const id = `${field}-slider`;
            const onchange = (e) => {
              setAudioCtrl('interaction');
              Tone.Transport.pause();
              const selectedIdx = Number(e.target.value);
              setSpecIndices((specIndices) => {
                return {
                  ...specIndices,
                  [field]: selectedIdx
                };
              });
            };
            return (
              <div key={field}>
                <label htmlFor={id}>{field}</label>
                <input aria-valuetext={field} onChange={onchange} id={id} type="range" min="0" max={domain.length - 1} value={specIndices?.[field]}></input>
                <button onClick={() => playPredicate({field, equal: domain[specIndices?.[field]]})}>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button>
              </div>
            );
          }
          else {
            const id = `${field}-select`;
            const onchange = (e) => {
              setAudioCtrl('interaction');
              Tone.Transport.pause();
              setSpecIndices((specIndices) => {
                return {
                  ...specIndices,
                  [field]: e.target.selectedIndex
                }
              });
            }
            return (
              <div key={field}>
                <label htmlFor={id}>{field}</label>
                <select onChange={onchange} id={id} value={String(domain[specIndices?.[field]])}>
                  {domain.map(val => {
                    return <option key={String(val)} value={String(val)}>{String(val)}</option>
                  })}
                </select>
                <button onClick={() => playPredicate({field, equal: domain[specIndices?.[field]]})}>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button>
              </div>
            )
          }
        })
      }
      <div>
        {Object.entries(audioUnitSpec.encoding).map(([field, encFieldDef]) => { return (<div>{`${field}: ${encFieldDef.aggregate ? encFieldDef.aggregate + ' ' : ''}${encFieldDef.field}`}</div>) })}
      </div>
      {
        Tone.Transport.state === 'started' ? <button onClick={pause}>Pause</button> : (
          <div>
            <button onClick={playCurrentValue}>Current value</button>
            <button onClick={play}>Play</button>
            <button onClick={playFromBeginning}>Play from beginning</button>
          </div>
        )
      }
      <pre>
        Transport: {Tone.Transport.state} {Tone.Transport.seconds}
      </pre>
      <pre>
        {JSON.stringify(audioUnitSpec, null, 2)}
      </pre>
      <pre>
        {JSON.stringify(specDomains, null, 2)}
      </pre>
    </div>
  )
}

export default UmweltAudioUnit;



