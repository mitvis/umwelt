import { OlliDataset, OlliValue } from 'olli';
import { useEffect, useState } from 'react';
import { ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from './grammar';
import { getDomain, getFieldDef } from './utils/data';
import { selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import Sonifier from './sonification';
import { audioStateToSelectionSpec, selectionSpecToAudioState } from './utils/audioState';
import { getBins } from './utils/bin';

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

export type AudioState = {
  specStates: AudioSpecState[],
  specDomains: AudioDomain[],
  activeState: number // index of active audio spec
  ctrl: AudioCtrl
}

function UmweltAudio({audio, fields, data, onAudioState, selectionSpec, selectionCtrl}: AudioProps) {

  const [audioState, setAudioState] = useState<AudioState>(getInitialAudioState(audio));
  const [shouldUpdateUmwelt, setShouldUpdateUmwelt] = useState<boolean>(false); // state is propagated upward to umwelt only when set to true

  function getInitialAudioState(audio: ElaboratedAudioSpec[]) {
    return {
      specStates: audio.map(audioSpec => {
        if (audioSpec.traversal !== 'selection') {
          return Object.fromEntries(audioSpec.traversal.interaction.map(({field}) => {
            return [field, 0];
          }));
        }
        return null;
      }),
      specDomains: getAudioDomains(audio),
      activeState: 0,
      ctrl: 'interaction' as AudioCtrl
    }
  }

  function getAudioDomains(audio: ElaboratedAudioSpec[], selection?: OlliDataset): AudioDomain[] {
    return audio.map(audioSpec => {
      if (audioSpec.traversal !== 'selection') {
        return Object.fromEntries(
          audioSpec.traversal.interaction
            .concat(audioSpec.traversal.sequence)
            .map(({field, bin}) => {
              return [field, (
                bin ?
                getBins(field, data) :
                // getDomain(field, selection || data) // umwelt selection can filter the audio domain
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
    const currentAudioSpecState = audioState.specStates[audioState.activeState];
    const currentAudioSpecDomain = audioState.specDomains[audioState.activeState];

    // update sonifier state on audio state change
    if (currentAudioSpecState && Object.keys(currentAudioSpecState).length) {
      const selectionSpec = audioStateToSelectionSpec(currentAudioSpecState, currentAudioSpecDomain);
      console.log('audio ctrl sonifier update', selectionSpec);
      // const notes = audioCtrlSelectionToNotes(selectionSpec, audio, fields, data);
      // Sonifier.setNotes(notes);

      if (shouldUpdateUmwelt) {
        // update umwelt selection on audio state change
        onAudioState(selectionSpec);
        // Sonifier.pingCurrentNotes();
      }
    }
    else {
      // const notes = selectionToNotes(data, audio, fields, data);
      // console.log('empty audio state sonifier update', notes);
      // if (notes.length) {
        // Sonifier.setNotes(notes);
      // }
    }

  }, [audioState, shouldUpdateUmwelt]);

  useEffect(() => {
    // update audio state on umwelt selection change
    if (selectionCtrl !== 'audio' && selectionSpec) {
      const as = selectionSpecToAudioState(selectionSpec, audio, fields, data);
      if (as.specStates.map(state => Object.keys(state).length).some(n => n >= 1)) {
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
                        ctrl: 'interaction'
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
                        ctrl: 'interaction'
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
      <label htmlFor="uv_mute">Mute</label>
      <input type="checkbox" id="uv_mute" onChange={(e) => Sonifier.mute(e.target.checked)} />
      <pre>
        {JSON.stringify(audioState, null, 2)}
      </pre>
    </div>
  );
}

export default UmweltAudio;
