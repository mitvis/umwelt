import { NONE, UmweltSpec, VlSpec } from './Types';
import { VegaLiteAdapter } from 'olli-adapters';
import { OlliSpec, OlliDataset } from 'olli';

export * from './Types';

export function umweltToVegaLiteSpec(spec: UmweltSpec, data: OlliDataset): VlSpec {
  if (spec.visual === false || spec.visual.units.length === 0) {
    return null;
  }

  const countEncodings = spec.visual.units
    .map((unit) => {
      return Object.values(unit.encoding).length;
    })
    .reduce((a, b) => a + b, 0);

  if (countEncodings === 0) return null;

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
        encoding[channel] = Object.fromEntries(Object.entries(encoding[channel]).filter(([k, v]) => v !== NONE));
        if (channel === 'facet') {
          encoding[channel] = {
            ...encoding[channel],
            columns: 2,
          } as any;
        }
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
        [op]: units.map((unit, idx) => {
          const compiled = compileUnits({
            ...spec,
            visual: {
              units: [unit],
              composition: op,
            },
          });
          if (idx === 0) {
            compiled['params'] = params;
          }
          return compiled;
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
    const condition = { param: paramName, empty: empty || true, ...encoding };
    return {
      condition,
      value,
    };
    // return encoding; // TODO
  };

  const compiled = compileUnits(spec);
  if ('mark' in compiled) {
    return {
      data: { values: data },
      params,
      ...compiled,
    };
  } else {
    return {
      data: { values: data },
      ...compiled,
    };
  }
}

export async function umweltToOlliSpec(spec: UmweltSpec, vlSpec: VlSpec, data: OlliDataset): Promise<OlliSpec> {
  if (spec.text === false) return null;
  let olliSpec: OlliSpec;
  if (vlSpec) {
    olliSpec = await VegaLiteAdapter(vlSpec as any);
  } else {
    olliSpec = {
      data,
      fields: [],
    };
  }
  if (olliSpec.fields.length === 0) {
    delete olliSpec.mark;
    delete olliSpec.axes;
    delete olliSpec.legends;
  }
  if (spec.audio) {
    spec.audio.units.forEach((unit) => {
      Object.values(unit.encoding).forEach((encoding) => {
        // if olliSpec does not have field, add it
        if (!olliSpec.fields.find((f) => f.field === encoding.field)) {
          const fieldDef = spec.fields.find((f) => f.name === encoding.field);
          olliSpec.fields.push({
            field: encoding.field,
            type: fieldDef.type,
            timeUnit: encoding.timeUnit ?? fieldDef.timeUnit,
          });
        }
      });
      unit.traversal.forEach((traversal) => {
        if (!olliSpec.fields.find((f) => f.field === traversal.field)) {
          const fieldDef = spec.fields.find((f) => f.name === traversal.field);
          olliSpec.fields.push({
            field: traversal.field,
            type: fieldDef.type,
            timeUnit: traversal.timeUnit ?? fieldDef.timeUnit,
          });
        }
      });
    });
  }
  if (olliSpec.fields.length === 0) {
    olliSpec.fields = spec.fields.map((field) => {
      return {
        ...field,
        field: field.name,
      };
    });
  }
  return olliSpec;
}
