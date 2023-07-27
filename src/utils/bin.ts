import { OlliDataset } from 'olli';
import { bin } from 'vega-statistics';
import { EncodingFieldDef, UmweltPredicate } from '../grammar';
import { getDomain } from './data';

export function getBins(fieldDef: EncodingFieldDef, data: OlliDataset, domainFilter?: UmweltPredicate): [number, number][] {
  const domain = getDomain(fieldDef, data, domainFilter);
  const binResult = bin({ maxbins: 10, extent: [domain[0], domain[domain.length - 1]] });
  const bins = [];
  for (let i = binResult.start; i < binResult.stop; i += binResult.step) {
    bins.push([i, i + binResult.step]);
  }
  return bins;
}

export function getBinPredicates(fieldDef: EncodingFieldDef, data: OlliDataset, domainFilter?: UmweltPredicate) {
  const bins = getBins(fieldDef, data, domainFilter);
  return bins.map((bin) => {
    return {
      field: fieldDef.field,
      range: bin,
    };
  });
}
