import { OlliDataset, OlliVisSpec } from 'olli';
import React, { MutableRefObject, useState } from 'react';
import { useEffect } from 'react';
import { ElaboratedFieldDef, SelectionSpec, VlSpec } from './grammar';
import { renderOlli, renderVegaLite } from './utils/render';
import { selectionSpecToSelectionStore, selectionStoreToSelectionSpec, selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umvelt';
import { View } from 'vega';

interface UmveltVegaLiteProps {
  vlSpec: VlSpec,
  onVegaLiteSelection,
  selectionCtrl: MutableRefObject<SelectionCtrl>,
  setSelectionCtrl,
  selectionSpec: SelectionSpec,
  fields: ElaboratedFieldDef[]
}

const UmveltVegaLite = React.memo(({ vlSpec, selectionCtrl, selectionSpec, fields, onVegaLiteSelection, setSelectionCtrl }: UmveltVegaLiteProps) => {

  const [view, setView] = useState<View>();

  useEffect(() => {
    if (vlSpec) {
      const view = renderVegaLite(vlSpec, '#vl-container');
      setView(view);

      document.getElementById('vl-container').addEventListener('mousemove', () => {
        setSelectionCtrl('vl');
      })

      view.addDataListener('brush_store', (name, value) => {
        if (selectionCtrl.current === 'vl') {
          onVegaLiteSelection(value);
        }
      });

    }
  }, [vlSpec]);

  useEffect(() => {
    if (vlSpec && view && selectionSpec && selectionCtrl.current !== 'vl') {
      const store = selectionSpecToSelectionStore(selectionSpec, fields);
      view.data('brush_store', store).run();
    }
  }, [selectionSpec, fields, view])

  return (
    <div id="vl-container" />
  );
}, (prevProps, nextProps) => {
  return prevProps.vlSpec === nextProps.vlSpec && prevProps.selectionSpec === nextProps.selectionSpec;
});

export default UmveltVegaLite;
