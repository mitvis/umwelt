import { SceneGroup, parse, View, GroupMark, Axis, Scene, SceneItem } from "vega";
import { VgSpec } from "../grammar/Types";

export async function getVegaScene(spec: VgSpec): Promise<SceneGroup> {
  const runtime = parse(spec);
  let view = await new View(runtime)
  .renderer('svg')
  .hover()
  .runAsync();

  return (view.scenegraph() as any).root.items[0] as SceneGroup
}

export function editLinePointConditionalBehavior(vgSpec: VgSpec): VgSpec {
  vgSpec = structuredClone(vgSpec);
  const line = (vgSpec.marks?.find(m => m.name === 'layer_0_pathgroup') as GroupMark)?.marks?.find(m => m.name === 'layer_0_marks');
  const lineCondition = line?.encode?.update?.stroke;
  if (line && lineCondition && Array.isArray(lineCondition) && lineCondition.length) {
    // make the line always solid
    const cond0 = lineCondition[0] as any;
    // if (cond0.test) {
    //   condition[0] = {
    //     ...condition[0],
    //     test: `!length(data(\"brush_store\"))`
    //   };
    //   mark.encode.update.stroke = condition;
    // }
    const {test, ...other} = cond0;
    line.encode.update.stroke = other;
  }
  const symbol = vgSpec.marks?.find(m => m.name === 'layer_1_marks');
  const symbolUpdate = symbol?.encode?.update;
  const symbolCondition = symbolUpdate?.fill;
  if (symbol && symbolUpdate && symbolCondition && Array.isArray(symbolCondition) && symbolCondition.length) {
    // always fill the symbol
    const cond0 = symbolCondition[0] as any;
    const {test, ...other} = cond0;
    line.encode.update.stroke = other;

    symbolUpdate.opacity = [ {test: 'vlSelectionTest("brush_store", datum)', value: 1}, {value: 0}];
  }
  return vgSpec;
}
