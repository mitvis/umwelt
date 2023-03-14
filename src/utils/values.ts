import {TopLevelUnitSpec} from 'vega-lite/src/spec/unit';
import { isNumeric as vlIsNumeric } from "vega-lite";
import {isString, Spec} from 'vega';
import { ElaboratedFieldDef } from '../grammar/Types';

// export function traverseStructure(node: ElaboratedStructureNode | ElaboratedStructureNode[], func: (n: ElaboratedStructureNode) => void) {
//   if (Array.isArray(node)) {
//     node.forEach(item =>traverseStructure(item, func));
//   }
//   else {
//     func(node);
//     if (node.children) {
//       node.children.forEach((child) => {
//         traverseStructure(child, func);
//       });
//     }
//   }
// }

export function serializeValue(value, fieldDef) {
  if (fieldDef.type === 'temporal') {
    value = datestampToTime(value);
  }
  else if (isString(value) && isNumeric(value)) {
    value = Number(value);
  }
  return value;
}

export function datestampToTime(datestamp: string | string[]) {
  if (Array.isArray(datestamp)) {
    return datestamp.map(v => new Date(v).getTime());
  }
  else {
    return new Date(datestamp).getTime();
  }
}

export function isNumeric(value: string): boolean {
  return vlIsNumeric(value.replaceAll(',', ''));
}


export function filterObjectByKeys(object, keys): any {
  return Object.fromEntries(
    Object.entries(object).filter(
       ([key, _])=>keys.includes(key)
    )
 );
}

export function rangesAreEqual(range1: any[], range2: any[], fieldDef: ElaboratedFieldDef) {
  if (range1 && range2 && Array.isArray(range1) && Array.isArray(range2)) {
    return serializeValue(range1[0], fieldDef) === serializeValue(range2[0], fieldDef) && serializeValue(range1[1], fieldDef) === serializeValue(range2[1], fieldDef);
  }
  return false;
}