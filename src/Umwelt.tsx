import { useCallback, useEffect, useRef, useState } from 'react';
import { ElaboratedUmweltSpec, SelectionSpec, VlSpec } from './grammar';
import { getOnFocus } from './utils/render';
import { selectionStoreToSelectionSpec, selectionTest } from './utils/selection';
import UmweltAudio, { AudioSpecState } from './UmweltAudio';
import { debounce } from 'vega';
import UmweltOlli from './UmweltOlli';
import React from 'react';
import { Axis, chart, OlliDataset, OlliVisSpec } from 'olli';
import { audioStateToSelectionSpec } from './utils/audioState';
import UmweltVegaLite from './UmweltVegaLite';
import { axisValuesToIntervals } from './utils/bin';
import { getFieldDef } from './utils/data';

export type SelectionCtrl = 'vl' | 'olli' | 'audio' | 'spec';

interface RenderProps {
  data: OlliDataset,
  vlSpec: VlSpec,
  olliSpec: OlliVisSpec,
  uvSpec: ElaboratedUmweltSpec
}

const Umwelt = React.memo(({ data, vlSpec, olliSpec, uvSpec }: RenderProps) => {

  const [selectionSpec, _setSelectionSpec] = useState<SelectionSpec>(uvSpec.selection);
  const setSelectionSpec = useCallback(debounce(250, _setSelectionSpec), []);
  const [_selectionCtrl, _setSelectionCtrl] = useState<SelectionCtrl>('spec');
  const selectionCtrl = useRef<SelectionCtrl>(_selectionCtrl);
  const setSelectionCtrl = data => {
    selectionCtrl.current = data;
    _setSelectionCtrl(data);
  };

  const [axisBins, setAxisBins] = useState<{[field: string]: ([number, number])[]}>({});

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

    // initialize binning information
    let axes: Axis[] = [];
    if (olliSpec.type === 'facetedChart') {
      axes = [...olliSpec.charts.values()][0].axes;
    }
    else {
      axes = olliSpec.axes;
    }
    const bins = Object.fromEntries(axes.filter(axis => {
      const fieldDef = getFieldDef(axis.field, uvSpec.fields);
      return fieldDef.type === 'quantitative' || fieldDef.type === 'temporal';
    }).map(axis => {
      return [axis.field, axisValuesToIntervals(axis.values)]
    }));
    setAxisBins(bins);

  }, [uvSpec]);

  /* *********** define listeners to update selection state from children ************ */

  const onAudioState = useCallback((audioState: AudioSpecState) => {
    // update umwelt selection from audio state
    const selectionSpec = audioStateToSelectionSpec(audioState);
    setSelectionCtrl('audio');
    setSelectionSpec(selectionSpec);
    console.log('update', selectionSpec);
  }, []);

  const onFocus = useCallback(getOnFocus(vlSpec, (field, value) => {
    const selection = {
      predicate: Array.isArray(value) ? {
        field,
        range: value
      } : {
        field,
        equal: value
      }
    };
    setSelectionCtrl('olli');
    setSelectionSpec(selection);
  }), [vlSpec, uvSpec]);


  const onVegaLiteSelection = useCallback((store) => {
    // update uv selection from vl store
    const spec = selectionStoreToSelectionSpec(store);
    setSelectionSpec(spec);
  }, []);

  /* ***************** write the selection state into all the renders **************************** */

  return (
    <div>
      <UmweltVegaLite vlSpec={vlSpec} onVegaLiteSelection={onVegaLiteSelection} selectionCtrl={selectionCtrl} setSelectionCtrl={setSelectionCtrl} selectionSpec={selectionSpec} fields={uvSpec.fields} ></UmweltVegaLite>
      <br/>

      <UmweltOlli olliSpec={olliSpec} selectionCtrl={selectionCtrl.current} selectionSpec={selectionSpec} fields={uvSpec.fields} onFocus={onFocus}></UmweltOlli>
      <br/>

      {
        uvSpec.audio ? <UmweltAudio audio={uvSpec.audio} fields={uvSpec.fields} data={data} onAudioState={onAudioState} selectionSpec={selectionSpec} selectionCtrl={selectionCtrl.current} axisBins={axisBins}></UmweltAudio> : null
      }
      <br/>
      <br/>
      <pre>
        {JSON.stringify(selectionSpec, null, 2)}
      </pre>
      <br/>
      <pre>
        {data && selectionSpec && uvSpec.fields ? JSON.stringify(selectionTest(data, selectionSpec, uvSpec.fields), null, 2) : null}
      </pre>
    </div>
  );
});

export default Umwelt;

