import dayjs from "dayjs";
import * as cql from 'compassql';
import { OlliDataset } from "olli";
import { UmweltSpec, VisualSpec, ElaboratedVisualSpec, AudioSpec, ElaboratedAudioSpec, MeasureType } from "../grammar/Types";

export function recommendVisuals(spec: UmweltSpec, data: OlliDataset, partial?: Partial<VisualSpec>): ElaboratedVisualSpec {
  const encodings = [];
  if (partial?.encoding) {
    const encoding = partial?.encoding;
    if (Object.keys(encoding).includes('facet')) {
      return partial as any; // for some reason cql barfs on facet
    }
    Object.keys(encoding).forEach(channel => {
      encodings.push({
        channel,
        ...(encoding as any)[channel]
      })
    })
  }
  spec.fields.forEach((fieldDef) => {
    if (encodings.some(e => e.field === fieldDef.name)) {
      return;
    }
    let channel = "?";
    encodings.push({
      channel,
      field: fieldDef.name,
      type: fieldDef.type
    });
  });

  const schema = cql.schema.build(data);
  const query = {
    "spec": {
      "data": spec.data,
      "mark": partial?.mark || "?",
      encodings
    },
    "orderBy": "effectiveness"
  }
  const output = cql.recommend(query, schema);
  const result = output.result;
  const specs = [];
  cql.result.mapLeaves(result, function (item) {
    const spec = item.toSpec();
    specs.push(spec);
  });
  const topVlSpec = specs[0];
  if (topVlSpec.encoding.column) {
    topVlSpec.encoding.facet = topVlSpec.encoding.column;
    topVlSpec.encoding.facet.columns = 2;
    delete topVlSpec.encoding.column;
  }
  return {
    mark: topVlSpec.mark,
    encoding: topVlSpec.encoding
  };
}

export function recommendAudio(spec: UmweltSpec, data: OlliDataset, partial?: Partial<AudioSpec>): ElaboratedAudioSpec {
  // TODO write some clever inference for audio encodings and traversals lol.
  // should check for a quantitative field to assign to an encoding
  // should use information from the visual spec, if present, to inform inferences
  return partial as any;
}


export function typeInference(data: OlliDataset, field: string): MeasureType {
  const values = data.map(datum => datum[field]);

  // this function is mostly stolen from vega/datalib except i fixed the date bug
  function isBoolean(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  }

  function isDate(obj) {
    return toString.call(obj) === '[object Date]';
  };

  function isValid(obj) {
    return obj != null && obj === obj;
  };

  var TESTS = {
    boolean: function(x) { return x==='true' || x==='false' || isBoolean(x); },
    integer: function(x) { return TESTS.number(x) && (x=+x) === ~~x; },
    number: function(x) { return !isNaN(+x) && !isDate(x); },
    date: function(x) { return dayjs(x).isValid(); }
  };

  // types to test for, in precedence order
  var types = ['boolean', 'integer', 'number', 'date'];

  for (let i=0; i<values.length; ++i) {
    // get next value to test
    const v = values[i];
    // test value against remaining types
    for (let j=0; j<types.length; ++j) {
      if (isValid(v) && !TESTS[types[j]](v)) {
        types.splice(j, 1);
        j -= 1;
      }
    }
    // if no types left, return 'string'
    if (types.length === 0) break;
  }

  const inference = types.length ? types[0] : 'string';

  switch(inference) {
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
