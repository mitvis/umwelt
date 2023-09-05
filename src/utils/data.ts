import { OlliDataset, OlliValue } from 'olli';
import { isNumber, isString } from 'vega';
import { compile } from 'vega-lite';
import { EncodingFieldDef, FieldDef, UmweltDataSource, UmweltPredicate } from '../grammar/Types';
import { selectionTest } from './selection';
import { dateToTimeUnit, isNumeric } from './values';
import { getVegaScene } from './vega';
import moize from 'moize';

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

export async function getTransformedData(data: OlliDataset, fields: FieldDef[]): Promise<OlliDataset> {
  const vlSpec = {
    data: { values: data },
    transform: [],
    mark: 'point',
  };

  if (fields) {
    fields.forEach((fieldDef) => {
      if (fieldDef.aggregate) {
        const groupBy = fields.filter((f) => f.bin || f.timeUnit).map((f) => f.name);
        if (groupBy.length) {
          vlSpec.transform.push({ aggregate: [{ op: fieldDef.aggregate, field: fieldDef.name, as: fieldDef.name }], groupby: groupBy });
        }
      }
      if (fieldDef.bin) {
        vlSpec.transform.push({ bin: fieldDef.bin, field: fieldDef.name, as: fieldDef.name });
      }
      if (fieldDef.timeUnit) {
        vlSpec.transform.push({ timeUnit: fieldDef.timeUnit, field: fieldDef.name, as: fieldDef.name });
      }
    });
  }

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

export function typeCoerceData(data: OlliDataset, fields: FieldDef[]): OlliDataset {
  // convert temporal fields into date objects converts quantitative into numbers
  const lookup = Object.fromEntries(fields.map((f) => [f.name, f.type]));

  if (data.length === 0) return data;
  if (JSON.stringify(typeCoerceDatum(lookup, data[0])) === JSON.stringify(data[0])) return data; // no type coercion needed

  return data.map((datum) => {
    return typeCoerceDatum(lookup, datum);
  });
}

function typeCoerceDatum(lookup, datum) {
  return Object.fromEntries(
    Object.entries(datum).map(([field, value]: [string, OlliValue]) => {
      switch (lookup[field]) {
        case 'temporal':
          if (field.toLowerCase() === 'year') {
            if (isNumber(value) || (isString(value) && isNumeric(String(value)))) {
              return [field, new Date(Number(value), 0, 1)];
            } else if (isString(value)) {
              return [field, new Date(value)];
            }
          }
          return [field, new Date(value)];
        case 'quantitative':
          if (value instanceof Date) {
            return [field, value.getTime()];
          }
          if (isString(value) && isNumeric(String(value))) {
            return [field, Number(value)];
          }
      }
      return [field, value];
    })
  );
}

export function cleanData(data: OlliDataset, fields: FieldDef[]): OlliDataset {
  // remove rows with null or undefined values
  return data.filter((datum) => {
    return Object.entries(datum).every(([field, value]: [string, OlliValue]) => {
      if (fields.find((f) => f.name === field)) {
        return value !== null && value !== undefined;
      }
      return true;
    });
  });
}

export const getDomain = moize((fieldDef: EncodingFieldDef, data: OlliDataset, predicate?: UmweltPredicate): OlliValue[] => {
  const unique_vals = new Set<OlliValue>();
  const dataset = predicate ? selectionTest(data, predicate) : data;
  // TODO account for domain overrides in the field def
  if ('timeUnit' in fieldDef && fieldDef.timeUnit) {
    const unique_time_vals = new Set<string>();
    dataset
      .map((d) => d[fieldDef.field])
      .forEach((v) => {
        if (v instanceof Date && 'timeUnit' in fieldDef) {
          const time_val = dateToTimeUnit(v, fieldDef.timeUnit);
          if (!unique_time_vals.has(time_val)) {
            unique_time_vals.add(time_val);
            unique_vals.add(v);
          }
        }
      });
  } else {
    const unique_time_vals = new Set<number>();
    dataset
      .map((d) => d[fieldDef.field])
      .forEach((v) => {
        if (v instanceof Date) {
          const time_val = v.getTime();
          if (!unique_time_vals.has(time_val)) {
            unique_time_vals.add(time_val);
            unique_vals.add(v);
          }
        } else {
          unique_vals.add(v);
        }
      });
  }
  return [...unique_vals].filter((x) => x !== null && x !== undefined).sort((a: any, b: any) => a - b);
});

export function getFieldDef(field: string, fields: FieldDef[]): FieldDef {
  return fields.find((f) => f.name === field);
}
