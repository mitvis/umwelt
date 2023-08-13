import dayjs from 'dayjs';
import { OlliDataset } from 'olli';
import { AudioUnitSpec, FieldDef, MeasureType, VisualUnitSpec } from '../grammar/Types';
import { getDomain } from './data';
import { dateToTimeUnit } from './values';

export function elaborateFields(fields: FieldDef[], data: OlliDataset): FieldDef[] {
  return fields.map((fieldDef) => {
    return {
      name: fieldDef.name,
      type: fieldDef.type || typeInference(data, fieldDef.name),
      scale: fieldDef.scale,
    };
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
      if (field.toLowerCase() === 'year') return 'temporal';
      // this logic is from compass
      const numberNominalProportion = 0.05;
      const numberNominalLimit = 40;
      const distinct = new Set(values).size;
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
          if (key.type === 'temporal' && key.timeUnit) {
            if (!(datum[key.name] instanceof Date)) {
              datum[key.name] = new Date(datum[key.name]);
            }
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
  visual: VisualUnitSpec;
  audio: AudioUnitSpec;
} => {
  if (values.length === 1 && values[0].type === 'quantitative') {
    if (keys.length === 1) {
      return {
        visual: {
          name: 'visual_unit_0',
          mark: keys[0].type === 'quantitative' ? 'point' : keys[0].type === 'temporal' ? 'line' : 'bar',
          encoding: {
            x: { field: keys[0].name },
            y: { field: values[0].name },
          },
        },
        audio: {
          name: 'audio_unit_0',
          encoding: {
            pitch: { field: values[0].name },
          },
          traversal: [{ field: keys[0].name }],
        },
      };
    }
    if (keys.length === 2) {
      const temporalKey = keys.find((key) => key.type === 'temporal' && !key.timeUnit); // TODO handle timeUnit
      const categoricalKey = keys.find((key) => key.type === 'nominal' || key.type === 'ordinal');

      if (temporalKey && categoricalKey) {
        return {
          visual: {
            name: 'visual_unit_0',
            mark: 'line',
            encoding: {
              x: { field: temporalKey.name },
              y: { field: values[0].name },
              color: { field: categoricalKey.name },
            },
          },
          audio: {
            name: 'audio_unit_0',
            encoding: {
              pitch: { field: values[0].name },
            },
            traversal: [{ field: categoricalKey.name }, { field: temporalKey.name }],
          },
        };
      }
    }
    if (keys.length === 3) {
      const sortedKeys = [...keys].sort((a, b) => {
        const aDomainLength = getDomain({ ...a, field: a.name }, data).length;
        const bDomainLength = getDomain({ ...b, field: b.name }, data).length;
        // sort by shortest domain length first
        return aDomainLength - bDomainLength;
      });
      return {
        visual: {
          name: 'visual_unit_0',
          mark: 'point',
          encoding: {
            x: { field: values[0].name },
            y: { field: sortedKeys[2].name },
            color: { field: sortedKeys[0].name },
            facet: { field: sortedKeys[1].name },
          },
        },
        audio: {
          name: 'audio_unit_0',
          encoding: {
            pitch: { field: values[0].name },
          },
          traversal: [{ field: sortedKeys[1].name }, { field: sortedKeys[2].name }, { field: sortedKeys[0].name }], // TODO double check order?
        },
      };
    }
  }
};
