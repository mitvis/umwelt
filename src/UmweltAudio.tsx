import { OlliDataset, OlliValue } from 'olli';
import { useCallback, useEffect } from 'react';
import useState from 'react-usestateref';
import { ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import Sonifier from './sonification';
import { audioStateToSelectionSpec, selectionSpecToAudioState, tickSequenceAudioState } from './utils/audioState';
import { getBins } from './utils/bin';
import * as Tone from 'tone';
import { nodeIsTextInput } from './utils/events';
import { audioStateToNote } from './utils/sonification/notes';

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

  function getInitialAudioState(audio: ElaboratedAudioSpec[]) {
    return {
      specStates: audio.map(audioSpec => {
        if (audioSpec.traversal !== 'selection') {
          const traversalFields = audioSpec.traversal.interaction.concat(audioSpec.traversal.sequence);
          return Object.fromEntries(traversalFields.map(({field}) => {
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
        const traversalFields = audioSpec.traversal.interaction.concat(audioSpec.traversal.sequence);
        return Object.fromEntries(
          traversalFields
            .map(({field, bin}) => {
              return [field, (
                bin ?
                getBins(field, data) :
                // getDomain(field, selection || data) // TODO umwelt selection can filter the audio domain?
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

  useEffect(() => {
    const currentAudioSpecState = audioState.specStates[audioState.activeState];
    const currentAudioSpecDomain = audioState.specDomains[audioState.activeState];

    if (currentAudioSpecState && Object.keys(currentAudioSpecState).length) {
      const selectionSpec = audioStateToSelectionSpec(currentAudioSpecState, currentAudioSpecDomain);
      console.log('audio ctrl sonifier update', selectionSpec);

      const currentAudioSpec = audio[audioState.activeState];
      const note = audioStateToNote(currentAudioSpec, currentAudioSpecState, currentAudioSpecDomain, data, fields, audioState.playback);

      console.log(note);

      Sonifier.play(note);

      if (shouldUpdateUmwelt) {
        // update umwelt selection on audio state change
        onAudioState(selectionSpec);
        // Sonifier.pingCurrentNotes();
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

  }, [audioState, shouldUpdateUmwelt]);

  useEffect(() => {
    // TODO think about desired behavior of outside selections (should they update the domain?)
    // update audio state on umwelt selection change
    if (selectionCtrl !== 'audio' && selectionSpec) {
      const as = selectionSpecToAudioState(selectionSpec, audio, fields, data);
      if (as.specStates.map(state => Object.keys(state).length).some(n => n >= 1)) {
        // selection spec maps to a valid audio state
        const mergedSpecStates = audioState.specStates.map((state, idx) => {return {...state, ...as.specStates[idx]}});
        setShouldUpdateUmwelt(false);
        setAudioState({
          ...audioState,
          specStates: mergedSpecStates,
          activeState: as.activeState || audioState.activeState,
          ctrl: 'umwelt'
        });
      }
      else {
        // TODO think about desired behavior of outside selections (should they update the domain?)
        console.log('non-audio-ctrl sonifier update', selectionSpec);
        const selection = selectionTest(data, selectionSpec, fields);
        // setAudioDomains(getAudioDomains(audio, selection));
        // const notes = selectionToNotes(selection, audio, fields, data);
        // if (notes.length) {
          // Sonifier.setNotes(notes);
        // }
      }
    }
  }, [selectionSpec, selectionCtrl])

  const onKeyDown = useCallback(async (e) => {
    if (document.activeElement?.closest(".uv-audio") || !nodeIsTextInput(document.activeElement) || document.activeElement.className === 'uv_mute') {
      if (e.key === 'p' && !e.repeat) {
        await Tone.start();

        const tick = () => {
          const nextAudioState = tickSequenceAudioState(audioStateRef.current, audio, fields);

          if (nextAudioState !== audioStateRef.current) {
            setTimeout(tick, nextAudioState.playback.pauseBefore ? Sonifier.pauseDuration * 1000 + Sonifier.defaultDuration * 1000 : Sonifier.defaultDuration * 1000)
          }
          else {
            Sonifier.pause();
          }

          setAudioState(nextAudioState);
        };

        setTimeout(tick, Sonifier.defaultDuration * 1000);
      }
      if (e.key === 'm') {
        setMuted(!muted);
      }
    }
  }, [audio, fields]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);

    // cleanup this component
    return () => {
      window.removeEventListener('keydown', onKeyDown);
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
                audioSpec.traversal.interaction.map(({field, bin}) => {
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
      <pre>
        {JSON.stringify(audioState, null, 2)}
      </pre>
    </div>
  );
}

export default UmweltAudio;



