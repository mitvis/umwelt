import { OlliDataset, OlliDatum, OlliValue } from 'olli';
import { isDate, toNumber, isArray, inrange } from 'vega';
import { LogicalAnd, LogicalComposition } from 'vega-lite/src/logical';
import { FieldPredicate, FieldEqualPredicate, FieldLTPredicate, FieldGTPredicate, FieldLTEPredicate, FieldGTEPredicate, FieldRangePredicate, FieldOneOfPredicate, FieldValidPredicate } from 'vega-lite/src/predicate';
import { SelectionSpec } from '../grammar/Types';

const TYPE_ENUM = 'E',
  TYPE_RANGE_INC = 'R',
  TYPE_RANGE_EXC = 'R-E',
  TYPE_RANGE_LE = 'R-LE',
  TYPE_RANGE_RE = 'R-RE',
  TYPE_PRED_LT = 'LT',
  TYPE_PRED_LTE = 'LTE',
  TYPE_PRED_GT = 'GT',
  TYPE_PRED_GTE = 'GTE',
  TYPE_PRED_VALID = 'VALID',
  TYPE_PRED_ONE_OF = 'ONE',
  UNIT_INDEX = 'index:unit';

export const predicateToTupleType = (predicate: FieldPredicate) => {
  if ((predicate as FieldEqualPredicate).equal) {
    return TYPE_ENUM;
  } else if ((predicate as FieldLTPredicate).lt) {
    return TYPE_PRED_LT;
  } else if ((predicate as FieldGTPredicate).gt) {
    return TYPE_PRED_GT;
  } else if ((predicate as FieldLTEPredicate).lte) {
    return TYPE_PRED_LTE;
  } else if ((predicate as FieldGTEPredicate).gte) {
    return TYPE_PRED_GTE;
  } else if ((predicate as FieldRangePredicate).range) {
    return TYPE_RANGE_INC;
  } else if ((predicate as FieldOneOfPredicate).oneOf) {
    return TYPE_PRED_ONE_OF;
  } else if ((predicate as FieldValidPredicate).valid) {
    return TYPE_PRED_VALID;
  }
  return 'E'; // shrug
};

export const tupleTypeToPredicate = (type: string) => {
  switch (type) {
    case TYPE_ENUM:
      return 'equal';
    case TYPE_PRED_LT:
      return 'lt';
    case TYPE_PRED_GT:
      return 'gt';
    case TYPE_PRED_LTE:
      return 'lte';
    case TYPE_PRED_GTE:
      return 'gte';
    case TYPE_RANGE_INC:
      return 'range';
    case TYPE_PRED_VALID:
      return 'valid';
  }
  return 'equal'; // shrug
};

export function selectionStoreToSelectionSpec(store): SelectionSpec {
  if (store.length) {
    const tuple = store[0];
    const and: FieldPredicate[] = tuple.fields.map((f, idx) => {
      const predicate = {
        field: f.field,
      };
      const p = tupleTypeToPredicate(f.type);
      predicate[p] = tuple.values[idx];
      return predicate;
    });
    if (and.length > 1) {
      return {
        predicate: {
          and,
        },
      };
    } else {
      return {
        predicate: and[0],
      };
    }
  } else {
    return { predicate: { and: [] } };
  }
}

export function predicateToSelectionStore(predicate: LogicalComposition<FieldPredicate>) {
  if (predicate) {
    const getPredValue = (p: FieldPredicate): OlliValue | [number, number] => {
      const key = Object.keys(p).find((k) => k !== 'field')!; // find the value key e.g. 'eq', 'lte'
      const value = p[key];
      return value;
    };
    if ('and' in predicate) {
      const and = predicate.and;
      const stores = and.map((p) => predicateToSelectionStore(p));
      const tuple_fields = stores.flatMap((store) => {
        return store?.fields || [];
      });
      const tuple_values = stores.flatMap((store) => {
        return store?.values || [];
      });
      return {
        unit: '',
        fields: tuple_fields,
        values: tuple_values,
      };
    } else if ('or' in predicate) {
      const or = predicate.or;
      // TODO this would likely require changes to vega.
    } else if ('not' in predicate) {
      const not = predicate.not;
      // TODO same as above
    } else {
      // predicate is FieldPredicate
      const tuple_fields = [
        {
          type: predicateToTupleType(predicate),
          field: predicate.field,
        },
      ];
      const tuple_values = [getPredValue(predicate)];
      if (!tuple_fields.length && !tuple_values.length) {
        return null;
      }
      return {
        unit: '',
        fields: tuple_fields,
        values: tuple_values,
      };
    }
    // if (!tuple_fields.length && !tuple_values.length) {
    //   return null;
    // }
  }
}

export function selectionTest(data: OlliDataset, selectionSpec: SelectionSpec): OlliDataset {
  try {
    const store = predicateToSelectionStore(selectionSpec.predicate);
    if (!store) return data;
    return data.filter((datum) => {
      return testPoint(datum, store);
    });
  } catch (e) {
    console.error(e);
    return data;
  }
}

function testPoint(datum, entry) {
  var fields = entry.fields,
    values = entry.values,
    dval;

  return fields.every((f, i) => {
    dval = datum[f.field];

    if (isDate(dval)) dval = toNumber(dval);
    if (isDate(values[i])) values[i] = toNumber(values[i]);
    if (isDate(values[i][0])) values[i] = values[i].map(toNumber);

    switch (f.type) {
      case TYPE_ENUM:
        // Enumerated fields can either specify individual values (single/multi selections)
        // or an array of values (interval selections).
        return !(isArray(values[i]) ? values[i].indexOf(dval) < 0 : dval !== values[i]);
      case TYPE_RANGE_INC:
        return inrange(dval, values[i], true, true);
      case TYPE_RANGE_RE:
        // Discrete selection of bins test within the range [bin_start, bin_end).
        return inrange(dval, values[i], true, false);
      case TYPE_RANGE_EXC: // 'R-E'/'R-LE' included for completeness.
        return inrange(dval, values[i], false, false);
      case TYPE_RANGE_LE:
        return inrange(dval, values[i], false, true);
      case TYPE_PRED_LT:
        return dval < values[i];
      case TYPE_PRED_GT:
        return dval > values[i];
      case TYPE_PRED_LTE:
        return dval <= values[i];
      case TYPE_PRED_GTE:
        return dval >= values[i];
      case TYPE_PRED_VALID:
        return !(dval === null || isNaN(dval));
      default:
        return true;
    }
  });
}

export function datumToPredicate(datum: OlliDatum, fields): LogicalAnd<FieldEqualPredicate> {
  const fieldNames = fields.map((f) => f.field || f.name); // TODO
  return {
    and: fieldNames.map((field) => {
      return {
        field: field,
        equal: datum[field],
      };
    }),
  };
}
