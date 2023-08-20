import { OlliDataset } from 'olli';
import { bin } from 'vega-statistics';
import { FieldDef, UmweltPredicate } from '../grammar';
import { getDomain, getFieldDef } from './data';
import * as d3 from 'd3';
import { getVegaAxisTicks } from './vega';
import moize from 'moize';

export const getBins = moize((field: string, data: OlliDataset, fields: FieldDef[], domainFilter?: UmweltPredicate): [number, number][] => {
  const fieldDef = getFieldDef(field, fields);
  const domain = getDomain({ ...fieldDef, field: fieldDef.name }, data, domainFilter);
  const bins = [];

  let ticks;

  if ('view' in window) {
    const xyEncodings = fieldDef.encodings.filter((e) => e.property === 'x' || e.property === 'y');
    if (xyEncodings.length === 1) {
      // grab ticks from vega
      const vTicks = getVegaAxisTicks(window.view);
      if (vTicks && vTicks.length) {
        if (vTicks.length === 1) {
          ticks = vTicks[0];
        } else if (vTicks.length === 2) {
          if (xyEncodings[0].property === 'x') {
            ticks = vTicks[0];
          } else if (xyEncodings[0].property === 'y') {
            ticks = vTicks[1];
          }
        }
      }
    }
  }

  if (!ticks) {
    // didn't get ticks from vega
    if (fieldDef.type === 'temporal') {
      ticks = d3
        .scaleTime()
        .domain([domain[0], domain[domain.length - 1]])
        .ticks(6);
    } else if (fieldDef.bin && field.startsWith('bin_')) {
      // field is pre-binned from vega-lite
      return domain.map((v) => {
        const v2 = data.find((d) => d[field] === v)[field + '_end'];
        return [Number(v), Number(v2)];
      });
    } else {
      const binResult = bin({ maxbins: 10, extent: [domain[0], domain[domain.length - 1]] });

      ticks = [];
      for (let i = binResult.start; i <= binResult.stop; i += binResult.step) {
        ticks.push(i);
      }
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
});

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
