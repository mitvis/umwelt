import { OlliDataset } from "olli";
import { Bin } from "vega-lite/src/bin";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldRangePredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedAudioSpec, ElaboratedFieldDef, AudioEncodingFieldDef, AudioPropName, AudioTraversalFieldDef, ElaboratedAudioTraversalFieldDef, ElaboratedAudioEncodingFieldDef } from "../grammar";
import { SonifiedNote } from "../sonification";
import { AudioDomain, AudioPlaybackConfig, AudioSpecState, AudioState } from "../UmweltAudio";
import { aggregate } from "./aggregate";
import { getBins } from "./bin";
import { getDomain, getFieldDef } from "./data";
import { getScaleFunction } from "./scales";
import { selectionTest } from "./selection";
import { rangesAreEqual, serializeValue } from "./values";

export function audioStateToSelectionSpec(audioState: AudioSpecState, audioDomains: AudioDomain): SelectionSpec {
  console.log(audioState, audioDomains);
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
export function selectionSpecToAudioState(selectionSpec: SelectionSpec, audio: ElaboratedAudioSpec[], data: OlliDataset): Partial<AudioState> {
  const changedIndexes = [];
  const predicate = selectionSpec?.predicate;
  const audioState: Partial<AudioState> = {
  specStates: audio.map((audioSpec, audioSpecIdx) => {
      if (audioSpec.traversal !== 'selection') {
        if (predicate) {
          const partialStates = audioSpec.traversal.map((audioFieldDef) => {
            const field = audioFieldDef.field;
            const bin = audioFieldDef.bin;
            return {
              [field]: fieldValueIndexFromPredicate(predicate, audioFieldDef, bin, data)
            }
          }).filter(s => Object.values(s).every(x => x !== undefined));
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

function fieldValueIndexFromPredicate(predicate: LogicalComposition<FieldPredicate>, fieldDef: ElaboratedAudioTraversalFieldDef, bin: Bin, data: OlliDataset) {
  if ((predicate as LogicalAnd<FieldPredicate>).and) {
    return (predicate as LogicalAnd<FieldPredicate>).and.map(p => fieldValueIndexFromPredicate(p as FieldPredicate, fieldDef, bin, data)).find(x => x !== undefined);
  }
  else {
    const eq = (predicate as FieldEqualPredicate).equal;
    if (eq) {
      const idx = valueIndexInDomain(data, fieldDef, eq);
      if (idx >= 0) return idx;
    }
    const r = (predicate as FieldRangePredicate).range;
    if (r) {
      if (bin) {
        const idx = rangeIndexInBins(fieldDef, data, r as any[])
        if (idx >= 0) return idx;
      }
      else if (!bin) {
        const idx = valueIndexInDomain(data, fieldDef, r[0])
        if (idx >= 0) return idx;
      }
    }
  }
  return undefined;
}

function valueIndexInDomain(data: OlliDataset, fieldDef: ElaboratedAudioTraversalFieldDef, value: any) {
  const domain = getDomain(fieldDef, data);
  return domain.findIndex(v => serializeValue(v, fieldDef) === serializeValue(value, fieldDef));
}

function rangeIndexInBins(fieldDef: ElaboratedAudioTraversalFieldDef, data: OlliDataset, range: any[]) {
  const bins = getBins(fieldDef, data);
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
    return idx >= audioSpecDomain[field].length - 1;
  })
  if (isEndOfSequence) return audioState;

  // else increment index(es)
  const nextAudioState: AudioState = structuredClone(audioState);
  const sequenceFields = [...audioSpec.traversal.map(f => f.field)].reverse();

  let ramp = false;
  let end = false;

  for (let field of sequenceFields) {
    const fIdx = audioSpecState[field];
    if (fIdx >= audioSpecDomain[field].length - 1) {
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
    pauseBefore: end
  }
  nextAudioState.ctrl = 'sequence';

  return nextAudioState;
}


export function audioStateToNote(audioSpec: ElaboratedAudioSpec, audioSpecState: AudioSpecState, audioDomain: AudioDomain, data: OlliDataset, playback: AudioPlaybackConfig): SonifiedNote {

  const selectionSpec = audioStateToSelectionSpec(audioSpecState, audioDomain);
  const selection = selectionTest(data, selectionSpec);

  function audioEncoding(encodingPropName: AudioPropName, encodingFieldDef: ElaboratedAudioEncodingFieldDef, selection: OlliDataset) {
    const scale = getScaleFunction(encodingPropName, encodingFieldDef, data);

    if (encodingFieldDef?.field) {
      const field = encodingFieldDef.field;
      if (selection.length > 1 && encodingFieldDef.aggregate) {
        const aggregatedValue = aggregate(encodingFieldDef, selection);

        console.log(field, selection, aggregatedValue);

        return {
          [encodingPropName]: scale(aggregatedValue)
        }
      }
      else if (selection.length === 1) {
        // val is a value
        return {
          [encodingPropName]: scale(selection[0][field])
        }
      }
    }
    return {};
  }

  let note: SonifiedNote = {};

  Object.entries(audioSpec.encoding).forEach(([prop, encodingFieldDef]) => {
    const partial = audioEncoding(prop as AudioPropName, encodingFieldDef, selection);
    note = {
      ...note,
      ...partial
    }
  });

  if (!Object.keys(note).length) {
    return null;
  }

  note = {
    ...note,
    ...playback
  }

  return note;
}
