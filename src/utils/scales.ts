import { OlliDataset } from 'olli';
import { EncodingFieldDef, FieldDef, EncodingPropName } from '../grammar';
import { getDomain, getFieldDef } from './data';
import { isNumber } from 'vega';

export type ScaleFunction = (value: any) => any;

export const DEFAULT_RANGES: { [prop: string]: [number, number] } = {
  volume: [-45, -5], // in decibels
  pitch: [48, 76], // in MIDI
  duration: [0.25, 1], // in seconds
};

export const getScaleFunction = (encodingPropName: EncodingPropName, encodingFieldDef: EncodingFieldDef, data: OlliDataset): ScaleFunction => {
  const domain = encodingFieldDef.scale?.domain || getDomain(encodingFieldDef, data);
  const range = encodingFieldDef.scale?.range || DEFAULT_RANGES[encodingPropName];

  if (domain.length) {
    if (isNumber(domain[0]) || domain[0] instanceof Date) {
      return (value) => scale(value, [domain[0], domain[domain.length - 1]] as any, range as any); // TODO type checking
    } else {
      return (value) => scale(domain.indexOf(value), [0, domain.length - 1], range as any);
    }
  }
  return () => DEFAULT_RANGES[encodingPropName][0];
};

export function scale(value: number, domainExtent: [number, number], rangeExtent: [number, number]) {
  const fraction = (value - domainExtent[0]) / (domainExtent[1] - domainExtent[0]);
  const scaled = fraction * (rangeExtent[1] - rangeExtent[0]) + rangeExtent[0];
  if (scaled > rangeExtent[1]) return rangeExtent[1];
  if (scaled < rangeExtent[0]) return rangeExtent[0];
  return scaled;
}
