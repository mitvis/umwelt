import { OlliDataset, OlliValue } from "olli";
import { FieldDefBase, FieldName } from "vega-lite/src/channeldef";
import { AudioAggregateOp } from "../grammar";

const mean = array => array.reduce((a, b) => a + b) / array.length;

export function aggregate(encodingFieldDef: FieldDefBase<FieldName>, data: OlliDataset): number {
  if (encodingFieldDef.aggregate && data.length) {
    switch (encodingFieldDef.aggregate as AudioAggregateOp) {
      case 'mean':
        return mean(data.map(datum => Number(datum[encodingFieldDef.field])))
    }
  }
  return null;
}