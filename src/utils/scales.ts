import { OlliDataset } from 'olli';
import { EncodingFieldDef, FieldDef, EncodingPropName } from '../grammar';
import { getDomain, getFieldDef } from './data';

export type ScaleFunction = (value: any) => any;

export const DEFAULT_RANGES: { [prop: string]: [number, number] } = {
  volume: [-15, 0], // in decibels
  pitch: [36, 76], // in MIDI
  duration: [0.25, 1], // in seconds
};

export const getScaleFunction = (encodingPropName: EncodingPropName, encodingFieldDef: EncodingFieldDef, fields: FieldDef[], data: OlliDataset): ScaleFunction => {
  const fieldDef = getFieldDef(encodingFieldDef.field, fields);
  if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal') {
    const domain = encodingFieldDef.scale?.domain || getDomain(encodingFieldDef, data);
    const range = encodingFieldDef.scale?.range || DEFAULT_RANGES[encodingPropName];

    return (value) => scale(value, [domain[0], domain[domain.length - 1]] as any, range as any); // TODO type checking
  } else {
    // TODO idk
    throw new Error('tried to scale non-quantitative or non-temporal field');
  }
};

export function scale(value: number, domainExtent: [number, number], rangeExtent: [number, number]) {
  const fraction = (value - domainExtent[0]) / (domainExtent[1] - domainExtent[0]);
  const scaled = fraction * (rangeExtent[1] - rangeExtent[0]) + rangeExtent[0];
  if (scaled > rangeExtent[1]) return rangeExtent[1];
  if (scaled < rangeExtent[0]) return rangeExtent[0];
  return scaled;
}
