import { isNumeric as vlIsNumeric } from 'vega-lite';
import { isString } from 'vega';
import { EncodingFieldDef, FieldDef } from '../grammar/Types';

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
  } else if (isString(value) && isNumeric(value)) {
    value = Number(value);
  }
  return value;
}

export function datestampToTime(datestamp: string | string[]) {
  if (Array.isArray(datestamp)) {
    return datestamp.map((v) => new Date(v).getTime());
  } else {
    return new Date(datestamp).getTime();
  }
}

export function isNumeric(value: string): boolean {
  return vlIsNumeric(value.replaceAll(',', ''));
}

export function filterObjectByKeys(object, keys): any {
  return Object.fromEntries(Object.entries(object).filter(([key, _]) => keys.includes(key)));
}

export function rangesAreEqual(range1: any[], range2: any[], fieldDef: EncodingFieldDef) {
  if (range1 && range2 && Array.isArray(range1) && Array.isArray(range2)) {
    return serializeValue(range1[0], fieldDef) === serializeValue(range2[0], fieldDef) && serializeValue(range1[1], fieldDef) === serializeValue(range2[1], fieldDef);
  }
  return false;
}

export function dateToTimeUnit(date: Date, timeUnit: string): string {
  if (!timeUnit) {
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const opts = {};
  if (timeUnit.includes('year')) {
    opts['year'] = 'numeric';
  }
  if (timeUnit.includes('month')) {
    opts['month'] = 'short';
  }
  if (timeUnit.includes('day')) {
    opts['weekday'] = 'short';
  }
  if (timeUnit.includes('date')) {
    opts['day'] = 'numeric';
  }
  if (timeUnit.includes('hours')) {
    opts['hour'] = 'numeric';
  }
  if (timeUnit.includes('minutes')) {
    opts['minute'] = 'numeric';
  }
  if (timeUnit.includes('seconds')) {
    opts['second'] = 'numeric';
  }
  if (!Object.keys(opts).length) {
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return date.toLocaleString('en-US', opts);
}

export const fmtValue = (value, fieldDef): string => {
  if (fieldDef.type === 'temporal' && !(value instanceof Date)) {
    value = new Date(value);
  }
  if (value instanceof Date) {
    return dateToTimeUnit(value, fieldDef.timeUnit);
  } else if (typeof value !== 'string' && !isNaN(value) && value % 1 != 0) {
    return Number(value).toFixed(2);
  }
  return String(value);
};
