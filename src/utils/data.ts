import { OlliDataset, OlliValue } from "olli";
import { isString } from "vega";
import { compile } from "vega-lite";
import { ElaboratedFieldDef, UmweltSpec } from "../grammar/Types";
import { isNumeric } from "./values";
import { getVegaScene } from "./vega-helpers";

export async function getData(spec: UmweltSpec): Promise<OlliDataset> {

  const data = structuredClone(spec.data) as any;

  if (data.url) {
    if (data.url.startsWith('/')) {
      data.url = 'https://mitvis.github.io/umwelt' + data.url;
    }
    else if (data.url.startsWith('data/')) {
      data.url = 'https://raw.githubusercontent.com/vega/vega-datasets/master/' + data.url;
    }
  }

  const vlSpec = {
    data: data,
    mark: "point"
  }

  const scene = await getVegaScene(compile(vlSpec as any).spec);

  try {
    const datasets = (scene as any).context.data;
    const names = Object.keys(datasets).filter(name => {
      return name.match(/(source)|(data)_\d/);
    });
    const name = names.reverse()[0]; // TODO do we know this is the right one?
    const dataset = datasets[name].values.value;

    return dataset;
  } catch (error) {
    throw new Error(`No data found in the Vega scenegraph \n ${error}`)
  }
}

export function typeCoerceData(data: OlliDataset, fields: ElaboratedFieldDef[]): OlliDataset {
  // convert temporal fields into date objects converts quantitative into numbers
  const lookup = Object.fromEntries(fields.map(f => [f.name, f.type]));
  return data.map(datum => {
    return Object.fromEntries(
      Object.entries(datum).map(([field, value]) => {
        switch(lookup[field]) {
          case 'temporal':
            return [field, new Date(value)];
          case 'quantitative':
            if (isString(value) && isNumeric(String(value)) ) {
              return [field, Number(value)];
            }
        }
        return [field, value];
      })
    );
  });
}


export function getDomain(field: string, data: OlliDataset): OlliValue[] {
  const unique_vals = new Set<OlliValue>();
  data.map(d => d[field]).forEach((v) => {
    unique_vals.add(v);
  });
  return [...unique_vals].filter(x => x).sort((a: any, b: any) => a - b);
}

export function getFieldDef(field: string, fields: ElaboratedFieldDef[]): ElaboratedFieldDef {
  return fields.find(f => f.name === field);
}