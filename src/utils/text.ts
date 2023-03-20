import { OlliDataset } from "olli";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate } from "vega-lite/src/predicate";
import { ElaboratedFieldDef, SelectionSpec, TextNode, TextPredNode, TextPredTreeNode } from "../grammar";
import { getDomain, getFieldDef } from "./data";
import { datumToPredicate, selectionTest } from "./selection";
import { serializeValue } from "./values";
import {bin} from 'vega-statistics';

export function textNodeToPredicateTextNode(textSpec: TextNode[], fields: ElaboratedFieldDef[], data: OlliDataset, fullPredicate: LogicalAnd<FieldPredicate>): TextPredTreeNode[] {
  if (!textSpec) {
    // leaf node
    const datums = selectionTest(data, {predicate: fullPredicate}, fields);
    return datums.map(datum => {
      return {
        fullPredicate: datumToPredicate(datum, fields)
      }
    });
  };
  return textSpec.map(node => {
    const preds = fieldToPredicates(node.field, fields, data);
    const maybeField = preds.length ? preds[0].field : undefined;
    const field = maybeField && preds.every(p => p.field === maybeField) ? maybeField : undefined;
    return {
      fullPredicate,
      field,
      children: preds.map(p => {
        const childFullPred = {
          and: [
            ...fullPredicate.and,
            p
          ]
        };
        return {
          predicate: p,
          fullPredicate: childFullPred,
          children: textNodeToPredicateTextNode(node.children, fields, data, childFullPred)
        }
      })
    }
  });
}

export function fieldToPredicates(field: string, fields: ElaboratedFieldDef[], data: OlliDataset): FieldPredicate[] {
  const fieldDef = getFieldDef(field, fields);
  const domain = getDomain(field, data);
  if (fieldDef.type === 'nominal' || fieldDef.type === 'ordinal') {
    return domain.map(value => {
      return {
        field,
        equal: serializeValue(value, fieldDef)
      }
    });
  }
  else {
    const binResult = bin({maxbins: 10, extent: [domain[0], domain[domain.length - 1]]});
    console.log(binResult);
    const bins = [];
    for (let i = binResult.start; i < binResult.stop; i += binResult.step) {
      bins.push([i, i + binResult.step]);
    }
    return bins.map((bin) => {
      return {
        field,
        range: bin
      }
    })
  }
}