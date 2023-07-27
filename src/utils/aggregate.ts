import { OlliDataset } from 'olli';
import { AudioAggregateOp, EncodingFieldDef } from '../grammar';

const mean = (array) => array.reduce((a, b) => a + b) / array.length;

export function aggregate(encodingFieldDef: EncodingFieldDef, data: OlliDataset): number {
  if (encodingFieldDef.aggregate && data.length) {
    switch (encodingFieldDef.aggregate as AudioAggregateOp) {
      case 'mean':
        return mean(data.map((datum) => Number(datum[encodingFieldDef.field])));
    }
  }
  return null;
}
