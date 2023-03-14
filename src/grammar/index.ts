import { ElaboratedUmveltSpec, UmveltSpec, VlSpec } from "./Types"
import {VegaLiteAdapter} from 'olli-adapters';
import {OlliVisSpec} from "olli";
import { elaborate } from "./elaborate";
import { getData, getFieldDef, typeCoerceData } from "../utils/data";

export * from './Types';

export async function umvelt(spec: UmveltSpec) {

  const data = await getData(spec);

  const elaboratedSpec = elaborate(spec, data);

  const vlSpec = umveltToVegaLiteSpec(elaboratedSpec);
  const olliSpec = await umveltToOlliSpec(elaboratedSpec);

  const niceData = typeCoerceData(data, elaboratedSpec.fields);

  return {
    data: niceData,
    vlSpec,
    olliSpec,
    uvSpec: elaboratedSpec
  };
}

function umveltToVegaLiteSpec(spec: ElaboratedUmveltSpec): VlSpec {
  if (spec.visual === false) {
    return null;
  }

  const params: any = [{
      "name": "brush",
      "select": "interval"
    }];

  if (spec.visual.mark === 'line' || spec.visual.mark === 'bar') {
    const yField = spec.visual.encoding.y.field;
    const xField = spec.visual.encoding.x.field;
    const yFieldDef = getFieldDef(yField, spec.fields)
    const xFieldDef = getFieldDef(xField, spec.fields)
    if (yFieldDef.type === 'quantitative' && xFieldDef.type !== 'quantitative') {
      params[0]["select"] = {'type': 'interval', 'encodings': ['x']};
    }
    else if (xFieldDef.type === 'quantitative' && yFieldDef.type !== 'quantitative') {
      params[0]["select"] = {'type': 'interval', 'encodings': ['y']};
    }
  }

  const condition = (encoding, paramName) => {
    const condition = {"param": paramName, ...encoding};
    return {
      condition,
      value: "grey"
    }
  };

  const encoding = spec.visual.encoding;

  return {
    data: spec.data,
    mark: spec.visual.mark === 'line' ? {type: 'line', point: {size: 20}} : spec.visual.mark,
    encoding: {
      ...encoding,
      color: condition(encoding.color, "brush")
    },
    params
  }
}



async function umveltToOlliSpec(spec: ElaboratedUmveltSpec): Promise<OlliVisSpec> {
  const vlSpec = umveltToVegaLiteSpec(spec);
  return VegaLiteAdapter(vlSpec);
}