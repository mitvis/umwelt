import { OlliDataset } from "olli";
import { isDate, toNumber, isArray, inrange } from "vega";
import { LogicalAnd } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldLTPredicate, FieldGTPredicate, FieldLTEPredicate, FieldGTEPredicate, FieldRangePredicate, FieldOneOfPredicate, FieldValidPredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedFieldDef } from "../grammar/Types";

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
	return "E"; // shrug
};

export const tupleTypeToPredicate = (type: string) => {
  switch(type) {
    case TYPE_ENUM: return "equal";
    case TYPE_PRED_LT: return "lt";
    case TYPE_PRED_GT: return "gt";
    case TYPE_PRED_LTE: return "lte";
    case TYPE_PRED_GTE: return "gte";
    case TYPE_RANGE_INC: return "range";
    case TYPE_PRED_VALID: return "valid";
  }
  return "equal"; // shrug
};

export function selectionStoreToSelectionSpec(store): SelectionSpec {
  if (store.length) {
    const tuple = store[0];
    const and: FieldPredicate[] = tuple.fields.map((f, idx) => {
      const predicate = {
        field: f.field
      }
      const p = tupleTypeToPredicate(f.type);
      predicate[p] = tuple.values[idx];
      return predicate;
    });
    if (and.length > 1) {
      return {
        predicate: {
          and
        }
      };
    }
    else {
      return {
        predicate: and[0]
      }
    }
  }
  else {
    return null;
  }
}

export function selectionSpecToSelectionStore(selectionSpec: SelectionSpec) {
  if (selectionSpec.predicate) {
    const predicate = selectionSpec.predicate;
    const and = (predicate as LogicalAnd<FieldPredicate>).and;
    const getPredValue = (p: FieldPredicate) => {
      const pred = p as any;
      const key = Object.keys(pred).find((k) => k !== "field"); // find the value key e.g. 'eq', 'lte'
      const value = pred[key];
      return value;
    };
    const tuple_fields = and ?
      and.map((p) => {
          const pred = p as FieldPredicate; // TODO: this will currently only support a non-nested "and" composition or a single pred because i do not want to deal
          return {
            type: predicateToTupleType(pred),
            field: pred.field,
          };
        })
      : [
          {
            type: predicateToTupleType(predicate as FieldPredicate),
            field: (predicate as FieldPredicate).field,
          },
        ];
    return {
      unit: '',
      fields: tuple_fields, values: and ? and.map(getPredValue) : [
        getPredValue(predicate as FieldPredicate)
      ]
    };
  }
}

export function selectionTest(data: OlliDataset, selectionSpec: SelectionSpec): OlliDataset {
  try {
    const store = selectionSpecToSelectionStore(selectionSpec);
    return data.filter(datum => {
      return testPoint(datum, store);
    })
  } catch (e) {
    console.error(e)
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

export function datumToPredicate(datum, fields): LogicalAnd<FieldEqualPredicate> {
  return {
    and: fields.map(field => {
      return {
        field: field.name,
        equal: datum[field.name]
      }
    })
  };
}