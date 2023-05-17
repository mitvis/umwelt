import { OlliDataset, OlliValue } from 'olli';
import { useCallback, useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import { ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import { Sonifier, SonifierNote } from './sonification';
import { audioStateToSelectionSpec, generateSequence } from './utils/audioState';
import { getBins } from './utils/bin';
import * as Tone from 'tone';
import { nodeIsTextInput } from './utils/events';
import { debounce } from 'vega';

interface AudioProps {
  audio: ElaboratedAudioSpec[]
  fields: ElaboratedFieldDef[]
  data: OlliDataset,
  onAudioState: (selectionSpec: SelectionSpec) => void;
  selectionSpec: SelectionSpec;
  selectionCtrl: SelectionCtrl;
}

export type AudioSpecIndices = {
  [field: string]: number // maps field to an index in the domain (or binned domain)
}

export type AudioSpecDomains = {
  [field: string]: OlliValue[] | [number, number][]
}

export type SonifierNoteMap = {
  [key: string]: SonifierNote
}

export type AudioCtrl = 'interaction' | 'sequence' | 'umwelt';

function UmweltAudio({audio, fields, data, onAudioState, selectionSpec, selectionCtrl}: AudioProps) {

  const [domainFilter, setDomainFilter] = useState<SelectionSpec>();
  const [specIndices, setSpecIndices] = useState<AudioSpecIndices[]>([]);
  const [specDomains, setSpecDomains] = useState<AudioSpecDomains[]>([]);
  const [activeStateIdx, setActiveStateIdx] = useState<number>(0);
  const [audioCtrl, setAudioCtrl] = useState<AudioCtrl>('umwelt');
  const [notes, setNotes] = useState<SonifierNote[]>([]);
  const [muted, setMuted] = useState(false);

  function getSpecIndices(audio: ElaboratedAudioSpec[]): AudioSpecIndices[] {
    return audio.map(audioSpec => {
      if (audioSpec.traversal !== 'selection') {
        return Object.fromEntries(audioSpec.traversal.map(({field}) => {
          return [field, 0];
        }))
      }
      return null;
    })
  }

  function getSpecDomains(audio: ElaboratedAudioSpec[]): AudioSpecDomains[] {
    return audio.map(audioSpec => {
      if (audioSpec.traversal !== 'selection') {
        return Object.fromEntries(
          audioSpec.traversal.map((fieldDef) => {
            return [fieldDef.field, (
              fieldDef.bin ?
              getBins(fieldDef, data, domainFilter) :
              getDomain(fieldDef, data, domainFilter)
            )];
          })
        )
      }
      return null;
    })
  }

  useEffect(() => {
    Sonifier.mute(muted)
  }, [muted])

  useEffect(() => {
    // re-initialize when spec changes
    setSpecIndices(getSpecIndices(audio));
    setSpecDomains(getSpecDomains(audio));
    setActiveStateIdx(0);
    setAudioCtrl('umwelt');
    setDomainFilter(null);
  }, [fields, audio, data])

  useEffect(() => {
    // update domain filter on external selection change
    if (selectionCtrl !== 'audio' && selectionSpec) {
      setDomainFilter(selectionSpec);
    }
  }, [selectionSpec, selectionCtrl]);

  useEffect(() => {
    if (!specIndices[activeStateIdx]) return;
    // update specStates using domain filter
    const nextDomains = getSpecDomains(audio);
    const selectedValues = Object.fromEntries(
      Object.entries(specIndices[activeStateIdx]).map(([field, index]) => {
        return [field, specDomains[activeStateIdx][field][index]];
      })
    );
    // if a value exists in the new domain, use its new index
    const remappedIndices = specIndices.map((indices, idx) => {
      return Object.fromEntries(
          Object.keys(indices).map((field) => {
            const nextIndex = nextDomains[idx][field].findIndex(v => v === selectedValues[field]);
            return [field, nextIndex === -1 ? 0 : nextIndex];
          })
        );
    })

    setAudioCtrl('umwelt');
    setSpecDomains(nextDomains);
    setSpecIndices(remappedIndices);
  }, [domainFilter]);

  useEffect(debounce(250, () => {
    // emit sonifier state to umwelt
    const currentIndices = specIndices[activeStateIdx];
    const currentDomains = specDomains[activeStateIdx]
    if (currentIndices && Object.keys(currentIndices).length) {
      if (audioCtrl !== 'umwelt') {
        const selectionSpec = audioStateToSelectionSpec(currentIndices, currentDomains);
        onAudioState(selectionSpec);
      }
    }
  // }), [specIndices, specDomains, activeStateIdx, audioCtrl]);
  }), [specIndices, specDomains, activeStateIdx]);


  useEffect(() => {
    // generate sequence from domains
    if (specDomains[activeStateIdx]) {
      const notes = generateSequence(audio[activeStateIdx], specDomains[activeStateIdx], data);
      setNotes(notes);
    }
  }, [specDomains, activeStateIdx]);

  useEffect(() => {
    // schedule notes in transport
    Sonifier.resetTransport();
    notes.forEach(note => {
      Tone.Transport.schedule(() => {
        // play note
        Sonifier.noteToState(note);
        Sonifier.triggerSynth(note);
        console.log('triggerSynth')

        setAudioCtrl('sequence');
        setSpecIndices(specIndices.map((indices, idx) => {
          if (idx === activeStateIdx) {
            return note.indices;
          }
          return indices;
        }));
      }, note.elapsed)

      if (note.pauseAfter) {
        Tone.Transport.schedule(() => {
          // release synth
          Sonifier.releaseSynth();
        }, note.elapsed + note.duration)
      }
    });

    console.log('transport');
  }, [notes]);

  useEffect(() => {
    if (audioCtrl !== 'sequence') {
      Tone.Transport.pause();
      const currentIndices = specIndices[activeStateIdx];
      const note = notes.find(note => {
        return Object.keys(note.indices).every((field) => {
          return note.indices[field] === currentIndices[field]
        });
      });
      if (note) {
        Tone.Transport.seconds = note.elapsed;
        console.log('transport position', note.elapsed)
      }
    }
  }, [notes, audioCtrl, specIndices, activeStateIdx]);

  const onKeyDown = useCallback(async (e) => {
    await Tone.start();
    if (document.activeElement?.closest(".uv-audio") || !nodeIsTextInput(document.activeElement) || document.activeElement.className === 'uv_mute') {
      switch (e.key) {
        case 'p':
          if (!e.repeat) {
            if (Tone.Transport.state === 'started') {
              // Sonifier.resetTransport();
              Tone.Transport.pause();
            }
            else {
              Tone.Transport.start();
            }
          }
          break;
        case 'm': // TODO this should be global probably
          setMuted(!muted);
          break;

      }
    }
  }, [audio, fields]);

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
    return specIndices?.every(indices => {
      if (indices) {
        return Object.keys(indices).every(field => getFieldDef(field, fields));
      }
      return true;
    })
  }

  if (!audioStateFieldsAreCurrent()) {
    return <div className="uv-audio"></div>;
  }

  return (
    <div className="uv-audio">
      {
        audio.map((audioSpec, audioSpecIdx) => {
          if (audioSpec.traversal === 'selection') return null;
          return (
            <div key={audioSpecIdx} className="audio-spec">
              {
                audioSpec.traversal.map((fieldDef) => {
                  const field = fieldDef.field;
                  const domain = getDomain(fieldDef, data, domainFilter);

                  if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal') {
                    const id = `${field}-slider`;
                    const onchange = (e) => {
                      const selectedIdx = Number(e.target.value);
                      setAudioCtrl('interaction');
                      setActiveStateIdx(audioSpecIdx);
                      setSpecIndices((specIndices) => {
                        return specIndices.map((indices, idx) => {
                          if (idx === audioSpecIdx) {
                            return {
                              ...indices,
                              [field]: selectedIdx
                            }
                          }
                          return indices;
                        })
                      });
                    };
                    const sliderDomain = fieldDef.bin ? getBins(fieldDef, data, domainFilter) : domain;
                    return (
                      <div key={field}>
                        <label htmlFor={id}>{field}</label>
                        <input aria-valuetext={field} onChange={onchange} id={id} type="range" min="0" max={sliderDomain.length - 1} value={specIndices?.[audioSpecIdx]?.[field]}></input>
                      </div>
                    );
                  }
                  else {
                    const id = `${field}-select`;
                    const onchange = (e) => {
                      setAudioCtrl('interaction');
                      setActiveStateIdx(audioSpecIdx);
                      setSpecIndices((specIndices) => {
                        return specIndices.map((indices, idx) => {
                          if (idx === audioSpecIdx) {
                            return {
                              ...indices,
                              [field]: e.target.selectedIndex
                            }
                          }
                          return indices;
                        })
                      });
                    }
                    return (
                      <div key={field}>
                        <label htmlFor={id}>{field}</label>
                        <select onChange={onchange} id={id} value={String(domain[specIndices?.[audioSpecIdx]?.[field]])}>
                          {domain.map(val => {
                            return <option key={String(val)} value={String(val)}>{String(val)}</option>
                          })}
                        </select>
                      </div>
                    )
                  }
                })
            }
            <div>{Object.entries(audioSpec.encoding).map(([field, encFieldDef]) => { return (<div>{`${field}: ${encFieldDef.field}`}</div>) })}</div>
          </div>)
        })
      }
      <label><input type="checkbox" className="uv_mute" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute</label>
      <pre>
        {selectionCtrl}
      </pre>
      <pre>
        {JSON.stringify(selectionSpec, null, 2)}
      </pre>
    </div>
  );
}

export default UmweltAudio;



