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
  uvSpec: ElaboratedUmweltSpec
}

const Umwelt = React.memo(({ data, vlSpec, olliSpec, uvSpec }: RenderProps) => {

  const [selectionSpec, _setSelectionSpec] = useState<SelectionSpec>(uvSpec.selection);
  const setSelectionSpec = useCallback(debounce(50, _setSelectionSpec), []);
  const [_selectionCtrl, setSelectionCtrl, selectionCtrl] = useState<SelectionCtrl>('spec');
  const container = useRef();

  /* ********************** initialize state *********************** */

  useEffect(() => {
    // initialize selections
    setSelectionCtrl('spec');
    if (uvSpec && uvSpec.selection) {
      setSelectionSpec(uvSpec.selection);
    }
    else {
      setSelectionSpec(undefined);
    }

  }, [uvSpec]);

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
    if (selectionCtrl.current === 'olli-int') {
      setSelectionCtrl('olli-nav');
    }
    else {
      setSelectionCtrl('olli-nav');
      setSelectionSpec({predicate});
    }
  }, [setSelectionCtrl, setSelectionSpec]);

  const onTextFilterPred = useCallback((predicate: LogicalAnd<FieldPredicate>) => {
    setSelectionCtrl('olli-int');
    setSelectionSpec({predicate});
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
      <UmweltVegaLite vlSpec={vlSpec} onVegaLiteSelection={onVegaLiteSelection} selectionCtrl={selectionCtrl} selectionSpec={selectionSpec} fields={uvSpec.fields} ></UmweltVegaLite>
      <br/>

      <UmweltOlli olliSpec={olliSpec} selectionCtrl={selectionCtrl.current} selectionSpec={selectionSpec} onTextNavPred={onTextNavPred} onTextFilterPred={onTextFilterPred}></UmweltOlli>

      <br/>

      {
        uvSpec.audio ? <UmweltAudio audio={uvSpec.audio} fields={uvSpec.fields} data={data} onAudioState={onAudioState} selectionSpec={selectionSpec} selectionCtrl={selectionCtrl.current}></UmweltAudio> : null
      }
      <br/>
      <br/>
      <pre>
        {JSON.stringify(selectionSpec, null, 2)}
      </pre>
      {/* <pre id="pred-out">
        {JSON.stringify(uvSpec.text, null, 2)}
      </pre> */}
      <br/>
      <pre>
        {data && selectionSpec && uvSpec.fields ? JSON.stringify(selectionTest(data, selectionSpec), null, 2) : null}
      </pre>
    </div>
  );
});

export default Umwelt;

