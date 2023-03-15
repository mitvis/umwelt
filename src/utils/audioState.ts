import { OlliDataset } from "olli";
import { Bin } from "vega-lite/src/bin";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldRangePredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedAudioSpec, ElaboratedFieldDef } from "../grammar";
import { AudioSpecState, AudioState, AxisBins } from "../UmweltAudio";
import { getAudioEncodingBin } from "./bin";
import { getDomain, getFieldDef } from "./data";
import { rangesAreEqual, serializeValue } from "./values";

export function audioStateToSelectionSpec(audioState: AudioSpecState): SelectionSpec {
  return {
    predicate: {
      and: Object.entries(audioState).map(([field, value]) => {
        if (Array.isArray(value)) {
          return {
            field,
            range: value
          }
        }
        else {
          return {
            field,
            equal: value
          }
        }
      })
    }
  }
}

// returns an audiostate if selection spec can be mapped onto one, otherwise null
export function selectionSpecToAudioState(selectionSpec: SelectionSpec, audio: ElaboratedAudioSpec[], fields: ElaboratedFieldDef[], data: OlliDataset, axisBins: AxisBins): Partial<AudioState> {
  const changedIndexes = [];
  const predicate = selectionSpec?.predicate;
  const audioState: Partial<AudioState> = {
  specStates: audio.map((audioSpec, audioSpecIdx) => {
      if (audioSpec.traversal !== 'selection') {
        if (predicate) {
          const partialStates = Object.entries(audioSpec.traversal).filter(([_, mode]) => mode === 'interaction').map(([field, _]) => {
            return {
              [field]: fieldValueFromPreducate(predicate, field, getAudioEncodingBin(audioSpec.encoding), fields, data, axisBins)
            }
          }).filter(s => Object.values(s).every(x => x));
          if (partialStates.length) {
            const state = partialStates.reduce((prev, curr) => {return {...prev, ...curr}});
            if (Object.keys(state).length) {
              changedIndexes.push(audioSpecIdx);
            }
            return state;
          }
        }
      }
      return {};
    })
  };

  if (changedIndexes.length === 1) {
    audioState.activeState = changedIndexes[0];
  }
  return audioState;
}

function fieldValueFromPreducate(predicate: LogicalComposition<FieldPredicate>, field: string, bin: Bin, fields: ElaboratedFieldDef[], data: OlliDataset, axisBins: AxisBins) {
  if ((predicate as LogicalAnd<FieldPredicate>).and) {
    return (predicate as LogicalAnd<FieldPredicate>).and.map(p => fieldValueFromPreducate(p as FieldPredicate, field, bin, fields, data, axisBins)).find(x => x);
  }
  else {
    const eq = (predicate as FieldEqualPredicate).equal;
    if (eq && valueExistsInDomain(fields, data, field, eq)) return eq;
    const r = (predicate as FieldRangePredicate).range;
    if (r) {
      if (bin && rangeExistsInAxisBins(field, fields, r as any[], axisBins)) {
        return r;
      }
      else if (!bin && valueExistsInDomain(fields, data, field, r[0])) {
        return r[0];
      }
    }
  }
  return null;
}

function valueExistsInDomain(fields: ElaboratedFieldDef[], data: OlliDataset, field: string, value: any) {
  const fieldDef = getFieldDef(field, fields);
  const domain = getDomain(field, data);
  return domain.find(v => serializeValue(v, fieldDef) === serializeValue(value, fieldDef));
}

function rangeExistsInAxisBins(field: string, fields: ElaboratedFieldDef[], range: any[], axisBins: AxisBins) {
  const bins = axisBins[field];
  const fieldDef = getFieldDef(field, fields);
  return bins.find((bin) => {
    return rangesAreEqual(bin, range, fieldDef);
  })
}