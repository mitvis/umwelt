import { UmweltSpec, VlSpec } from './Types';
import { VegaLiteAdapter } from 'olli-adapters';
import { OlliSpec, OlliDataset } from 'olli';

export * from './Types';

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

export async function umweltToOlliSpec(spec: UmweltSpec, vlSpec: VlSpec): Promise<OlliSpec> {
  if (spec.text === false) return null;
  const olliSpec: OlliSpec = await VegaLiteAdapter(vlSpec as any);
  return olliSpec;
}
