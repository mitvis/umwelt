import React, { MutableRefObject, useState, useRef, useCallback } from 'react';
import { useEffect } from 'react';
import { FieldDef, UmweltPredicate, VlSpec } from './grammar';
import { renderVegaLite } from './utils/render';
import { predicateToSelectionStore } from './utils/selection';
import { SelectionCtrl } from './Umwelt';
import { View, debounce } from 'vega';
import { getVegaAxisTicks } from './utils/vega';

interface UmweltVegaLiteProps {
  vlSpec: VlSpec,
  onVegaLiteSelection,
  selectionCtrl: MutableRefObject<SelectionCtrl>,
  selection: UmweltPredicate,
  fields: FieldDef[]
}

const UmweltVegaLite = React.memo(({ vlSpec, selectionCtrl, selection, fields, onVegaLiteSelection }: UmweltVegaLiteProps) => {

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
      try {
        const view = renderVegaLite(vlSpec, '#vl-container');
        setView(view);

        document.getElementById('vl-container').addEventListener('mouseenter', mouseenter)
        document.getElementById('vl-container').addEventListener('mouseleave', mouseleave)

        view.addDataListener('brush_store', (_, value) => {
          updateValue(value);
        });

        (window as any).view = view;
      } catch (e) {
        console.error(e);
      }
    }
  }, [vlSpec]);

  useEffect(() => {
    if (vlSpec && view && selection && (selectionCtrl.current === 'audio' || selectionCtrl.current === 'olli-nav')) {
      const store = predicateToSelectionStore(selection);
      view.data('external_state_store', store).run();
    }
    if (vlSpec && view && selection && (selectionCtrl.current === 'spec')) {
      // const store = selectionSpecToSelectionStore(selectionSpec);
      // view.data('brush_store', store).run();
      // TODO: when we implement olli custom selection menu, we'll need to impl a way to go from selection to brush x/y coords
      // which will be better than stuffing the store in because you'll get the visual brush
    }
  }, [selection, fields, view, vlSpec, selectionCtrl])

  return vlSpec ? (
    <div id="vl-container" />
  ) : null;
}, (prevProps, nextProps) => {
  return prevProps.vlSpec === nextProps.vlSpec && prevProps.selection === nextProps.selection;
});

export default UmweltVegaLite;
