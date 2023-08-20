import { useCallback, useEffect } from 'react';
import useState from 'react-usestateref';
import { AudioSpec, UmweltPredicate, UmweltSpec, VlSpec, umweltToOlliSpec, umweltToVegaLiteSpec } from './grammar';
import { selectionStoreToSelection } from './utils/selection';
import UmweltAudio from './UmweltAudio';
import { debounce } from 'vega';
import React from 'react';
import UmweltVegaLite from './UmweltVegaLite';
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';
import UmweltOlli from './UmweltOlli';
import { OlliDataset, OlliSpec } from 'olli';
import { nodeIsTextInput } from './utils/events';

export type SelectionCtrl = 'vl' | 'audio' | 'olli-nav' | 'olli-int' | 'spec';

interface RenderProps {
  spec: UmweltSpec,
  data: OlliDataset
}

const Umwelt = React.memo(({ spec, data }: RenderProps) => {

  const [selection, _setSelection] = useState<UmweltPredicate>();
  const setSelection = useCallback(debounce(50, _setSelection), []);
  const [_selectionCtrl, setSelectionCtrl, selectionCtrl] = useState<SelectionCtrl>('spec');
  const [_selectionCtrlResolve, setSelectionCtrlResolve, selectionCtrlResolve] = useState<SelectionCtrl>();
  const [vlSpec, setVlSpec] = useState<VlSpec>();
  const [olliSpec, setOlliSpec] = useState<OlliSpec>();
  const [audioSpec, setAudioSpec] = useState<AudioSpec>();
  const lastFocused = React.useRef<HTMLElement>();

  /* ********************** initialize state *********************** */

  useEffect(() => {
    const vlSpec = umweltToVegaLiteSpec(spec, data);
    setVlSpec(vlSpec);

    async function generateOlli() {
      const olliSpec = await umweltToOlliSpec(spec, vlSpec, data);
      setOlliSpec(olliSpec);
    }
    generateOlli();

    if (spec.audio) {
      if (JSON.stringify(spec.audio) !== JSON.stringify(audioSpec)) {
        setAudioSpec(structuredClone(spec.audio));
      }
    }
  }, [spec]);

  /* *********** define listeners to update selection state from children ************ */

  const onAudioState = useCallback((predicate: UmweltPredicate) => {
    // update umwelt selection from audio state
    setSelectionCtrl('audio');
    setSelection(predicate);
  }, []);

  const onTextNavPred = useCallback((predicate: LogicalAnd<FieldPredicate>) => {
    if (selectionCtrlResolve.current) {
      setSelectionCtrl(selectionCtrlResolve.current);
      setSelectionCtrlResolve(null);
    }
    else {
      setSelectionCtrl('olli-nav');
      setSelection(predicate);
    }
  }, [setSelectionCtrl, setSelection]);

  const onTextFilterPred = useCallback((predicate: LogicalAnd<FieldPredicate>) => {
    setSelectionCtrl('olli-int');
    setSelection(predicate);
    setSelectionCtrlResolve('olli-int');
  }, [setSelectionCtrl, setSelection]);


  const onVegaLiteSelection = useCallback((store) => {
    // update uv selection from vl store
    const spec = selectionStoreToSelection(store);
    setSelection(spec);
    setSelectionCtrl('vl');
  }, []);

  /* ***************** write the selection state into all the renders **************************** */

  function printable(object) {
    if (Array.isArray(object)) {
      return object.map(printable);
    }
    const copy = Object.assign({}, object);
    delete copy['data'];
    return copy;
  }

  const onFocus = (e) => {
    lastFocused.current = e.target;
  }

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      if (!nodeIsTextInput((e as any).target)) {
        if (e.key === 'v') {
          if (lastFocused.current) {
            lastFocused.current.focus();
          }
          else {
            (window as any)._olli.instancesOnPage[0].setFocusToItem((window as any)._olli.instancesOnPage[0].rootTreeItem);
          }
        }
      }
    });
  }, []);

  return (
    <div className='umwelt' role="region" aria-labelledby='header-viewer' onFocus={(e) => onFocus(e)}>
      <UmweltVegaLite vlSpec={vlSpec} onVegaLiteSelection={onVegaLiteSelection} selectionCtrl={selectionCtrl} selection={selection} fields={spec.fields} ></UmweltVegaLite>

      <br/>

      <UmweltOlli olliSpec={olliSpec} selectionCtrl={selectionCtrl.current} setSelectionCtrlResolve={setSelectionCtrlResolve} selection={selection} onTextNavPred={onTextNavPred} onTextFilterPred={onTextFilterPred}></UmweltOlli>

      <br/>

      <UmweltAudio audioSpec={audioSpec} fields={spec.fields} data={data} onAudioState={onAudioState} selection={selection} selectionCtrl={selectionCtrl.current}></UmweltAudio>

      {/* <pre>
        {JSON.stringify(printable(audioSpec), null, 2)}
      </pre> */}

      {/*
      <pre>
        {JSON.stringify(printable(olliSpec), null, 2)}
      </pre>

      <pre>
        {JSON.stringify(printable(vlSpec), null, 2)}
      </pre> */}
      {/* <pre>
        {JSON.stringify(printable(spec), null, 2)}
      </pre> */}


      {/* <br/>
      <div>
        <div style={{fontWeight: 'bold'}}>Audio key bindings</div>
        <ul>
          <li>p — play sonification</li>
        </ul>
        <div style={{fontWeight: 'bold'}}>Olli key bindings</div>
        <ul>
          <li>t — open table view</li>
          <li>f — open filter view</li>
        </ul>
      </div> */}
      {/* <div style={{fontWeight: 'bold'}}>Debug info</div>
      <pre>
        selectionCtrl: {selectionCtrl.current}
      </pre>
      <pre>
        {JSON.stringify(selection, null, 2)}
      </pre> */}
      {/* <pre id="pred-out">
        {JSON.stringify(uvSpec.text, null, 2)}
      </pre> */}
      <br/>
      {/* <pre>
        {data && selectionSpec && uwSpec.fields ? JSON.stringify(selectionTest(data, selectionSpec), null, 2) : null}
      </pre> */}
    </div>
  );
});

export default Umwelt;

