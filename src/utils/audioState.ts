import { OlliDataset } from "olli";
import { Bin } from "vega-lite/src/bin";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldRangePredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedAudioSpec, ElaboratedFieldDef } from "../grammar";
import { AudioDomain, AudioSpecState, AudioState } from "../UmweltAudio";
import { getBins } from "./bin";
import { getDomain, getFieldDef } from "./data";
import { rangesAreEqual, serializeValue } from "./values";

export function audioStateToSelectionSpec(audioState: AudioSpecState, audioDomains: AudioDomain): SelectionSpec {
  return {
    predicate: {
      and: Object.entries(audioState).map(([field, idx]) => {
        const value = audioDomains[field][idx];
        if (Array.isArray(value)) {
          return {
            field,
            range: value
          } as FieldRangePredicate
        }
        else {
          return {
            field,
            equal: value
          } as FieldEqualPredicate
        }
      })
    }
  }
}

// returns an audiostate if selection spec can be mapped onto one, otherwise null
export function selectionSpecToAudioState(selectionSpec: SelectionSpec, audio: ElaboratedAudioSpec[], fields: ElaboratedFieldDef[], data: OlliDataset): Partial<AudioState> {
  const changedIndexes = [];
  const predicate = selectionSpec?.predicate;
  const audioState: Partial<AudioState> = {
  specStates: audio.map((audioSpec, audioSpecIdx) => {
      if (audioSpec.traversal !== 'selection') {
        if (predicate) {
          const partialStates = audioSpec.traversal.interaction.map(({field, bin}) => {
            return {
              [field]: fieldValueIndexFromPredicate(predicate, field, bin, fields, data)
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

function fieldValueIndexFromPredicate(predicate: LogicalComposition<FieldPredicate>, field: string, bin: Bin, fields: ElaboratedFieldDef[], data: OlliDataset) {
  if ((predicate as LogicalAnd<FieldPredicate>).and) {
    return (predicate as LogicalAnd<FieldPredicate>).and.map(p => fieldValueIndexFromPredicate(p as FieldPredicate, field, bin, fields, data)).find(x => x);
  }
  else {
    const eq = (predicate as FieldEqualPredicate).equal;
    if (eq) {
      const idx = valueIndexInDomain(fields, data, field, eq);
      if (idx >= 0) return idx;
    }
    const r = (predicate as FieldRangePredicate).range;
    if (r) {
      if (bin) {
        const idx = rangeIndexInBins(field, fields, data, r as any[])
        if (idx >= 0) return idx;
      }
      else if (!bin) {
        const idx = valueIndexInDomain(fields, data, field, r[0])
        if (idx >= 0) return idx;
      }
    }
  }
  return null;
}

function valueIndexInDomain(fields: ElaboratedFieldDef[], data: OlliDataset, field: string, value: any) {
  const fieldDef = getFieldDef(field, fields);
  const domain = getDomain(field, data);
  return domain.findIndex(v => serializeValue(v, fieldDef) === serializeValue(value, fieldDef));
}

function rangeIndexInBins(field: string, fields: ElaboratedFieldDef[], data: OlliDataset, range: any[]) {
  const bins = getBins(field, data);
  const fieldDef = getFieldDef(field, fields);
  return bins.findIndex((bin) => {
    return rangesAreEqual(bin, range, fieldDef);
  })
}

export function tickSequenceAudioState(audioState: AudioState, audio: ElaboratedAudioSpec[], fields: ElaboratedFieldDef[]): AudioState {
  const audioSpecState = audioState.specStates[audioState.activeState];
  const audioSpecDomain = audioState.specDomains[audioState.activeState];
  const audioSpec = audio[audioState.activeState];

  if (audioSpec.traversal === 'selection') return audioState;

  // check if sequence reached the end
  const isEndOfSequence = Object.entries(audioSpecState).every(([field, idx]) => {
    return idx === audioSpecDomain[field].length - 1;
  })
  if (isEndOfSequence) return audioState;

  // else increment index(es)
  const nextAudioState: AudioState = structuredClone(audioState);
  const sequenceFields = [...audioSpec.traversal.sequence.map(f => f.field)].reverse();

  let ramp = false;
  let end = false;

  for (let field of sequenceFields) {
    const fIdx = audioSpecState[field];
    if (fIdx === audioSpecDomain[field].length - 1) {
      nextAudioState.specStates[audioState.activeState][field] = 0;
      end = true;
      continue; // increment next level up of nesting
    }
    else {
      nextAudioState.specStates[audioState.activeState][field] += 1;
      const fieldDef = getFieldDef(field, fields);
      if (!end && (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal')) {
        ramp = true; // if slider field, ramp (interpolate) the sonification to make continuous tone
      }
      else {
        ramp = false;
      }
      break;
    }
  }

  nextAudioState.playback = {
    ramp,
    end
  }

  return nextAudioState;
}