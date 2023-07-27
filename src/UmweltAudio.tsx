import { OlliDataset } from 'olli';
import useState from 'react-usestateref';
import { AudioSpec, FieldDef, UmweltPredicate } from './grammar';
import { SelectionCtrl } from './Umwelt';
import UmweltAudioUnit from './UmweltAudioUnit';

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

  return (
    <div id="audio-container">
      {
        audioSpec?.units.map((audioUnitSpec, i) => {
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
            />
          )
        })
      }
      {
        audioSpec?.units.length ? (
          <label><input type="checkbox" className="uv_mute" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute</label>
        ) : null
      }
    </div>
  );
}

export default UmweltAudio;



