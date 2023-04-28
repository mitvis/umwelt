import { OlliDataset } from 'olli';
import {bin} from 'vega-statistics';
import { ElaboratedEncodingFieldDef } from '../grammar';
import { getDomain } from "./data";

export function getBins(fieldDef: ElaboratedEncodingFieldDef, data: OlliDataset): [number, number][] {
  const domain = getDomain(fieldDef, data);
  const binResult = bin({maxbins: 10, extent: [domain[0], domain[domain.length - 1]]});
  const bins = [];
  for (let i = binResult.start; i < binResult.stop; i += binResult.step) {
    bins.push([i, i + binResult.step]);
  }
  return bins;
}

export function getBinPredicates(fieldDef: ElaboratedEncodingFieldDef, data: OlliDataset) {
  const bins = getBins(fieldDef, data);
  return bins.map((bin) => {
    return {
      field: fieldDef.field,
      range: bin
    }
  })
}