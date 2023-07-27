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
    notes.forEach(note => {
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
    });

  }, [notes]);

  useEffect(() => {
    if (audioCtrl.current === 'interaction') {
      const note = notes.find(note => {
        return Object.keys(note.indices).every((field) => {
          return note.indices[field] === specIndices[field]
        });
      });
      if (note) {
        Tone.Transport.seconds = note.elapsed;
        Sonifier.triggerSynth(note, true);
      }
    }
  }, [notes, specIndices]);

  const onKeyDown = useCallback(async (e) => {
    await Tone.start();
    if (document.activeElement?.closest(".uv-audio") || !nodeIsTextInput(document.activeElement) || document.activeElement.className === 'uv_mute') {
      switch (e.key) {
        case 'p':
          if (!e.repeat) {
            if (Tone.Transport.state === 'started') {
              setAudioCtrl('interaction');
              Tone.Transport.pause();
            }
            else {
              setAudioCtrl('sequence');
              Tone.Transport.start();
            }
          }
          break;
        case 'm': // TODO this should be global probably
          setMuted(!muted);
          break;

      }
    }
  }, [audioUnitSpec, fields]);

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
                <button>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button>
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
                <button>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button>
              </div>
            )
          }
        })
      }
      <div>
        {Object.entries(audioUnitSpec.encoding).map(([field, encFieldDef]) => { return (<div>{`${field}: ${encFieldDef.aggregate ? encFieldDef.aggregate + ' ' : ''}${encFieldDef.field}`}</div>) })}
      </div>
      <div>
        <button>Play current</button>
        <button>Play to end</button>
        <button>Play from beginning</button>
      </div>
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



