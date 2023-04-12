import { OlliDataset } from "olli";
import { ElaboratedFieldDef, EncodingFieldDef, EncodingPropName, ScaleFunction } from "../grammar";
import { getDomain } from "./data";

const DEFAULT_RANGES: {[prop: string]: [number, number]} = {
  volume: [-60, 0], // in decibels
  pitch: [36, 76], // in MIDI
  duration: [.25, 1], // in seconds
}

export const getScaleFunction = (encodingPropName: EncodingPropName, encodingFieldDef: EncodingFieldDef, fields: ElaboratedFieldDef[], data: OlliDataset): ScaleFunction => {
  const field = encodingFieldDef.field;
  const baseFieldDef = fields.find(f => f.name === field);
  const scaleDef = {
    ...(baseFieldDef.scale || {}),
    ...(encodingFieldDef.scale || {})
  };

  if (baseFieldDef.type === 'quantitative' || baseFieldDef.type === 'temporal') {
    const domain = scaleDef.domain || getDomain(field, data);
    const range = scaleDef.range || DEFAULT_RANGES[encodingPropName];

    return (value) => scale(value, [domain[0], domain[domain.length - 1]] as any, range as any); // TODO type checking
  }
  else {
    // TODO idk
  }

}

function scale(value: number, domainExtent: [number, number], rangeExtent: [number, number]) {
  const fraction = (value - domainExtent[0]) / (domainExtent[1] - domainExtent[0]);
  const scaled = fraction * (rangeExtent[1] - rangeExtent[0]) + rangeExtent[0];
  return scaled;
}