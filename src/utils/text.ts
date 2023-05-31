import { OlliDataset } from 'olli';
import { LogicalAnd, LogicalComposition } from 'vega-lite/src/logical';
import { FieldPredicate } from 'vega-lite/src/predicate';
import { ElaboratedFieldDef, SelectionSpec, TextNode, ElaboratedTextNode, ElaboratedTextFieldDef } from '../grammar';
import { getDomain, getFieldDef } from './data';
import { datumToPredicate, selectionTest } from './selection';
import { serializeValue } from './values';
import { getBinPredicates } from './bin';

export function textSpecToFullPredicateSpec(textSpec: TextNode[], fields: ElaboratedFieldDef[], data: OlliDataset, fullPredicate: LogicalAnd<FieldPredicate>, idPrefix: string): ElaboratedTextNode[] {
  if (!textSpec) {
    // base case (leaf node)
    const datums = selectionTest(data, { predicate: fullPredicate });
    return datums.map((datum, idx) => {
      return {
        id: `${idPrefix}-${idx}`,
        fullPredicate: datumToPredicate(datum, fields),
        children: [],
      };
    });
  }
  return textSpec.map((node, idx) => {
    if ('groupby' in node) {
      const fieldDef = node.groupby;
      const childPreds = fieldToPredicates(fieldDef, data);
      return {
        id: `${idPrefix}-${idx}`,
        fullPredicate,
        groupby: node.groupby,
        children: childPreds.map((p, childIdx) => {
          const childFullPred = {
            and: [...fullPredicate.and, p],
          };
          const childId = `${idPrefix}-${idx}-${childIdx}`;
          return {
            id: childId,
            predicate: p,
            fullPredicate: childFullPred,
            children: textSpecToFullPredicateSpec(node.children, fields, data, childFullPred, childId),
          };
        }),
      };
    } else if ('predicate' in node) {
      const predicate = node.predicate;
      const nextFullPred = {
        and: [...fullPredicate.and, predicate],
      };
      const nextId = `${idPrefix}-${idx}`;
      return {
        id: nextId,
        fullPredicate: nextFullPred,
        predicate,
        children: textSpecToFullPredicateSpec(node.children, fields, data, nextFullPred, nextId),
      };
    }
    // else {
    //   return {
    //     fullPredicate,
    //     children: textSpecToFullPredicateSpec(node.children, fields, data, fullPredicate),
    //   };
    // }
  });
}

export function fieldToPredicates(fieldDef: ElaboratedTextFieldDef, data: OlliDataset): FieldPredicate[] {
  if (fieldDef.type === 'nominal' || fieldDef.type === 'ordinal') {
    const domain = getDomain(fieldDef, data);
    return domain.map((value) => {
      return {
        field: fieldDef.field,
        equal: serializeValue(value, fieldDef),
      };
    });
  } else {
    const bins = getBinPredicates(fieldDef, data);
    return bins;
  }
}
