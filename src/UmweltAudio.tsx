import { OlliDataset, OlliValue } from 'olli';
import { useEffect, useRef, useState } from 'react';
import { ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from './grammar';
import { audioCtrlSelectionToNotes, selectionToNotes } from './utils/sonification/notes';
import { getDomain, getFieldDef } from './utils/data';
import { selectionTest } from './utils/selection';
import { filterObjectByKeys, rangesAreEqual, serializeValue } from './utils/values';
import { SelectionCtrl } from './Umwelt';
import Sonifier from './sonification';
import { audioStateToSelectionSpec, selectionSpecToAudioState } from './utils/audioState';
import { getAudioEncodingBin } from './utils/bin';

interface AudioProps {
  audio: ElaboratedAudioSpec[]
  fields: ElaboratedFieldDef[]
  data: OlliDataset,
  onAudioState: (audioState: AudioSpecState) => void;
  selectionSpec: SelectionSpec;
  selectionCtrl: SelectionCtrl;
  axisBins: AxisBins;
}

export type AxisBins = {[field: string]: ([number, number])[]};

export type AudioSpecState = {
  [field: string]: string | number | [number, number]
};

export type AudioState = {
  specStates: AudioSpecState[],
  activeState: number // index of active audio spec
}

function UmweltAudio({audio, fields, data, onAudioState, selectionSpec, selectionCtrl, axisBins}: AudioProps) {

  const [audioState, setAudioState] = useState<AudioState>(getInitialAudioState(audio, axisBins, fields, data));
  const [shouldUpdate, setShouldUpdate] = useState<boolean>(false);

  function getInitialAudioState(audio: ElaboratedAudioSpec[], axisBins: AxisBins, fields: ElaboratedFieldDef[], data: OlliDataset) {
    return {
      specStates: audio.map(audioSpec => {
        if (audioSpec.traversal !== 'selection') {

          const bin = getAudioEncodingBin(audioSpec.encoding);

          return Object.fromEntries(
            Object.keys(audioSpec.traversal)
              .filter(field => audioSpec.traversal[field] === 'interaction')
              .map(field => {
                const fieldDef = getFieldDef(field, fields);
                const domain = getDomain(field, data);

                if (fieldDef?.type === 'quantitative' || fieldDef?.type === 'temporal') {

                  if (bin && axisBins[field]) {
                    return [field, axisBins[field][0]]
                  }
                  else {
                    return [field, serializeValue(domain[0], fieldDef)];
                  }
                }
                else {
                  return [field, String(domain[0])];
                }

              })
          );

        }
        return null;
      }),
      activeState: 0
    }
  }

  useEffect(() => {
    // re-initialize when spec changes
    setShouldUpdate(false);
    setAudioState(getInitialAudioState(audio, axisBins, fields, data));
    console.log('re-initialized audiostate')
  }, [fields, audio, data])

  useEffect(() => {
    const currentAudioSpecState = audioState.specStates[audioState.activeState];

    // update sonifier state on audio state change
    if (currentAudioSpecState && Object.keys(currentAudioSpecState).length) {
      const selectionSpec = audioStateToSelectionSpec(currentAudioSpecState);
      console.log('audio ctrl sonifier update', selectionSpec);
      const notes = audioCtrlSelectionToNotes(selectionSpec, audio, fields, data);
      Sonifier.setNotes(notes);
    }
    else {
      const notes = selectionToNotes(data, audio, fields, data);
      console.log('empty audio state sonifier update', notes);
      if (notes.length) {
        Sonifier.setNotes(notes);
      }
    }

    // update umwelt selection on audio state change
    if (shouldUpdate) {
      onAudioState(currentAudioSpecState);
      Sonifier.pingCurrentNotes();
    }

  }, [audioState, shouldUpdate]);

  useEffect(() => {
    // update audio state on umwelt selection change
    if (selectionCtrl !== 'audio' && selectionSpec) {
      const as = selectionSpecToAudioState(selectionSpec, audio, fields, data, axisBins);
      if (as.specStates.map(state => Object.keys(state).length).some(n => n >= 1)) {
        const mergedSpecStates = audioState.specStates.map((state, idx) => {return {...state, ...as.specStates[idx]}});
        setShouldUpdate(false);
        setAudioState({
          specStates: mergedSpecStates,
          activeState: as.activeState || audioState.activeState
        });
      }
      else {
        console.log('non-audio-ctrl sonifier update', selectionSpec);
        const selection = selectionTest(data, selectionSpec, fields);
        const notes = selectionToNotes(selection, audio, fields, data);
        if (notes.length) {
          Sonifier.setNotes(notes);
        }
      }
    }
  }, [selectionSpec, selectionCtrl])

  function audioStateFieldsFromCurrentSpec() {
    return audioState.specStates.every(audioSpecState => {
      if (audioSpecState) {
        return Object.keys(audioSpecState).every(field => getFieldDef(field, fields));
      }
      return true;
    })
  }

  if (!audioStateFieldsFromCurrentSpec()) {
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
              Object.entries(audioSpec.traversal).map(([field, mode]) => {
                const fieldDef = getFieldDef(field, fields);
                if (mode === 'interaction') {
                  const domain = getDomain(field, data);
                  if (fieldDef?.type === 'quantitative' || fieldDef?.type === 'temporal' || fieldDef?.type === 'ordinal') {
                    const id = `${field}-slider`;
                    // handle binning
                    const bin = getAudioEncodingBin(audioSpec.encoding);
                    if (bin && axisBins[field]) {
                      const onchange = (e) => {
                        const idx = Number(e.target.value);
                        const specStates = [...audioState.specStates];
                        specStates[audioSpecIdx] = {
                          ...specStates[audioSpecIdx],
                          [field]: axisBins[field][idx]
                        }
                        setAudioState({
                          activeState: audioSpecIdx,
                          specStates
                        });
                        setShouldUpdate(true);
                      };
                      return (
                        <div key={field}>
                          <label htmlFor={id}>{field}</label>
                          <input aria-valuetext={field} onChange={onchange} id={id} type="range" min="0" max={axisBins[field].length - 1} value={axisBins[field].findIndex(b => rangesAreEqual(b, audioState.specStates?.[audioSpecIdx]?.[field] as any[], fieldDef))}></input>
                          {/* <div>{JSON.stringify(audioState.specStates)}</div>
                          <div>{JSON.stringify(audioState.specStates?.[audioSpecIdx])}</div>
                          <div>{JSON.stringify(audioState.specStates?.[audioSpecIdx]?.[field])}</div> */}
                        </div>
                      );

                    }
                    else {
                      const onchange = (e) => {
                        const idx = Number(e.target.value);
                        const specStates = [...audioState.specStates];
                        specStates[audioSpecIdx] = {
                          ...specStates[audioSpecIdx],
                          [field]: serializeValue(domain[idx], fieldDef)
                        }
                        setAudioState({
                          activeState: audioSpecIdx,
                          specStates
                        });
                        setShouldUpdate(true);
                      };
                      return (
                        <div key={field}>
                          <label htmlFor={id}>{field}</label>
                          <input aria-valuetext={field} onChange={onchange} id={id} type="range" min="0" max={domain.length - 1} value={domain.findIndex(v => serializeValue(v, fieldDef) === serializeValue(audioState.specStates?.[audioSpecIdx]?.[field], fieldDef))}></input>
                        </div>
                      );
                    }
                  }
                  else {
                    const id = `${field}-select`;
                    const onchange = (e) => {
                      const specStates = [...audioState.specStates];
                      specStates[audioSpecIdx] = {
                        ...specStates[audioSpecIdx],
                        [field]: e.target.value
                      }
                      setAudioState({
                        activeState: audioSpecIdx,
                        specStates
                      });
                      setShouldUpdate(true);
                    }
                    return (
                      <div key={field}>
                        <label htmlFor={id}>{field}</label>
                        <select onChange={onchange} id={id} value={String(audioState.specStates?.[audioSpecIdx]?.[field])}>
                          {domain.map(val => {
                            return <option key={String(val)} value={String(val)}>{String(val)}</option>
                          })}
                        </select>
                      </div>
                    )
                  }
                }
                return null;
              })
            }
          </div>)
        })
      }
      <label htmlFor="uv_mute">Mute</label>
      <input type="checkbox" id="uv_mute" onChange={(e) => Sonifier.mute(e.target.checked)} />
    </div>
  );
}

export default UmweltAudio;
