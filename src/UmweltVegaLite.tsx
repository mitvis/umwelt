import { OlliDataset, OlliVisSpec } from 'olli';
import React, { MutableRefObject, useState, useRef, useCallback } from 'react';
import { useEffect } from 'react';
import { ElaboratedFieldDef, SelectionSpec, VlSpec } from './grammar';
import { renderOlli, renderVegaLite } from './utils/render';
import { selectionSpecToSelectionStore, selectionStoreToSelectionSpec, selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import { View, debounce } from 'vega';

interface UmweltVegaLiteProps {
  vlSpec: VlSpec,
  onVegaLiteSelection,
  selectionCtrl: MutableRefObject<SelectionCtrl>,
  selectionSpec: SelectionSpec,
  fields: ElaboratedFieldDef[]
}

const UmweltVegaLite = React.memo(({ vlSpec, selectionCtrl, selectionSpec, fields, onVegaLiteSelection }: UmweltVegaLiteProps) => {

  const [view, setView] = useState<View>();
  const isMouseOver = useRef<boolean>(false);

  const mouseenter = useCallback(() => {
    isMouseOver.current = true;
  }, []);
  const mouseleave = useCallback(() => {
    isMouseOver.current = false;
  }, []);
  const updateValue = debounce(250, (value) => {
    if (isMouseOver.current) {
      onVegaLiteSelection(value);
    }
  });

  useEffect(() => {
    if (vlSpec) {
      const view = renderVegaLite(vlSpec, '#vl-container');
      setView(view);

      document.getElementById('vl-container').addEventListener('mouseenter', mouseenter)
      document.getElementById('vl-container').addEventListener('mouseleave', mouseleave)

      view.addDataListener('brush_store', (name, value) => {
        updateValue(value);
      });

      (window as any).view = view;

    }
  }, [vlSpec]);

  useEffect(() => {
    if (vlSpec && view && selectionSpec && (selectionCtrl.current === 'audio' || selectionCtrl.current === 'olli-nav')) {
      const store = selectionSpecToSelectionStore(selectionSpec);
      view.data('external_state_store', store).run();
    }
    if (vlSpec && view && selectionSpec && (selectionCtrl.current === 'spec')) {
      // const store = selectionSpecToSelectionStore(selectionSpec);
      // view.data('brush_store', store).run();
      // TODO: when we implement olli custom selection menu, we'll need to impl a way to go from selection to brush x/y coords
      // which will be better than stuffing the store in because you'll get the visual brush
    }
  }, [selectionSpec, fields, view])

  return (
    <div id="vl-container" />
  );
}, (prevProps, nextProps) => {
  return prevProps.vlSpec === nextProps.vlSpec && prevProps.selectionSpec === nextProps.selectionSpec;
});

export default UmweltVegaLite;
