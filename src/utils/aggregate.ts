import { OlliDataset } from 'olli';
import { AudioAggregateOp, EncodingFieldDef, NONE } from '../grammar';

const mean = (array) => array.reduce((a, b) => a + b) / array.length;

export function aggregate(encodingFieldDef: EncodingFieldDef, data: OlliDataset): number {
  if (encodingFieldDef.aggregate && encodingFieldDef.aggregate !== NONE) {
    if (data.length) {
      switch (encodingFieldDef.aggregate as AudioAggregateOp) {
        case 'mean':
          return mean(data.map((datum) => Number(datum[encodingFieldDef.field])));
        case 'median':
          return data[Math.floor(data.length / 2)][encodingFieldDef.field];
        case 'min':
          return Math.min(...data.map((datum) => Number(datum[encodingFieldDef.field])));
        case 'max':
          return Math.max(...data.map((datum) => Number(datum[encodingFieldDef.field])));
        case 'sum':
          return data.reduce((a, b) => a + Number(b[encodingFieldDef.field]), 0);
        case 'count':
          return data.length;
        default:
          throw new Error(`Unknown aggregate operation: ${encodingFieldDef.aggregate}`);
      }
    } else if (encodingFieldDef.aggregate === 'count') {
      return 0;
    }
  }
  return null;
}
