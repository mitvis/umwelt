import { ElaboratedUmweltSpec, UmweltSpec, VlSpec } from "./Types"
import {VegaLiteAdapter} from 'olli-adapters';
import {OlliVisSpec} from "olli";
import { elaborate, elaborateFields } from "./elaborate";
import { getData, getFieldDef, typeCoerceData } from "../utils/data";

export * from './Types';

export async function umwelt(spec: UmweltSpec) {

  const data = await getData(spec);

  const elaboratedFields = elaborateFields(spec.fields, data);
  const niceData = typeCoerceData(data, elaboratedFields);

  const elaboratedSpec = elaborate(spec, niceData, elaboratedFields);

  console.log('elaborated', elaboratedSpec)

  const vlSpec = umweltToVegaLiteSpec(elaboratedSpec);
  const olliSpec = await umweltToOlliSpec(elaboratedSpec);

  console.log('vlSpec', vlSpec);

  return {
    data: niceData,
    vlSpec,
    olliSpec,
    uvSpec: elaboratedSpec
  };
}

function umweltToVegaLiteSpec(spec: ElaboratedUmweltSpec): VlSpec {
  if (spec.visual === false) {
    return null;
  }

  const params: any = [{
      "name": "brush",
      "select": "interval"
    }, {
      "name": "external_state",
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

  const condition = (encoding, paramName, value, empty?) => {
    const condition = {"param": paramName, "empty": empty || true, ...encoding};
    return {
      condition,
      value
    }
  };

  const encoding = spec.visual.encoding;

  return {
    data: spec.data,
    mark: spec.visual.mark === 'line' ? {type: 'line', point: true} : spec.visual.mark,
    encoding: {
      ...encoding,
      opacity: condition(encoding.opacity || {"value": 1}, "external_state", 0.3, false),
      color: condition(encoding.color || {"value": "navy"}, "brush", "grey")
    } as any,
    params
  }
}



async function umweltToOlliSpec(spec: ElaboratedUmweltSpec): Promise<OlliVisSpec> {
  const vlSpec = umweltToVegaLiteSpec(spec);
  const olliSpec = VegaLiteAdapter(vlSpec);
  return olliSpec;
}