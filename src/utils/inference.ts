import dayjs from 'dayjs';
import { OlliDataset } from 'olli';
import { FieldDef, MeasureType } from '../grammar/Types';
import { getDomain } from './data';

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

  const possibleKeys = keyCandidates.filter((keyCandidate) => {
    const keyValues = data.map((datum) => {
      return keyCandidate.map((key) => datum[key.name]).join(',');
    });
    const uniqueKeyValues = new Set(keyValues);
    return uniqueKeyValues.size === data.length;
  });

  const lengthOfShortestPossibleKey = Math.min(...possibleKeys.map((keyCandidate) => keyCandidate.length));
  const shortestPossibleKeys = possibleKeys.filter((keyCandidate) => {
    return keyCandidate.length === lengthOfShortestPossibleKey;
  });
  if (shortestPossibleKeys.length === 0) {
    return [];
  }
  if (shortestPossibleKeys.length === 1) {
    return shortestPossibleKeys[0].map((fieldDef) => fieldDef.name);
  }
  return [];
};
