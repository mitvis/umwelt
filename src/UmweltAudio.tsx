import { OlliDataset } from 'olli';
import useState from 'react-usestateref';
import { AudioSpec, FieldDef, UmweltPredicate } from './grammar';
import { SelectionCtrl } from './Umwelt';
import UmweltAudioUnit from './UmweltAudioUnit';
import { useEffect } from 'react';
import { Sonifier } from './utils/sonifier';

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
  const [_, setActiveUnit, activeUnitRef] = useState<string>();

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
        {
          JSON.stringify(commonTraversals)
        }
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
                activeUnitRef={activeUnitRef}
                setActiveUnit={setActiveUnit}
              />
            )
          })
        }
      </div>
    )
  }

  return (
    <div id="audio-container">
      {
        audioSpec?.composition === 'layer' ? (
          layerSpec(audioSpec)
        ) : (
          concatSpec(audioSpec)
        )
      }
      {
        audioSpec?.units.length && !(audioSpec.units.length === 1 && !Object.keys(audioSpec.units[0].encoding).length) ? (
          <label><input type="checkbox" className="uv_mute" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute</label>
        ) : null
      }
    </div>
  );
}

export default UmweltAudio;



