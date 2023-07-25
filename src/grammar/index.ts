import { UmweltSpec, VlSpec } from './Types';
import { VegaLiteAdapter } from 'olli-adapters';
import { OlliSpec, OlliDataset } from 'olli';
import { elaborate, elaborateFields } from './elaborate';
import { getData, typeCoerceData } from '../utils/data';

export * from './Types';

export interface UmweltOutput {
  data: OlliDataset;
  vlSpec: VlSpec;
  olliSpec: OlliSpec;
  uwSpec: UmweltSpec;
}

export async function umwelt(spec: UmweltSpec): Promise<UmweltOutput> {
  const data = await getData(spec.data);

  const elaboratedFields = elaborateFields(spec.fields, data);
  const niceData = typeCoerceData(data, elaboratedFields);

  const elaboratedSpec = elaborate(spec, niceData, elaboratedFields);

  console.log('elaborated', elaboratedSpec);

  const vlSpec = umweltToVegaLiteSpec(elaboratedSpec);
  const olliSpec = await umweltToOlliSpec(elaboratedSpec, vlSpec);

  return {
    data: niceData,
    vlSpec,
    olliSpec,
    uwSpec: elaboratedSpec,
  };
}

export function umweltToVegaLiteSpec(spec: UmweltSpec, data: OlliDataset): VlSpec {
  if (spec.visual === false || spec.visual.units.length === 0) {
    return null;
  }

  const params: any = [
    {
      name: 'brush',
      select: 'interval',
    },
    {
      name: 'external_state',
      select: 'interval',
    },
  ];

  function compileUnits(spec: UmweltSpec) {
    if (spec.visual === false) {
      return null;
    }
    const units = spec.visual.units;

    if (units.length === 1) {
      const unit = units[0];
      const encoding = structuredClone(unit.encoding);
      Object.keys(encoding).forEach((channel) => {
        const { name, encodings, ...fieldDef } = spec.fields.find((field) => field.name === encoding[channel].field);
        encoding[channel] = {
          ...fieldDef,
          ...encoding[channel],
        };
      });
      return {
        mark: unit.mark === 'line' ? { type: 'line', point: true } : unit.mark,
        encoding: {
          ...encoding,
          opacity: condition(encoding.opacity || { value: 1 }, 'external_state', 0.3, false),
          color: condition(encoding.color || { value: 'navy' }, 'brush', 'grey'),
        },
      };
    } else if (units.length > 1) {
      const op = spec.visual.composition || 'layer';
      return {
        columns: op === 'concat' ? (units.length < 3 ? 1 : 2) : undefined,
        [op]: units.map((unit) => {
          return compileUnits({
            ...spec,
            visual: {
              units: [unit],
            },
          });
        }),
      };
    }
  }

  if (spec.visual.units[0].mark === 'line' || spec.visual.units[0].mark === 'bar') {
    const unit = spec.visual.units[0];
    const yField = unit.encoding.y?.field;
    const xField = unit.encoding.x?.field;
    const yFieldDef = spec.fields.find((field) => field.name === yField);
    const xFieldDef = spec.fields.find((field) => field.name === xField);
    if (yFieldDef?.type === 'quantitative' && xFieldDef?.type !== 'quantitative') {
      params[0]['select'] = { type: 'interval', encodings: ['x'] };
    } else if (xFieldDef?.type === 'quantitative' && yFieldDef?.type !== 'quantitative') {
      params[0]['select'] = { type: 'interval', encodings: ['y'] };
    }
  }

  const condition = (encoding, paramName, value, empty?) => {
    // const condition = { param: paramName, empty: empty || true, ...encoding };
    // return {
    //   condition,
    //   value,
    // };
    return encoding; // TODO
  };

  return {
    data: { values: data },
    // params, // TODO
    ...compileUnits(spec),
  };
}

export async function umweltToOlliSpec(spec: ElaboratedUmweltSpec, vlSpec: VlSpec): Promise<OlliSpec> {
  if (spec.text === false) return null;
  const olliSpec = await VegaLiteAdapter(vlSpec as any);
  olliSpec.fields = spec.fields.map((fieldDef) => {
    const { name, ...rest } = fieldDef;
    return {
      ...rest,
      field: fieldDef.name,
    };
  });
  if (spec.text !== true) {
    olliSpec.structure = spec.text;
  }
  // const { data, ...print } = olliSpec;
  // console.log('umwelt olliSpec', JSON.stringify(print));
  // console.log('olliSpec', olliSpec);
  return olliSpec;
}
