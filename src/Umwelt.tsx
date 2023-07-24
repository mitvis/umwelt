import { useCallback, useEffect } from 'react';
import useState from 'react-usestateref';
import { UmweltPredicate, UmweltSpec } from './grammar';
import { selectionStoreToSelection } from './utils/selection';
import UmweltAudio from './UmweltAudio';
import { debounce } from 'vega';
import React from 'react';
import UmweltVegaLite from './UmweltVegaLite';
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';
import UmweltOlli from './UmweltOlli';

export type SelectionCtrl = 'vl' | 'audio' | 'olli-nav' | 'olli-int' | 'spec';

interface RenderProps {
  uwSpec: UmweltSpec
}

const Umwelt = React.memo(({ uwSpec }: RenderProps) => {

  const [selection, _setSelection] = useState<UmweltPredicate>();
  const setSelection = useCallback(debounce(50, _setSelection), []);
  const [_selectionCtrl, setSelectionCtrl, selectionCtrl] = useState<SelectionCtrl>('spec');
  const [_selectionCtrlResolve, setSelectionCtrlResolve, selectionCtrlResolve] = useState<SelectionCtrl>();

  /* ********************** initialize state *********************** */

  useEffect(() => {
    // initialize
    // TODO
  }, [uwSpec]);

  /* *********** define listeners to update selection state from children ************ */

  const onAudioState = useCallback((predicate: UmweltPredicate) => {
    // update umwelt selection from audio state
    setSelectionCtrl('audio');
    setSelection(predicate);
  }, []);

  // const onFocus = useCallback(getOnFocus(vlSpec, (field, value) => {
  //   const selection = {
  //     predicate: Array.isArray(value) ? {
  //       field,
  //       range: value
  //     } : {
  //       field,
  //       equal: value
  //     }
  //   };
  //   setSelectionCtrl('olli');
  //   setSelectionSpec(selection);
  // }), [vlSpec, uvSpec]);

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

  return (
    <div className='umwelt'>
      <UmweltVegaLite vlSpec={vlSpec} onVegaLiteSelection={onVegaLiteSelection} selectionCtrl={selectionCtrl} selectionSpec={selection} fields={uwSpec.fields} ></UmweltVegaLite>
      <br/>

      <UmweltOlli olliSpec={olliSpec} selectionCtrl={selectionCtrl.current} setSelectionCtrlResolve={setSelectionCtrlResolve} selectionSpec={selection} onTextNavPred={onTextNavPred} onTextFilterPred={onTextFilterPred}></UmweltOlli>

      <br/>

      {
        uwSpec.audio ? <UmweltAudio audio={uwSpec.audio} fields={uwSpec.fields} data={data} onAudioState={onAudioState} selectionSpec={selection} selectionCtrl={selectionCtrl.current}></UmweltAudio> : null
      }
      <br/>
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
      </div>
      <div style={{fontWeight: 'bold'}}>Debug info</div>
      <pre>
        selectionCtrl: {selectionCtrl.current}
      </pre>
      <pre>
        {JSON.stringify(selection, null, 2)}
      </pre>
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

