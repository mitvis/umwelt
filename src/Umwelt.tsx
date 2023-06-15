import { useCallback, useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import { ElaboratedUmweltSpec, SelectionSpec, VlSpec } from './grammar';
import { selectionStoreToSelectionSpec, selectionTest } from './utils/selection';
import UmweltAudio, {  } from './UmweltAudio';
import { debounce } from 'vega';
import React from 'react';
import { OlliDataset, OlliSpec } from 'olli';
import UmweltVegaLite from './UmweltVegaLite';
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';
import UmweltOlli from './UmweltOlli';

export type SelectionCtrl = 'vl' | 'audio' | 'olli-nav' | 'olli-int' | 'spec';

interface RenderProps {
  data: OlliDataset,
  vlSpec: VlSpec,
  olliSpec: OlliSpec,
  uwSpec: ElaboratedUmweltSpec
}

const Umwelt = React.memo(({ data, vlSpec, olliSpec, uwSpec }: RenderProps) => {

  const [selectionSpec, _setSelectionSpec] = useState<SelectionSpec>(uwSpec.selection);
  const setSelectionSpec = useCallback(debounce(50, _setSelectionSpec), []);
  const [_selectionCtrl, setSelectionCtrl, selectionCtrl] = useState<SelectionCtrl>('spec');
  const [_selectionCtrlResolve, setSelectionCtrlResolve, selectionCtrlResolve] = useState<SelectionCtrl>();
  const container = useRef();

  /* ********************** initialize state *********************** */

  useEffect(() => {
    // initialize selections
    setSelectionCtrl('spec');
    if (uwSpec && uwSpec.selection) {
      setSelectionSpec(uwSpec.selection);
    }
    else {
      setSelectionSpec(undefined);
    }

  }, [uwSpec]);

  /* *********** define listeners to update selection state from children ************ */

  const onAudioState = useCallback((selectionSpec: SelectionSpec) => {
    // update umwelt selection from audio state
    setSelectionCtrl('audio');
    setSelectionSpec(selectionSpec);
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
    console.log('navPred');
    if (selectionCtrlResolve.current) {
      setSelectionCtrl(selectionCtrlResolve.current);
      setSelectionCtrlResolve(null);
    }
    else {
      setSelectionCtrl('olli-nav');
      setSelectionSpec({predicate});
    }
  }, [setSelectionCtrl, setSelectionSpec]);

  const onTextFilterPred = useCallback((predicate: LogicalAnd<FieldPredicate>) => {
    console.log('filterPred');
    setSelectionCtrl('olli-int');
    setSelectionSpec({predicate});
    setSelectionCtrlResolve('olli-int');
  }, [setSelectionCtrl, setSelectionSpec]);


  const onVegaLiteSelection = useCallback((store) => {
    // update uv selection from vl store
    const spec = selectionStoreToSelectionSpec(store);
    setSelectionSpec(spec);
    setSelectionCtrl('vl');
  }, []);

  /* ***************** write the selection state into all the renders **************************** */

  return (
    <div className='umwelt' ref={container}>
      <UmweltVegaLite vlSpec={vlSpec} onVegaLiteSelection={onVegaLiteSelection} selectionCtrl={selectionCtrl} selectionSpec={selectionSpec} fields={uwSpec.fields} ></UmweltVegaLite>
      <br/>

      <UmweltOlli olliSpec={olliSpec} selectionCtrl={selectionCtrl.current} setSelectionCtrlResolve={setSelectionCtrlResolve} selectionSpec={selectionSpec} onTextNavPred={onTextNavPred} onTextFilterPred={onTextFilterPred}></UmweltOlli>

      <br/>

      {
        uwSpec.audio ? <UmweltAudio audio={uwSpec.audio} fields={uwSpec.fields} data={data} onAudioState={onAudioState} selectionSpec={selectionSpec} selectionCtrl={selectionCtrl.current}></UmweltAudio> : null
      }
      <br/>
      <br/>
      <pre>
        {selectionCtrl.current}
      </pre>
      <pre>
        {JSON.stringify(selectionSpec, null, 2)}
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

