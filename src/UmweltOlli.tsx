import { OlliGlobalState, OlliSpec, olli } from 'olli';
import React, { useRef } from 'react';
import { useEffect } from 'react';
import { UmweltPredicate } from './grammar';
import { SelectionCtrl } from './Umwelt';
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';

interface UmweltOlliProps {
  olliSpec: OlliSpec,
  onTextNavPred: (predicate: LogicalAnd<FieldPredicate>) => void;
  onTextFilterPred: (predicate: LogicalAnd<FieldPredicate>) => void;
  selectionCtrl: SelectionCtrl,
  selection: UmweltPredicate
  setSelectionCtrlResolve: any
}

const UmweltOlli = React.memo(({ olliSpec, onTextNavPred, onTextFilterPred, selectionCtrl, selection, setSelectionCtrlResolve }: UmweltOlliProps) => {

  const currentOlliSpec = useRef<OlliSpec>();

  useEffect(() => {
    if (olliSpec && olliSpec !== currentOlliSpec.current) {
      currentOlliSpec.current = olliSpec;
      if (((window as any)._olli as OlliGlobalState)?.instancesOnPage) {
        ((window as any)._olli as OlliGlobalState).instancesOnPage = [];
      }
      const elem = olli(olliSpec, {
        onFocus: (_, node) => {
          onTextNavPred(node.fullPredicate);
        },
        onSelection: (predicate) => {
          onTextFilterPred(predicate as any);
        }
      });
      document.querySelector('#olli-container').replaceChildren(elem);
    }
  }, [olliSpec]);

  useEffect(() => {
    if (selectionCtrl === 'vl') {
      if ('field' in selection || 'and' in selection) {
        setSelectionCtrlResolve('vl');
        ((window as any)._olli as OlliGlobalState).instancesOnPage[0].setSelection(selection);
      }
    }
  }, [selection, selectionCtrl])

  if (!olliSpec) return null;

  return (
    <div id="olli-container">
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.olliSpec === nextProps.olliSpec && prevProps.selection === nextProps.selection;
});

export default UmweltOlli;
