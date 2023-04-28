import { OlliDataset, OlliValue } from 'olli';
import { useCallback, useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import { ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import { Sonifier } from './sonification';
import { audioStateToSelectionSpec, selectionSpecToAudioState, tickSequenceAudioState, audioStateToNote } from './utils/audioState';
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

  const [audioState, setAudioState, audioStateRef] = useState<AudioState>(getInitialAudioState(audio));
  const [shouldUpdateUmwelt, setShouldUpdateUmwelt] = useState<boolean>(false); // state is propagated upward to umwelt only when set to true
  const [muted, setMuted] = useState(false);
  const sequenceTimeout = useRef<any>();

  function getInitialAudioState(audio: ElaboratedAudioSpec[]) {
    return {
      specStates: audio.map(audioSpec => {
        if (audioSpec.traversal !== 'selection') {
          return Object.fromEntries(audioSpec.traversal.map(({field}) => {
            return [field, 0];
          }));
        }
        return null;
      }),
      specDomains: getAudioDomains(audio),
      activeState: 0,
      ctrl: 'interaction' as AudioCtrl,
      playback: {
        ramp: false,
        pauseBefore: false,
      }
    }
  }

  function getAudioDomains(audio: ElaboratedAudioSpec[], selection?: OlliDataset): AudioDomain[] {
    return audio.map(audioSpec => {
      if (audioSpec.traversal !== 'selection') {
        return Object.fromEntries(
          audioSpec.traversal.map(({field, bin}) => {
            return [field, (
              bin ?
              getBins(field, data) :
              // getDomain(field, selection || data) // TODO umwelt selection can filter the audio domain
              getDomain(field, data)
            )];
          })
        );
      }
      return null;
    });
  }

  useEffect(() => {
    // re-initialize when spec changes
    setShouldUpdateUmwelt(false);
    setAudioState(getInitialAudioState(audio));
    console.log('re-initialized audiostate')
  }, [fields, audio, data])

  useEffect(() => {
    Sonifier.mute(muted)
  }, [muted])

  useEffect(debounce(250, () => {
    const currentAudioSpecState = audioState.specStates[audioState.activeState];
    const currentAudioSpecDomain = audioState.specDomains[audioState.activeState];

    if (currentAudioSpecState && Object.keys(currentAudioSpecState).length) {
      const selectionSpec = audioStateToSelectionSpec(currentAudioSpecState, currentAudioSpecDomain);
      console.log('audio ctrl sonifier update', selectionSpec);

      const currentAudioSpec = audio[audioState.activeState];
      const note = audioStateToNote(currentAudioSpec, currentAudioSpecState, currentAudioSpecDomain, data, fields, audioState.playback);

      console.log(note);

      if (audioState.ctrl === 'interaction') {
        Sonifier.pause();
      }
      else if (audioState.ctrl === 'sequence') {
        Sonifier.play(note);
      }

      if (shouldUpdateUmwelt) {
        // update umwelt selection on audio state change
        onAudioState(selectionSpec);
        // Sonifier.pingCurrentNotes();
        if (audioState.ctrl === 'interaction') {
          Sonifier.ping(note);
        }
      }
    }
    else {
      // empty audio state

      // const notes = selectionToNotes(data, audio, fields, data);
      // console.log('empty audio state sonifier update', notes);
      // if (notes.length) {
        // Sonifier.setNotes(notes);
      // }
    }

  }), [audioState, shouldUpdateUmwelt]);

  useEffect(() => {
    // TODO think about desired behavior of outside selections (should they update the domain?)
    // update audio state on umwelt selection change
    if (selectionCtrl !== 'audio' && selectionSpec) {
      const as = selectionSpecToAudioState(selectionSpec, audio, fields, data);
      console.log('as', as);
      if (as.specStates.map(state => Object.keys(state).length).some(n => n >= 1)) {
        // selection spec maps to a valid audio state
        const selection = selectionTest(data, selectionSpec, fields);
        const mergedSpecStates = audioState.specStates.map((state, idx) => {return {...state, ...as.specStates[idx]}});
        setShouldUpdateUmwelt(false);
        setAudioState({
          ...audioState,
          specStates: mergedSpecStates,
          specDomains: getAudioDomains(audio, selection),
          activeState: as.activeState || audioState.activeState,
          ctrl: 'umwelt'
        });
      }
      // else {
      //   // TODO think about desired behavior of outside selections (should they update the domain?)
      //   console.log('non-audio-ctrl sonifier update', selectionSpec);
      //   const selection = selectionTest(data, selectionSpec, fields);
      //   // setAudioDomains(getAudioDomains(audio, selection));
      //   // const notes = selectionToNotes(selection, audio, fields, data);
      //   // if (notes.length) {
      //     // Sonifier.setNotes(notes);
      //   // }
      // }
    }
  }, [selectionSpec, selectionCtrl])

  function stopSequence() {
    if (sequenceTimeout.current) {
      clearTimeout(sequenceTimeout.current);
    }
    sequenceTimeout.current = null;
    Sonifier.pause();
  }

  const onKeyDown = useCallback(async (e) => {
    await Tone.start();
    if (document.activeElement?.closest(".uv-audio") || !nodeIsTextInput(document.activeElement) || document.activeElement.className === 'uv_mute') {
      if (e.key === 'p' && !e.repeat) {
        if (sequenceTimeout.current) {
          stopSequence();
        }
        else {
          const tick = () => {
            const nextAudioState = tickSequenceAudioState(audioStateRef.current, audio, fields);

            if (nextAudioState !== audioStateRef.current) {
              sequenceTimeout.current = setTimeout(tick, nextAudioState.playback.pauseBefore ? Sonifier.pauseDuration * 1000 + Sonifier.defaultDuration * 1000 : Sonifier.defaultDuration * 1000)
              setAudioState(nextAudioState);
            }
            else {
              stopSequence();
            }
          };

          setAudioState({
            ...audioStateRef.current,
            ctrl: 'sequence',
            playback: {
              ...audioStateRef.current.playback,
              ramp: false
            }
          });
          sequenceTimeout.current = setTimeout(tick, Sonifier.defaultDuration * 1000); // TODO uh oh, what about encoded durations
        }
      }
      if (e.key === 'm') { // this should be global probably
        setMuted(!muted);
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
                audioSpec.traversal.map(({field, bin}) => {
                  const fieldDef = getFieldDef(field, fields);
                  const domain = getDomain(field, data);

                  if (fieldDef?.type === 'quantitative' || fieldDef?.type === 'temporal' || fieldDef?.type === 'ordinal') {
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
                      setShouldUpdateUmwelt(true);
                      stopSequence();
                    };
                    const sliderDomain = bin ? getBins(field, data) : domain;
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
                      setShouldUpdateUmwelt(true);
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
          </div>)
        })
      }
      <label><input type="checkbox" className="uv_mute" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute</label>
      {/* <pre>
        {JSON.stringify(audioState, null, 2)}
      </pre> */}
    </div>
  );
}

export default UmweltAudio;



