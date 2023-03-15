import { OlliDataset, OlliVisSpec } from 'olli';
import React from 'react';
import { useEffect } from 'react';
import { ElaboratedFieldDef, SelectionSpec } from './grammar';
import { renderOlli } from './utils/render';
import { selectionTest } from './utils/selection';
import { SelectionCtrl } from './Umwelt';

interface UmweltOlliProps {
  olliSpec: OlliVisSpec,
  onFocus,
  selectionCtrl: SelectionCtrl
  selectionSpec: SelectionSpec,
  fields: ElaboratedFieldDef[]
}

const UmweltOlli = React.memo(({ olliSpec, onFocus, selectionCtrl, selectionSpec, fields }: UmweltOlliProps) => {

  useEffect(() => {
    if (olliSpec) {
      let spec = olliSpec;
      if (selectionSpec && selectionCtrl !== 'olli') {
        spec = {
          ...spec,
          selection: selectionTest(olliSpec.data, selectionSpec, fields)
        }
      }
      renderOlli(spec, '#olli-container', {
        onFocus
      });
    }
  });

  return (
    <div id="olli-container">
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.olliSpec === nextProps.olliSpec;
});

export default UmweltOlli;
