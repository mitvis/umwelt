import { OlliDataset } from 'olli';
import { compile } from 'vega-lite';
import { UmweltDataSource } from '../grammar/Types';
import { getVegaScene } from './vega';

export async function getData(spec: UmweltDataSource): Promise<OlliDataset> {
  const data = structuredClone(spec) as any;
  if ('url' in data) {
    if (data.url.startsWith('/')) {
      data.url = 'https://mitvis.github.io/umwelt' + data.url;
    } else if (data.url.startsWith('data/')) {
      data.url = 'https://raw.githubusercontent.com/vega/vega-datasets/master/' + data.url;
    }
  }

  const vlSpec = {
    data: data,
    mark: 'point',
  };

  const scene = await getVegaScene(compile(vlSpec as any).spec);

  try {
    const datasets = (scene as any).context.data;
    const names = Object.keys(datasets).filter((name) => {
      return name.match(/(source)|(data)_\d/);
    });
    const name = names.reverse()[0]; // TODO do we know this is the right one?
    const dataset = datasets[name].values.value;

    return dataset;
  } catch (error) {
    console.warn(`No data found in the Vega scenegraph \n ${error}`);
    return [];
  }
}

// export function typeCoerceData(data: OlliDataset, fields: ElaboratedFieldDef[]): OlliDataset {
//   // convert temporal fields into date objects converts quantitative into numbers
//   const lookup = Object.fromEntries(fields.map((f) => [f.name, f.type]));
//   return data.map((datum) => {
//     return Object.fromEntries(
//       Object.entries(datum).map(([field, value]: [string, OlliValue]) => {
//         switch (lookup[field]) {
//           case 'temporal':
//             return [field, new Date(value)];
//           case 'quantitative':
//             if (isString(value) && isNumeric(String(value))) {
//               return [field, Number(value)];
//             }
//         }
//         return [field, value];
//       })
//     );
//   });
// }

// export function getDomain(fieldDef: ElaboratedEncodingFieldDef, data: OlliDataset, selectionSpec?: SelectionSpec): OlliValue[] {
//   const unique_vals = new Set<OlliValue>();
//   const dataset = selectionSpec ? selectionTest(data, selectionSpec) : data;
//   // TODO account for domain overrides in the field def
//   dataset
//     .map((d) => d[fieldDef.field])
//     .forEach((v) => {
//       unique_vals.add(v);
//     });
//   return [...unique_vals].filter((x) => x !== null && x !== undefined).sort((a: any, b: any) => a - b);
// }

// export function getFieldDef(field: string, fields: ElaboratedFieldDef[]): ElaboratedFieldDef {
//   return fields.find((f) => f.name === field);
// }
