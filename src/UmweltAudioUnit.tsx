import { OlliDataset, OlliValue } from 'olli';
import { useCallback, useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import { AudioUnitSpec, FieldDef, NONE, UmweltPredicate } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { SelectionCtrl } from './Umwelt';
import { Sonifier, SonifierNote } from './utils/sonifier';
import { assignNoteSpeakBefore, assignNoteTimings, audioStateToPredicate, generateSequence } from './utils/audioState';
import { getBins } from './utils/bin';
import * as Tone from 'tone';
import { nodeIsTextInput } from './utils/events';
import { debounce } from 'vega';
import { clamp, fmtValue } from './utils/values';
import { predicateToDescription, predicateToFields, selectionTest } from './utils/selection';
import { DEFAULT_RANGES, scale } from './utils/scales';

interface AudioUnitProps {
  audioUnitSpec: AudioUnitSpec,
  fields: FieldDef[]
  data: OlliDataset,
  onAudioState: (selection: UmweltPredicate) => void;
  selection: UmweltPredicate;
  selectionCtrl: SelectionCtrl;
  muted: boolean;
  setMuted: any;
  readAudioAxis: boolean;
  speechRate: number;
  activeUnitRef: any;
  setActiveUnit: any;
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
export type AudioPlaybackMode = 'current' | 'onward' | 'beginning' | 'count' | string;

const UmweltAudioUnit = ({audioUnitSpec, fields, data, onAudioState, selection, selectionCtrl, muted, setMuted, readAudioAxis, speechRate, activeUnitRef, setActiveUnit}: AudioUnitProps) => {

  const getFieldSelectedIndices = (audioUnitSpec: AudioUnitSpec): AudioUnitFieldSelectedIndices => {
    return Object.fromEntries(audioUnitSpec.traversal.map(({field}) => {
      return [field, 0];
    }))
  }

  const getFieldDomains = (audioUnitSpec: AudioUnitSpec, predicate?: UmweltPredicate): AudioUnitFieldDomains => {
    return Object.fromEntries(
      audioUnitSpec.traversal.map((fieldDef) => {
        if (getFieldDef(fieldDef.field, fields)) {
          return [fieldDef.field, (
            fieldDef.bin ?
            getBins(fieldDef.field, data, fields, predicate) :
            getDomain(fieldDef, data, predicate)
          )];
        }
        return null;
      }).filter(x => x)
    )
  }

  const [domainFilter, setDomainFilter] = useState<UmweltPredicate>();
  const [specIndices, setSpecIndices] = useState<AudioUnitFieldSelectedIndices>(getFieldSelectedIndices(audioUnitSpec));
  const [specDomains, setSpecDomains] = useState<AudioUnitFieldDomains>(getFieldDomains(audioUnitSpec));
  const [_, setAudioCtrl, audioCtrl] = useState<AudioCtrl>('interaction');
  const [notes, setNotes] = useState<SonifierNote[]>([]);
  const [playbackMode, setPlaybackMode] = useState<AudioPlaybackMode>('beginning');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const playbackModeElement = useRef<HTMLSelectElement>();

  const notesToTransport = (notes: SonifierNote[]) => {
    Sonifier.resetTransport();
    Sonifier.releaseSynth();
    if (!notes.length) {
      Tone.Transport.schedule(() => {
        if (audioCtrl.current === 'sequence') {
          Sonifier.triggerSynth({noise: true, duration: 0.5, elapsed: 0, indices: {}}, true);
        }
      }, 0);
      Tone.Transport.schedule(() => {
        pause();
      }, 0.5);
    }
    notes.forEach((note, idx) => {
      Tone.Transport.schedule(() => {
        if (audioCtrl.current === 'sequence') {
          if (note.speakBefore && readAudioAxis && !muted) {
            Tone.Transport.pause();
            setSpecIndices(note.indices);
            Sonifier.releaseSynth();
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(note.speakBefore);
            utterance.rate = speechRate;
            utterance.onend = () => {
              if (audioCtrl.current === 'sequence') {
                Tone.Transport.start();
                // play note
                Sonifier.triggerSynth(note);
                setSpecIndices(note.indices);
              }
            }
            speechSynthesis.speak(utterance);
          }
          else {
            // play note
            Sonifier.triggerSynth(note);
            setSpecIndices(note.indices);
          }
        }
      }, note.elapsed)

      if (idx === notes.length - 1) {
        Tone.Transport.schedule(() => {
          pause();
        }, note.elapsed + note.duration)
      }
      else if (note.pauseAfter) {
        Tone.Transport.schedule(() => {
          // release synth
          Sonifier.releaseSynth();
        }, note.elapsed + note.duration)
      }

    });
  };

  const beforePlay = () => {
    if (activeUnitRef.current !== audioUnitSpec.name) {
      setActiveUnit(audioUnitSpec.name);
    }
    notesToTransport(notes);
    const note = notes.find(note => {
      return Object.keys(note.indices).every((field) => {
        return note.indices[field] === specIndices[field]
      });
    });
    if (note) {
      Tone.Transport.seconds = note.elapsed;
    }
    else {
      Tone.Transport.seconds = 0;
    }
  }

  const playCurrentValue = useCallback(() => {
    beforePlay();
    const note = notes.find(note => {
      return Object.keys(note.indices).every((field) => {
        return note.indices[field] === specIndices[field]
      });
    });
    if (note) {
      Tone.Transport.seconds = note.elapsed;
      Sonifier.triggerSynth(note, true);
    }
  }, [notes, specIndices, activeUnitRef.current]);

  const playFromBeginning = (doNotReset?: boolean) => {
    if (!doNotReset) {
      beforePlay();
    }
    setAudioCtrl('sequence');
    Tone.Transport.seconds = 0;
    Tone.Transport.start();
  }

  const playCurrentOnward = () => {
    beforePlay();
    if (notes.length && !(Tone.Transport.state === 'started' || speechSynthesis.speaking) && Tone.Transport.seconds > notes[notes.length - 1].elapsed) {
      playFromBeginning();
    }
    else {
      setAudioCtrl('sequence');
      Tone.Transport.start();
    }
  }

  const playPredicate = (field) => {
    beforePlay();
    const predNotes = structuredClone(notes.filter(note => {
      return note.indices[field] === specIndices[field];
    }));
    const originalLastNotePosition = predNotes[predNotes.length - 1].elapsed;
    if (predNotes.length) {
      if (!audioUnitSpec.encoding.duration) {
        predNotes.forEach((note) => {
          note.duration = Math.min(0.5, Sonifier.defaultSequenceDuration / predNotes.length);
        })
      }
      assignNoteSpeakBefore(predNotes, specDomains, fields, data);
      assignNoteTimings(predNotes);
      // temporarily populate transport with predicate notes
      notesToTransport(predNotes);
      const lastNote = predNotes[predNotes.length - 1];
      Tone.Transport.schedule(() => {
        // put the real notes back
        notesToTransport(notes);
        Tone.Transport.seconds = originalLastNotePosition;
        pause();
      }, lastNote.elapsed + lastNote.duration);
      playFromBeginning(true);
    }
  };

  const playCount = useCallback(() => {
    // TODO can we accompish this with encodings?
    beforePlay();
    const count = selectionTest(data, domainFilter).length;
    const countVolume = scale(count, [0, data.length / 2], DEFAULT_RANGES.volume);
    const countNote = {
      elapsed: 0,
      duration: 0.5,
      volume: countVolume,
      indices: specIndices,
    };
    Sonifier.triggerSynth(countNote, true);
  }, [data, domainFilter]);

  const pause = () => {
    setAudioCtrl('interaction');
    Tone.Transport.pause();
    Sonifier.releaseSynth();
    speechSynthesis.cancel();
  }

  const play = () => {
    switch (playbackMode) {
      case 'current':
        playCurrentValue();
        break;
      case 'beginning':
        playFromBeginning();
        break;
      case 'onward':
        playCurrentOnward();
        break;
      case 'count':
        playCount();
        break;
      default:
        playPredicate(playbackMode);
        break;
    }
  }

  useEffect(() => {
    // re-initialize when spec changes
    setSpecIndices(getFieldSelectedIndices(audioUnitSpec));
    setSpecDomains(getFieldDomains(audioUnitSpec));
    setDomainFilter(null);
    setAudioCtrl('umwelt');
  }, [audioUnitSpec, data, fields])

  useEffect(() => {
    // update domain filter on external selection change
    if (selectionCtrl !== 'audio' && selection) {
      setDomainFilter(selection);
    }
  }, [selection, selectionCtrl]);

  useEffect(() => {
    // TODO this is basically a hack to deal with how i did time unit in olli
    if (domainFilter && 'and' in domainFilter) {
      domainFilter.and = domainFilter.and.map(pred => {
        if ('field' in pred && pred.field.endsWith('_year')) {
          return {
            ...pred,
            field: pred.field.substring(0, pred.field.indexOf('_year')),
          }
        }
        return pred;
      })
    }

    // update specStates using domain filter
    if (audioStateIsCurrent()) {
      const nextDomains = getFieldDomains(audioUnitSpec, domainFilter);
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
    }
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
    const notes = generateSequence(audioUnitSpec, specDomains, fields, data, playbackRate);
    setNotes(notes);
  }, [specDomains, audioUnitSpec, playbackRate]);

  useEffect(() => {
    // schedule notes in transport
    notesToTransport(notes);
  }, [notes, speechRate, readAudioAxis, muted]);

  useEffect(() => {
    if (audioCtrl.current === 'interaction') {
      playCurrentValue();
    }
  }, [specIndices]);

  const onKeyDown = useCallback(async (e) => {
    await Tone.start();
    if (document.activeElement?.closest(".audio-container") || !nodeIsTextInput(document.activeElement)) {
      switch (e.key) {
        case 'P':
          playbackModeElement.current?.focus();
          break;
        case 'p':
          if (!e.repeat) {
            if (Tone.Transport.state === 'started' || speechSynthesis.speaking) {
              pause();
            }
            else {
              play();
            }
          }
          break;
        case 'm':
          setMuted(!muted);
          break;

      }
    }
  }, [muted, pause, playCurrentOnward, playCurrentValue, setMuted]);

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

  function audioStateIsCurrent() {
    return Object.keys(specIndices).every(field => getFieldDef(field, fields)) &&
      Object.keys(specDomains).every(field => getFieldDef(field, fields)) &&
      audioUnitSpec.traversal.every(f => getFieldDef(f.field, fields) && specIndices[f.field] !== undefined && specDomains[f.field] !== undefined) && (
        !domainFilter || (domainFilter && predicateToFields(domainFilter).every(field => getFieldDef(field, fields)))
      );
  }

  if (!audioStateIsCurrent()) {
    return <div className="audio-spec"></div>;
  }

  function fromBeginningLabel(): string {
    if (audioUnitSpec.traversal?.length) {
      const outerMostField = audioUnitSpec.traversal[0].field;
      const outerMostFieldDef = getFieldDef(outerMostField, fields);
      const outerDomain = specDomains[outerMostField];
      let label;
      if (!outerDomain.length) {
        if (domainFilter) {
          if ('and' in domainFilter) {
            const predTerm = domainFilter.and.find(pred => 'field' in pred && pred.field === outerMostField);
            if (predTerm && 'field' in predTerm) {
              const {field, ...rest} = predTerm;
              label = Object.values(rest).map((v) => fmtValue(v, getFieldDef(field, fields))).join(',');
            }
          }
          else if ('field' in domainFilter && domainFilter.field === outerMostField) {
            const {field, ...rest} = domainFilter;
            label = Object.values(rest).map((v) => fmtValue(v, getFieldDef(field, fields))).join(',');
          }
          else {
            label = outerMostField;
          }
        }
      }
      else {
        label = fmtValue(outerDomain[0], outerMostFieldDef);
      }
      if (outerDomain.length > 1) {
        label = `${fmtValue(outerDomain[0], outerMostFieldDef)} to ${fmtValue(outerDomain[outerDomain.length - 1], outerMostFieldDef)}`;
      }
      const fieldsToAdd = audioUnitSpec.traversal.filter((_, idx) => idx > 0).map(t => t.field);
      if (domainFilter) {
        if ('and' in domainFilter) {
          domainFilter.and.forEach(pred => {
            if ('field' in pred) {
              if (pred.field !== outerMostField && !fieldsToAdd.includes(pred.field)) {
                fieldsToAdd.push(pred.field);
              }
            }
          });
        }
        else if ('field' in domainFilter && !fieldsToAdd.includes(domainFilter.field)) {
          fieldsToAdd.push(domainFilter.field);
        }
      }
      if (fieldsToAdd.length) {
        label += ` by ${fieldsToAdd.map(field => {
          if (domainFilter) {
            if ('and' in domainFilter) {
              const predTerm = domainFilter.and.find(pred => 'field' in pred && pred.field === field);
              if (predTerm && 'field' in predTerm && getFieldDef(predTerm.field, fields)) {
                return predicateToDescription(predTerm, fields);
              }
            }
            else if ('field' in domainFilter && domainFilter.field === field) {
              return predicateToDescription(domainFilter, fields);
            }
          }
          return `${field}`
        }).join(', ')}`;
      }
      return label;
    }
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
                {/* <button onClick={() => playPredicate(field, domain[specIndices?.[field]])}>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button> */}
              </div>
            );
          }

          if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal') {
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
                <label>
                <span>{(traversalFieldDef.bin ?? fieldDef.bin) ? `binned ` : null}{traversalFieldDef.field}{(traversalFieldDef.timeUnit ?? fieldDef.timeUnit) && traversalFieldDef.timeUnit !== NONE ? ` (${traversalFieldDef.timeUnit ?? fieldDef.timeUnit})` : null}</span>
                  <input aria-live="assertive" aria-valuetext={fmtValue(domain[specIndices?.[field]], traversalFieldDef)} onChange={onchange} type="range" min="0" max={domain.length - 1} value={specIndices?.[field]}></input>
                </label>
                {/* <button onClick={() => playPredicate(field, domain[specIndices?.[field]])}>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button> */}
              </div>
            );
          }
          else {
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
                <label>
                <span>{(traversalFieldDef.bin ?? fieldDef.bin) ? `binned ` : null}{traversalFieldDef.field}{(traversalFieldDef.timeUnit ?? fieldDef.timeUnit) && traversalFieldDef.timeUnit !== NONE ? ` (${traversalFieldDef.timeUnit ?? fieldDef.timeUnit})` : null}</span>
                  <select onChange={onchange} value={String(domain[specIndices?.[field]])}>
                    {domain.map(val => {
                      return <option key={String(val)} value={String(val)}>{String(val)}</option>
                    })}
                  </select>
                </label>
                {/* <button onClick={() => playPredicate(field, domain[specIndices?.[field]])}>Play {fmtValue(domain[specIndices?.[field]], traversalFieldDef)}</button> */}
              </div>
            )
          }
        })
      }
      <div>
        {Object.entries(audioUnitSpec.encoding).map(([propName, encFieldDef]) => {
          const fieldDef = getFieldDef(encFieldDef.field, fields);
          if (fieldDef) {
            return (
              <div key={propName}>
                {propName}: {(encFieldDef.aggregate ?? fieldDef.aggregate) === 'count' ? <span>count</span> : <span>{(encFieldDef.aggregate ?? fieldDef.aggregate) && encFieldDef.aggregate as any !== NONE ? `${encFieldDef.aggregate ?? fieldDef.aggregate} ` : null}{encFieldDef.field}</span>}
              </div>
            )
          }
          return null;
        })}
      </div>
      <div>
        <label>
          Playback rate <input type="number" min="0.1" max="2" value={playbackRate} step={0.1} id="rate" onChange={(e) => setPlaybackRate(clamp(Number(e.target.value), 0.1, 2))} />x
        </label>
      </div>
      <div>
        <label>
          Playback order
          <select ref={playbackModeElement} value={playbackMode} onChange={(e) => setPlaybackMode(e.target.value)}>
            {/* <option value="current">Current</option> */}
            {/* <option value="onward">From current onward</option> */}
            {audioUnitSpec.traversal.length ? <option value="beginning">{fromBeginningLabel()}</option> : null}
            {
              audioUnitSpec.traversal.map((traversalFieldDef) => {
                const field = traversalFieldDef.field;
                const domain = specDomains[field];
                const value = domain[specIndices?.[field]];
                if (value !== undefined) {
                  const otherFields = audioUnitSpec.traversal.filter(def => {
                    const selection = selectionTest(data, {and: [domainFilter, {field, equal: value}]});
                    const uniqueValues = new Set(selection.map(d => d[def.field]));
                    return def.field !== field && uniqueValues.size > 1;
                  }).map(traversalFieldDef => traversalFieldDef.field);

                  if (otherFields.length) {
                    return (
                      <option key={field} value={field}>{fmtValue(value, traversalFieldDef)} by {otherFields.join(', ')}</option>
                    );
                  }
                }
              })
            }
            {/* <option value="count">Count of selected</option> */}
          </select>
        </label>
        {
          Tone.Transport.state === 'started' || speechSynthesis.speaking ?
              <button className='uv-audio-play-pause' onClick={pause}>Pause</button> :
              <button className='uv-audio-play-pause' onClick={play}>Play</button>
        }
        {/* <button onClick={playCurrentValue}>Current value</button>
        <button onClick={play}>Play</button>
        <button onClick={playFromBeginning}>Play from beginning</button> */}
      </div>
      {/* <pre>
        Transport: {Tone.Transport.state} {Tone.Transport.seconds}
      </pre>
      <pre>
        {audioCtrl.current}
      </pre>
      <pre>
        {JSON.stringify(notes, null, 2)}
      </pre> */}
      {/*
      <pre>
        {JSON.stringify(audioUnitSpec, null, 2)}
      </pre> */}
      {/* <pre>
        {JSON.stringify(specDomains, null, 2)}
      </pre> */}
      {/* <pre>
        {JSON.stringify(specIndices, null, 2)}
      </pre> */}
      {/* <pre>
        {playbackMode}
      </pre> */}
    </div>
  )
}

export default UmweltAudioUnit;



