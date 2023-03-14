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

export function removeAnnoyingLineColorConditional(vgSpec: VgSpec): VgSpec {
  vgSpec = structuredClone(vgSpec);
  const mark = (vgSpec.marks?.find(m => m.name === 'layer_0_pathgroup') as GroupMark)?.marks?.find(m => m.name === 'layer_0_marks');
  const condition = mark?.encode?.update?.stroke;
  if (mark && condition && Array.isArray(condition) && condition.length) {
    const cond0 = condition[0] as any;
    if (cond0.test) {
      condition[0] = {
        ...condition[0],
        test: `!length(data(\"brush_store\"))`
      };
      mark.encode.update.stroke = condition;
    }
  }
  return vgSpec;
}
