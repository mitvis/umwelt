import { OlliDataset, OlliValue } from 'olli';
import { useCallback, useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import { ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import { Sonifier } from './sonification';
import { audioStateToSelectionSpec, selectionSpecToAudioState, audioStateToNote, generateSequence } from './utils/audioState';
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

export type AudioSpecState = {
  [field: string]: number // maps field to an index in the domain (or binned domain)
};

export type AudioDomain = {
  [field: string]: OlliValue[] | [number, number][]
}

export type AudioCtrl = 'interaction' | 'sequence' | 'umwelt';

export type AudioPlaybackConfig = {
  ramp: boolean, // interpolate the note?
  pauseBefore: boolean // just ended a sequence? i.e. pause before playing this note
}

export type AudioState = {
  specStates: AudioSpecState[],
  specDomains: AudioDomain[],
  activeState: number // index of active audio spec
  ctrl: AudioCtrl
  playback: AudioPlaybackConfig
}

function UmweltAudio({audio, fields, data, onAudioState, selectionSpec, selectionCtrl}: AudioProps) {

  const [_, setDomainFilter, domainFilterRef] = useState<SelectionSpec>();
  const [audioState, setAudioState, audioStateRef] = useState<AudioState>(getInitialAudioState(audio, domainFilterRef.current));
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    Sonifier.mute(muted)
  }, [muted])

  useEffect(() => {
    // re-initialize when spec changes
    setAudioState(getInitialAudioState(audio, domainFilterRef.current));
  }, [fields, audio, data])

  function getInitialAudioState(audio: ElaboratedAudioSpec[], domainFilter: SelectionSpec) {
    return {
      specStates: getSpecStates(audio),
      specDomains: getAudioDomains(audio, domainFilter),
      activeState: 0,
      ctrl: 'umwelt' as AudioCtrl,
      playback: {
        ramp: false,
        pauseBefore: false,
      }
    }
  }

  function getSpecStates(audio: ElaboratedAudioSpec[]): AudioSpecState[] {
    return audio.map(audioSpec => {
      if (audioSpec.traversal !== 'selection') {
        return Object.fromEntries(audioSpec.traversal.map(({field}) => {
          return [field, 0];
        }));
      }
      return null;
    })
  }

  function getAudioDomains(audio: ElaboratedAudioSpec[], domainFilter: SelectionSpec): AudioDomain[] {
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
        );
      }
      return null;
    });
  }

  useEffect(() => {
    // update domain filter on external selection change
    if (selectionCtrl !== 'audio' && selectionSpec) {
      setDomainFilter(selectionSpec);

      const nextAudioDomains = getAudioDomains(audio, domainFilterRef.current);
      const nextSpecStates = getSpecStates(audio).map((specState, audioIdx) => {
        const currentAudioSpecState = audioState.specStates[audioIdx];
        const currentAudioSpecDomain = audioState.specDomains[audioIdx];
        const fieldValues = Object.fromEntries(
          Object.entries(currentAudioSpecState).map(([field, index]) => {
            return [field, currentAudioSpecDomain[field][index]];
          })
        );
        // if the current values exist in the next domain, update their indices
        return Object.fromEntries(
          Object.entries(specState).map(([field, _]) => {
            const nextIndex = nextAudioDomains[audioIdx][field].findIndex(v => v === fieldValues[field]);
            return [field, nextIndex === -1 ? 0 : nextIndex];
          })
        );
      });
      const nextAudioState: AudioState = {
        ...audioState,
        specStates: nextSpecStates,
        specDomains: nextAudioDomains,
        ctrl: 'umwelt'
      };

      setAudioState(nextAudioState);
    }
  }, [selectionSpec, selectionCtrl]);

  useEffect(debounce(250, () => {
    const currentAudioSpecState = audioState.specStates[audioState.activeState];
    const currentAudioSpecDomain = audioState.specDomains[audioState.activeState];

    if (currentAudioSpecState && Object.keys(currentAudioSpecState).length) {
      if (audioState.ctrl !== 'umwelt') {
        const selectionSpec = audioStateToSelectionSpec(currentAudioSpecState, currentAudioSpecDomain);
        onAudioState(selectionSpec);
      }
    }

  }), [audioState]);

  const onKeyDown = useCallback(async (e) => {
    await Tone.start();
    if (document.activeElement?.closest(".uv-audio") || !nodeIsTextInput(document.activeElement) || document.activeElement.className === 'uv_mute') {
      switch (e.key) {
        case 'p':
          if (!e.repeat) {
            const notes = generateSequence(audioState, audio, data);
            if (Tone.Transport.state === 'started') {
              Sonifier.resetTransport();
              Sonifier.releaseSynth();
            }
            else {
              Sonifier.resetTransport();
              let elapsedTime = 0;
              notes.forEach(note => {
                Tone.Transport.schedule(() => {
                  // play note
                  Sonifier.noteToState(note);
                  Sonifier.triggerSynth(note);
                  console.log(note);
                  setAudioState({
                    ...audioStateRef.current,
                    specStates: audioStateRef.current.specStates.map((state, idx) => {
                      if (idx === audioStateRef.current.activeState) {
                        return note.state;
                      }
                      return state;
                    }),
                    ctrl: 'sequence'
                  })
                }, elapsedTime)

                if (note.pauseAfter) {
                  Tone.Transport.schedule(() => {
                    // release synth
                    Sonifier.releaseSynth();
                  }, elapsedTime + note.duration)
                }

                // increment elapsed time
                elapsedTime += note.duration + note.pauseAfter;
              });
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
    return audioState.specStates.every(audioSpecState => {
      if (audioSpecState) {
        return Object.keys(audioSpecState).every(field => getFieldDef(field, fields));
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
                  const domain = getDomain(fieldDef, data, domainFilterRef.current);

                  if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal') {
                    const id = `${field}-slider`;
                    const onchange = (e) => {
                      const idx = Number(e.target.value);
                      const specStates = [...audioState.specStates];
                      specStates[audioSpecIdx] = {
                        ...specStates[audioSpecIdx],
                        [field]: idx
                      }
                      setAudioState({
                        ...audioState,
                        activeState: audioSpecIdx,
                        specStates,
                        ctrl: 'interaction',
                        playback: {
                          pauseBefore: false,
                          ramp: true
                        }
                      });
                    };
                    const sliderDomain = fieldDef.bin ? getBins(fieldDef, data, domainFilterRef.current) : domain;
                    return (
                      <div key={field}>
                        <label htmlFor={id}>{field}</label>
                        <input aria-valuetext={field} onChange={onchange} id={id} type="range" min="0" max={sliderDomain.length - 1} value={audioState.specStates?.[audioSpecIdx]?.[field]}></input>
                      </div>
                    );
                  }
                  else {
                    const id = `${field}-select`;
                    const onchange = (e) => {
                      const specStates = [...audioState.specStates];
                      specStates[audioSpecIdx] = {
                        ...specStates[audioSpecIdx],
                        [field]: e.target.selectedIndex
                      }
                      setAudioState({
                        ...audioState,
                        activeState: audioSpecIdx,
                        specStates,
                        ctrl: 'interaction',
                        playback: {
                          pauseBefore: false,
                          ramp: false
                        }
                      });
                    }
                    return (
                      <div key={field}>
                        <label htmlFor={id}>{field}</label>
                        <select onChange={onchange} id={id} value={String(domain[audioState.specStates?.[audioSpecIdx]?.[field]])}>
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
      {/* <pre>
        {selectionCtrl}
      </pre>
      <pre>
        {JSON.stringify(selectionSpec, null, 2)}
      </pre>
      <pre>
        {JSON.stringify(audioState, null, 2)}
      </pre> */}
    </div>
  );
}

export default UmweltAudio;



