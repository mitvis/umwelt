import { OlliDataset } from 'olli';
import {bin} from 'vega-statistics';
import { getDomain } from "./data";

export function getBins(field: string, data: OlliDataset): [number, number][] {
  const domain = getDomain(field, data);
  const binResult = bin({maxbins: 10, extent: [domain[0], domain[domain.length - 1]]});
  const bins = [];
  for (let i = binResult.start; i < binResult.stop; i += binResult.step) {
    bins.push([i, i + binResult.step]);
  }
  return bins;
}

export function getBinPredicates(field: string, data: OlliDataset) {
  const bins = getBins(field, data);
  return bins.map((bin) => {
    return {
      field,
      range: bin
    }
  })
}