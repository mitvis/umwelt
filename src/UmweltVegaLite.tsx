import { OlliDataset, OlliVisSpec } from 'olli';
import React, { MutableRefObject, useState, useRef } from 'react';
import { useEffect } from 'react';
import { ElaboratedFieldDef, SelectionSpec, VlSpec } from './grammar';
import { renderOlli, renderVegaLite } from './utils/render';
import { selectionSpecToSelectionStore, selectionStoreToSelectionSpec, selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import { View } from 'vega';

interface UmweltVegaLiteProps {
  vlSpec: VlSpec,
  onVegaLiteSelection,
  selectionCtrl: MutableRefObject<SelectionCtrl>,
  setSelectionCtrl,
  selectionSpec: SelectionSpec,
  fields: ElaboratedFieldDef[]
}

const UmweltVegaLite = React.memo(({ vlSpec, selectionCtrl, selectionSpec, fields, onVegaLiteSelection, setSelectionCtrl }: UmweltVegaLiteProps) => {

  const [view, setView] = useState<View>();
  const isMouseOver = useRef<boolean>(false);

  useEffect(() => {
    if (vlSpec) {
      const view = renderVegaLite(vlSpec, '#vl-container');
      setView(view);

      document.getElementById('vl-container').addEventListener('mouseenter', () => {
        isMouseOver.current = true;
      })
      document.getElementById('vl-container').addEventListener('mouseleave', () => {
        isMouseOver.current = false;
      })

      view.addDataListener('brush_store', (name, value) => {
        if (isMouseOver.current) {
          setSelectionCtrl('vl');
          onVegaLiteSelection(value);
        }
      });

      (window as any).view = view;

    }
  }, [vlSpec]);

  useEffect(() => {
    if (vlSpec && view && selectionSpec && (selectionCtrl.current === 'audio' || selectionCtrl.current === 'olli-nav')) {
      const store = selectionSpecToSelectionStore(selectionSpec);
      view.data('external_state_store', store).run();
    }
  }, [selectionSpec, fields, view])

  return (
    <div id="vl-container" />
  );
}, (prevProps, nextProps) => {
  return prevProps.vlSpec === nextProps.vlSpec && prevProps.selectionSpec === nextProps.selectionSpec;
});

export default UmweltVegaLite;
