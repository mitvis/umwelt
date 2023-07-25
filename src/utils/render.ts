import { parse, View } from 'vega';
import { compile } from 'vega-lite';
import { VlSpec } from '../grammar/Types';
import { editLinePointConditionalBehavior } from './vega';

export function renderVegaLite(vlSpec: VlSpec, domSelector: string) {
  let vgSpec = compile(vlSpec).spec;
  // const dataset = vgSpec.data[vgSpec.data.length - 1].name;
  // vgSpec.data.push({
  //   "name": "brush_materialized",
  //   "source": dataset,
  //   "transform": [{"type": "filter", "expr": "!length(data(\"brush_store\")) || vlSelectionTest(\"brush_store\", datum)"}]
  // })
  // vgSpec.data.push({
  //   "name": "external_state_materialized",
  //   "source": dataset,
  //   "transform": [{"type": "filter", "expr": "!length(data(\"external_state_store\")) || vlSelectionTest(\"external_state_store\", datum)"}]
  // })
  vgSpec.signals = vgSpec.signals
    .map((signal) => {
      if (signal.name === 'external_state_modify') {
        return {
          name: 'external_state_modify',
          update: 'false',
        };
      }
      return signal;
    })
    .filter((signal, idx) => {
      return vgSpec.signals.findIndex((s) => s.name === signal.name) === idx;
    });
  if ('mark' in vlSpec && (vlSpec.mark as any).type === 'line' && (vlSpec.mark as any).point) {
    // TODO non-unit specs
    vgSpec = editLinePointConditionalBehavior(vgSpec);
  }
  const runtime = parse(vgSpec);
  const view = new View(runtime, {
    renderer: 'canvas',
    container: domSelector,
    hover: true,
  });

  view.runAsync();

  return view;
}

export function getOnFocus(vlSpec, selectionCallback: (field, value) => void) {
  const onFocus = (elem) => {
    const fv = elem.getAttribute('data-filterValue');
    if (fv) {
      const filterValue = JSON.parse(fv);
      const parentAxis = elem.closest('li[data-nodeType="xAxis"],li[data-nodeType="yAxis"],li[data-nodeType="legend"]');
      if (!parentAxis) {
        return;
      }
      const parentNodeType = parentAxis.getAttribute('data-nodeType');
      let field;
      if (parentNodeType === 'xAxis') {
        field = (vlSpec.encoding.x as any)?.field;
      } else if (parentNodeType === 'yAxis') {
        field = (vlSpec.encoding.y as any)?.field;
      } else if (parentNodeType === 'legend') {
        // TODO this is bad (hardcoded channels for legend) and olli should
        // do something about this (pass the field with the AccessibilityTreeNode)
        field = (vlSpec.encoding.color as any)?.field || (vlSpec.encoding.color as any)?.condition?.field || (vlSpec.encoding.shape as any)?.field;
      }
      if (field) {
        selectionCallback(field, filterValue);
      }
    }
  };
  return onFocus;
}
