import { OlliDataset } from 'olli';
import useState from 'react-usestateref';
import { AudioSpec, FieldDef, UmweltPredicate } from './grammar';
import { SelectionCtrl } from './Umwelt';
import UmweltAudioUnit from './UmweltAudioUnit';
import { useEffect, useRef } from 'react';
import { Sonifier } from './utils/sonifier';
import { nodeIsTextInput } from './utils/events';
import { clamp } from './utils/values';

interface AudioProps {
  audioSpec: AudioSpec,
  fields: FieldDef[]
  data: OlliDataset,
  onAudioState: (selection: UmweltPredicate) => void;
  selection: UmweltPredicate;
  selectionCtrl: SelectionCtrl;
}

function UmweltAudio({audioSpec, fields, data, onAudioState, selection, selectionCtrl}: AudioProps) {

  const [muted, setMuted] = useState(false);
  const [readAudioAxis, setReadAudioAxis] = useState(true);
  const [speechRate, setSpeechRate] = useState(3.5);
  const [_, setActiveUnit, activeUnitRef] = useState<string>();
  const lastFocused = useRef<HTMLElement>();

  useEffect(() => {
    Sonifier.mute(muted)
  }, [muted])

  const concatSpec = (audioSpec: AudioSpec) => {
    return audioSpec?.units.map((audioUnitSpec, i) => {
      if (Object.keys(audioUnitSpec.encoding).length === 0) {
        return null;
      }
      return (
        <UmweltAudioUnit
          key={i}
          audioUnitSpec={audioUnitSpec}
          fields={fields}
          data={data}
          onAudioState={onAudioState}
          selection={selection}
          selectionCtrl={selectionCtrl}
          muted={muted}
          setMuted={setMuted}
          readAudioAxis={readAudioAxis}
          speechRate={speechRate}
          activeUnitRef={activeUnitRef}
          setActiveUnit={setActiveUnit}
        />
      )
    })
  }

  const layerSpec = (audioSpec: AudioSpec) => {
    const commonTraversals = audioSpec?.units[0].traversal.filter(traversal => {
      return audioSpec?.units.every(unit => {
        return unit.traversal.some(traversal2 => traversal2.field === traversal.field);
      });
    });

    const audioSpecClone = structuredClone(audioSpec);
    audioSpecClone.units.forEach(unit => {
      unit.traversal = unit.traversal.filter(traversal => {
        return commonTraversals.every(commonTraversal => commonTraversal.field !== traversal.field);
      });
    });

    return (
      <div>
        {/* {
          JSON.stringify(commonTraversals)
        } */}
        {
          audioSpecClone?.units.map((audioUnitSpec, i) => {
            if (Object.keys(audioUnitSpec.encoding).length === 0) {
              return null;
            }
            return (
              <UmweltAudioUnit
                key={i}
                audioUnitSpec={audioUnitSpec}
                fields={fields}
                data={data}
                onAudioState={onAudioState}
                selection={selection}
                selectionCtrl={selectionCtrl}
                muted={muted}
                setMuted={setMuted}
                readAudioAxis={readAudioAxis}
                speechRate={speechRate}
                activeUnitRef={activeUnitRef}
                setActiveUnit={setActiveUnit}
              />
            )
          })
        }
      </div>
    )
  }

  const onFocus = (e) => {
    lastFocused.current = e.target;
  }

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      if (!nodeIsTextInput((e as any).target)) {
        if (e.key === 'a') {
          if (lastFocused.current) {
            lastFocused.current.focus();
          }
          else {
            const elem: HTMLButtonElement = document.querySelector('button.uv-audio-play-pause');
            if (elem) {
              elem.focus();
            }
          }
        }
      }
    });
  }, []);

  return (
    <div id="audio-container" role="group" aria-label='Sonification' onFocus={(e) => onFocus(e)}>
      {
        audioSpec?.composition === 'layer' ? (
          layerSpec(audioSpec)
        ) : (
          concatSpec(audioSpec)
        )
      }
      {
        audioSpec?.units.length && !(audioSpec.units.length === 1 && !Object.keys(audioSpec.units[0].encoding).length) ? (
          <div>
            <label><input type="checkbox" className="uv_audio_axis" checked={readAudioAxis} onChange={(e) => setReadAudioAxis(e.target.checked)} /> Speak audio axis ticks</label> <br/>
            <label>Audio axis speech rate <input type="number" min="0.1" max="10" value={speechRate} step={0.1} id="rate" onChange={(e) => setSpeechRate(clamp(Number(e.target.value), 0.1, 10))} />x</label> <br/><br/>
            <label><input type="checkbox" aria-live='polite' className="uv_mute" checked={muted} onChange={(e) => setMuted(e.target.checked)} />{muted ? 'Muted' : 'Unmuted'}</label>
          </div>
        ) : null
      }
    </div>
  );
}

export default UmweltAudio;



