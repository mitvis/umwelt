import { OlliDataset } from 'olli';
import { bin } from 'vega-statistics';
import { FieldDef, UmweltPredicate } from '../grammar';
import { getDomain, getFieldDef } from './data';
import * as d3 from 'd3';

export function getBins(field: string, data: OlliDataset, fields: FieldDef[], domainFilter?: UmweltPredicate): [number, number][] {
  const fieldDef = getFieldDef(field, fields);
  const domain = getDomain({ ...fieldDef, field: fieldDef.name }, data, domainFilter);
  const bins = [];
  let ticks;
  if (fieldDef.type === 'temporal') {
    ticks = d3
      .scaleTime()
      .domain([domain[0], domain[domain.length - 1]])
      .ticks(6);
  } else {
    const binResult = bin({ maxbins: 10, extent: [domain[0], domain[domain.length - 1]] });

    ticks = [];
    for (let i = binResult.start; i <= binResult.stop; i += binResult.step) {
      ticks.push(i);
    }
  }

  if (domain[0] < ticks[0]) {
    // if domain is smaller than first bin, add a bin
    bins.push([domain[0], ticks[0]]);
  }
  for (let i = 0; i < ticks.length - 1; i++) {
    bins.push([ticks[i], ticks[i + 1]]);
  }
  if (domain[domain.length - 1] > ticks[ticks.length - 1]) {
    // if domain is larger than last bin, add a bin
    bins.push([ticks[ticks.length - 1], domain[domain.length - 1]]);
  }

  return bins;
}

export function getBinPredicates(field: string, data: OlliDataset, fields: FieldDef[], domainFilter?: UmweltPredicate) {
  const bins = getBins(field, data, fields, domainFilter);
  return bins.map((bin, idx) => {
    return {
      field: field,
      range: bin,
      inclusive: idx === bins.length - 1,
    };
  });
}
