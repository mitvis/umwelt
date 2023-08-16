import dayjs from 'dayjs';
import { OlliDataset } from 'olli';
import { AudioSpec, AudioUnitSpec, FieldDef, MeasureType, VisualSpec, VisualUnitSpec } from '../grammar/Types';
import { getDomain } from './data';
import { dateToTimeUnit } from './values';

export function elaborateFields(fields: FieldDef[], data: OlliDataset): FieldDef[] {
  return fields.map((fieldDef) => {
    const spec: FieldDef = {
      name: fieldDef.name,
      type: fieldDef.type || typeInference(data, fieldDef.name),
      scale: fieldDef.scale,
    };
    if (spec.type === 'temporal' && spec.name.toLowerCase() === 'year') {
      spec.timeUnit = 'year';
    }
    return spec;
  });
}

export function typeInference(data: OlliDataset, field: string): MeasureType {
  const values = data.map((datum) => datum[field]);

  // this function is mostly stolen from vega/datalib except i fixed the date bug
  function isBoolean(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  }

  function isDate(obj) {
    return toString.call(obj) === '[object Date]';
  }

  function isValid(obj) {
    return obj != null && obj === obj;
  }

  var TESTS = {
    boolean: function (x) {
      return x === 'true' || x === 'false' || isBoolean(x);
    },
    integer: function (x) {
      return TESTS.number(x) && (x = +x) === ~~x;
    },
    number: function (x) {
      return !isNaN(+x) && !isDate(x);
    },
    date: function (x) {
      return dayjs(x).isValid();
    },
  };

  // types to test for, in precedence order
  var types = ['boolean', 'integer', 'number', 'date'];

  for (let i = 0; i < values.length; ++i) {
    // get next value to test
    const v = values[i];
    // test value against remaining types
    for (let j = 0; j < types.length; ++j) {
      if (isValid(v) && !TESTS[types[j]](v)) {
        types.splice(j, 1);
        j -= 1;
      }
    }
    // if no types left, return 'string'
    if (types.length === 0) break;
  }

  const inference = types.length ? types[0] : 'string';

  switch (inference) {
    case 'boolean':
    case 'string':
      return 'nominal';
    case 'integer':
      const distinct = new Set(values).size;
      if (field.toLowerCase() === 'year') {
        if (distinct <= 5) {
          return 'ordinal';
        }
        return 'temporal';
      }
      // this logic is from compass
      const numberNominalProportion = 0.05;
      const numberNominalLimit = 40;
      if (distinct < numberNominalLimit && distinct / values.length < numberNominalProportion) {
        return 'nominal';
      } else {
        return 'quantitative';
      }
    case 'number':
      return 'quantitative';
    case 'date':
      return 'temporal';
  }
}

export const inferKey = (fields: FieldDef[], data: OlliDataset): string[] => {
  var combine = function (a, min) {
    var fn = function (n, src, got, all) {
      if (n == 0) {
        if (got.length > 0) {
          all[all.length] = got;
        }
        return;
      }
      for (var j = 0; j < src.length; j++) {
        fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
      }
      return;
    };
    var all = [];
    for (var i = min; i < a.length; i++) {
      fn(i, a, [], all);
    }
    all.push(a);
    return all;
  };

  const nonQuantFields = fields.filter((fieldDef) => fieldDef.type !== 'quantitative');
  const keyCandidates: FieldDef[][] = combine(nonQuantFields, 1);
  const shortestPossibleKeys = [];

  for (let i = 0; i < keyCandidates.length; i++) {
    const keyCandidate = keyCandidates[i];
    if (shortestPossibleKeys.length && keyCandidate.length > shortestPossibleKeys[0].length) {
      break;
    }
    const keyValues = data.map((datum) => {
      return keyCandidate
        .map((key) => {
          if (key.type === 'temporal' && key.timeUnit && datum[key.name] instanceof Date) {
            return dateToTimeUnit(datum[key.name], key.timeUnit);
          }
          return datum[key.name];
        })
        .join(',');
    });
    const uniqueKeyValues = new Set(keyValues);
    if (uniqueKeyValues.size === data.length) {
      shortestPossibleKeys.push(keyCandidate);
    }
  }

  if (shortestPossibleKeys.length === 0) {
    return [];
  }
  if (shortestPossibleKeys.length === 1) {
    return shortestPossibleKeys[0].map((fieldDef) => fieldDef.name);
  }
  return [];
};

export const inferUnitsFromKeys = (
  keys: FieldDef[],
  values: FieldDef[],
  data: OlliDataset
): {
  visual: VisualSpec;
  audio: AudioSpec;
} => {
  if (values.length === 1 && values[0].type === 'quantitative') {
    if (keys.length === 1) {
      // line and bar charts
      return {
        visual: {
          units: [
            {
              name: 'vis_unit_0',
              mark: keys[0].type === 'quantitative' ? 'point' : keys[0].type === 'temporal' ? 'line' : 'bar',
              encoding: {
                x: { field: keys[0].name },
                y: { field: values[0].name },
              },
            },
          ],
          composition: 'layer',
        },
        audio: {
          units: [
            {
              name: 'audio_unit_0',
              encoding: {
                pitch: { field: values[0].name },
              },
              traversal: [{ field: keys[0].name }],
            },
          ],
          composition: 'concat',
        },
      };
    }
    if (keys.length === 2) {
      const temporalKey = keys.find((key) => key.type === 'temporal'); // TODO handle timeUnit
      const categoricalKey = keys.find((key) => key.type === 'nominal' || key.type === 'ordinal');

      if (temporalKey && categoricalKey) {
        const categoricalDomainLength = getDomain({ ...categoricalKey, field: categoricalKey.name }, data).length;
        if (categoricalDomainLength > 5 || temporalKey.timeUnit) {
          // bubble plot
          return {
            visual: {
              units: [
                {
                  name: 'vis_unit_0',
                  mark: 'point',
                  encoding: {
                    x: { field: temporalKey.name },
                    y: { field: categoricalKey.name },
                    color: { field: categoricalKey.name },
                    size: { field: values[0].name },
                  },
                },
              ],
              composition: 'layer',
            },
            audio: {
              units: [
                {
                  name: 'audio_unit_0',
                  encoding: {
                    pitch: { field: values[0].name },
                  },
                  traversal: [{ field: categoricalKey.name }, { field: temporalKey.name }],
                },
              ],
              composition: 'concat',
            },
          };
        } else {
          // multi-series line
          return {
            visual: {
              units: [
                {
                  name: 'vis_unit_0',
                  mark: 'line',
                  encoding: {
                    x: { field: temporalKey.name },
                    y: { field: values[0].name },
                    color: { field: categoricalKey.name },
                  },
                },
              ],
              composition: 'layer',
            },
            audio: {
              units: [
                {
                  name: 'audio_unit_0',
                  encoding: {
                    pitch: { field: values[0].name },
                  },
                  traversal: [{ field: categoricalKey.name }, { field: temporalKey.name }],
                },
              ],
              composition: 'concat',
            },
          };
        }
      }
    }
    if (keys.length === 3) {
      // faceted dotplot
      const sortedKeys = [...keys].sort((a, b) => {
        const aDomainLength = getDomain({ ...a, field: a.name }, data).length;
        const bDomainLength = getDomain({ ...b, field: b.name }, data).length;
        // sort by shortest domain length first
        return aDomainLength - bDomainLength;
      });
      return {
        visual: {
          units: [
            {
              name: 'vis_unit_0',
              mark: 'point',
              encoding: {
                x: { field: values[0].name },
                y: { field: sortedKeys[2].name },
                color: { field: sortedKeys[0].name },
                facet: { field: sortedKeys[1].name },
              },
            },
          ],
          composition: 'layer',
        },
        audio: {
          units: [
            {
              name: 'audio_unit_0',
              encoding: {
                pitch: { field: values[0].name },
              },
              traversal: [{ field: sortedKeys[1].name }, { field: sortedKeys[2].name }, { field: sortedKeys[0].name }], // TODO double check order?
            },
          ],
          composition: 'concat',
        },
      };
    }
  }
  const quantValues = values.filter((f) => f.type === 'quantitative');
  if (quantValues.length === 2) {
    if (keys.length === 0) {
      if (values.length === 2) {
        // scatterplot
        const encodeValues = quantValues.filter((f) => !f.bin).length === 1 ? quantValues.filter((f) => !f.bin) : quantValues;
        return {
          visual: {
            units: [
              {
                name: 'vis_unit_0',
                mark: 'point',
                encoding: {
                  x: { field: quantValues[0].name },
                  y: { field: quantValues[1].name },
                },
              },
            ],
            composition: 'layer',
          },
          audio: {
            units: encodeValues.map((f, i) => {
              return {
                name: `audio_unit_${i}`,
                encoding: {
                  pitch: { field: f.name, aggregate: 'mean' },
                },
                traversal: quantValues
                  .filter((field) => field.name !== f.name)
                  .map((f) => {
                    return { field: f.name, bin: true };
                  }),
              };
            }),
            composition: 'concat',
          },
        };
      }
      if (values.length === 3) {
        if (keys.length === 0) {
          const notQuantValue = values.find((f) => f.type !== 'quantitative');
          // scatterplot with color
          const encodeValues = quantValues.filter((f) => !f.bin).length === 1 ? quantValues.filter((f) => !f.bin) : quantValues;
          return {
            visual: {
              units: [
                {
                  name: 'vis_unit_0',
                  mark: 'point',
                  encoding: {
                    x: { field: quantValues[0].name },
                    y: { field: quantValues[1].name },
                    color: { field: notQuantValue.name },
                  },
                },
              ],
              composition: 'layer',
            },
            audio: {
              units: encodeValues.map((f, i) => {
                return {
                  name: `audio_unit_${i}`,
                  encoding: {
                    pitch: { field: f.name, aggregate: 'mean' },
                  },
                  traversal: quantValues
                    .filter((field) => field.name !== f.name)
                    .map((f) => {
                      return { field: f.name, bin: true };
                    }),
                };
              }),
              composition: 'concat',
            },
          };
        }
      }
    }
    if (keys.length === 1 && (keys[0].type === 'temporal' || keys[0].type === 'ordinal')) {
      // connected scatterplot
      return {
        visual: {
          units: [
            {
              name: 'vis_unit_0',
              mark: 'line',
              encoding: {
                x: { field: quantValues[0].name },
                y: { field: quantValues[1].name },
                order: { field: keys[0].name },
              },
            },
          ],
          composition: 'layer',
        },
        audio: {
          units: [
            {
              name: 'audio_unit_0',
              encoding: {
                pitch: { field: quantValues[0].name },
              },
              traversal: [{ field: keys[0].name }],
            },
            {
              name: 'audio_unit_1',
              encoding: {
                pitch: { field: quantValues[1].name },
              },
              traversal: [{ field: keys[0].name }],
            },
          ],
          composition: 'concat',
        },
      };
    }
  }
};
