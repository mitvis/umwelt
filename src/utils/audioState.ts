import { OlliDataset } from "olli";
import { LogicalAnd } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldRangePredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedAudioSpec, ElaboratedFieldDef } from "../grammar";
import { AudioSpecState, AudioState, AxisBins } from "../UmveltAudio";
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
      if (audioSpec.traversal !== 'selection' && Object.values(audioSpec.traversal).find(m => m === 'interaction')) {
        if (predicate) {
          let state = {};
          if ((predicate as LogicalAnd<FieldPredicate>).and) {
            const and = (predicate as LogicalAnd<FieldPredicate>).and;
            and.forEach(pred => {
              if ((pred as FieldPredicate).field) {
                const partialState = partialAudioStateFromFieldPredicate(predicate as FieldPredicate, audio, fields, data, axisBins);
                state = {
                  ...state,
                  ...partialState
                }
              }
            })
          }
          else if ((predicate as FieldPredicate).field) {
            const partialState = partialAudioStateFromFieldPredicate(predicate as FieldPredicate, audio, fields, data, axisBins);
            state = {
              ...state,
              ...partialState
            }
          }
          if (Object.keys(state).length) {
            changedIndexes.push(audioSpecIdx);
          }
          return state;
        }
        return null;
      }
      return null;
    })
  };

  if (changedIndexes.length === 1) {
    audioState.activeState = changedIndexes[0];
  }
  return audioState;
}

function partialAudioStateFromFieldPredicate(predicate: FieldPredicate, audio: ElaboratedAudioSpec[], fields: ElaboratedFieldDef[], data: OlliDataset, axisBins: AxisBins) {
  if ((predicate as FieldEqualPredicate).equal) {
    const eq = predicate as FieldEqualPredicate;
    if (fieldExistsInTraversalInteraction(audio, eq.field)) {
      if (valueExistsInDomain(fields, data, eq.field, eq.equal)) {
        return {
          [predicate.field]: eq.equal as any
        };
      }
    }
  }
  else if ((predicate as FieldRangePredicate).range) {
    const r = predicate as FieldRangePredicate;
    if (fieldExistsInTraversalInteraction(audio, predicate.field)) {
      if (rangeExistsInAxisBins(predicate.field, fields, r.range as any[], axisBins)) {
        return {
          [predicate.field]: r.range
        };
      }
      else if (valueExistsInDomain(fields, data, r.field, r.range[0])) {
        return {
          [predicate.field]: r.range[0]
        };
      }
    }
  }
  return {};
}

function fieldExistsInTraversalInteraction(audio: ElaboratedAudioSpec[], someField: string) {
  return audio.some(audioSpec => {
    if (audioSpec.traversal === 'selection') return false;
    return Object.entries(audioSpec.traversal).some(([field, mode]) => {
      return field === someField && mode === 'interaction';
    });
  });
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