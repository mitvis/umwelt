import { OlliDataset } from "olli";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate } from "vega-lite/src/predicate";
import { ElaboratedFieldDef, SelectionSpec, TextNode, ElaboratedPredNode, ElaboratedTextNode } from "../grammar";
import { getDomain, getFieldDef } from "./data";
import { datumToPredicate, selectionTest } from "./selection";
import { serializeValue } from "./values";
import { getBinPredicates } from "./bin";

export function textSpecToFullPredicateSpec(textSpec: TextNode[], fields: ElaboratedFieldDef[], data: OlliDataset, fullPredicate: LogicalAnd<FieldPredicate>): ElaboratedTextNode[] {
  if (!textSpec) {
    // base case (leaf node)
    const datums = selectionTest(data, {predicate: fullPredicate});
    return datums.map(datum => {
      return {
        fullPredicate: datumToPredicate(datum, fields)
      }
    });
  };
  return textSpec.map(node => {
    if (node.field) {
      const field = node.field;
      const childPreds = fieldToPredicates(field, fields, data);
      return {
        fullPredicate,
        field,
        children: childPreds.map(p => {
          const childFullPred = {
            and: [
              ...fullPredicate.and,
              p
            ]
          };
          return {
            predicate: p,
            fullPredicate: childFullPred,
            children: textSpecToFullPredicateSpec(node.children, fields, data, childFullPred)
          }
        })
      }
    }
    else if (node.predicate) {
      const predicate = node.predicate;
      const nextFullPred = {
        and: [
          ...fullPredicate.and,
          predicate
        ]
      };
      return {
        fullPredicate: nextFullPred,
        predicate,
        children: textSpecToFullPredicateSpec(node.children, fields, data, nextFullPred)
      }
    }
    else {
      return {
        fullPredicate,
        children: textSpecToFullPredicateSpec(node.children, fields, data, fullPredicate)
      }
    }
  });
}

export function fieldToPredicates(field: string, fields: ElaboratedFieldDef[], data: OlliDataset): FieldPredicate[] {
  const fieldDef = getFieldDef(field, fields);
  if (fieldDef.type === 'nominal' || fieldDef.type === 'ordinal') {
    const domain = getDomain(fieldDef as any, data); // TODO need to update this when we rethink text specs
    return domain.map(value => {
      return {
        field,
        equal: serializeValue(value, fieldDef)
      }
    });
  }
  else {
    const bins = getBinPredicates(fieldDef as any, data); // TODO
    return bins;
  }
}