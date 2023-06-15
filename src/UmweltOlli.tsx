import { OlliGlobalState, OlliSpec, olli } from 'olli';
import React, { useRef } from 'react';
import { useEffect } from 'react';
import { SelectionSpec } from './grammar';
import { SelectionCtrl } from './Umwelt';
import { LogicalAnd } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';

interface UmweltOlliProps {
  olliSpec: OlliSpec,
  onTextNavPred: (predicate: LogicalAnd<FieldPredicate>) => void;
  onTextFilterPred: (predicate: LogicalAnd<FieldPredicate>) => void;
  selectionCtrl: SelectionCtrl,
  selectionSpec: SelectionSpec
  setSelectionCtrlResolve: any
}

const UmweltOlli = React.memo(({ olliSpec, onTextNavPred, onTextFilterPred, selectionCtrl, selectionSpec, setSelectionCtrlResolve }: UmweltOlliProps) => {

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
      if ('field' in selectionSpec.predicate || 'and' in selectionSpec.predicate) {
        console.log('setting selection from vl');
        setSelectionCtrlResolve('vl');
        ((window as any)._olli as OlliGlobalState).instancesOnPage[0].setSelection(selectionSpec.predicate);
      }
    }
  }, [selectionSpec, selectionCtrl])

  if (!olliSpec) return null;

  return (
    <div id="olli-container">
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.olliSpec === nextProps.olliSpec && prevProps.selectionSpec === nextProps.selectionSpec;
});

export default UmweltOlli;
