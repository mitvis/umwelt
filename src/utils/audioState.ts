import { OlliDataset, OlliDatum } from "olli";
import { Bin } from "vega-lite/src/bin";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldRangePredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedAudioSpec, ElaboratedFieldDef, AudioEncodingFieldDef, AudioPropName, AudioTraversalFieldDef, ElaboratedAudioTraversalFieldDef, ElaboratedAudioEncodingFieldDef, ElaboratedAudioEncoding, EncodingPropName } from "../grammar";
import { SonifierNote } from "../sonification";
import { AudioDomain, AudioPlaybackConfig, AudioSpecState, AudioState } from "../UmweltAudio";
import { aggregate } from "./aggregate";
import { getBins } from "./bin";
import { getDomain, getFieldDef } from "./data";
import { getScaleFunction, ScaleFunction } from "./scales";
import { datumToPredicate, selectionTest } from "./selection";
import { rangesAreEqual, serializeValue } from "./values";
import { Sonifier } from '../sonification';

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

const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

export function generateSequence(audioState: AudioState, audio: ElaboratedAudioSpec[], data: OlliDataset): SonifierNote[] {
  const audioSpecState = audioState.specStates[audioState.activeState];
  const audioSpecDomain = audioState.specDomains[audioState.activeState];
  const audioSpec = audio[audioState.activeState];

  if (audioSpec.traversal === 'selection') return [];

  const sequenceFields = [...audioSpec.traversal.map(f => f.field)];

  const states: AudioSpecState[] = cartesian(...(sequenceFields.map(field => audioSpecDomain[field].map((v, idx) => idx)))).map(s => {
    return Object.fromEntries(s.map((value, index) => {
      if (audioSpec.traversal !== 'selection') {
        return [audioSpec.traversal[index].field, value]
      }
    }))
  }); // oh god this won't scale

  const notes = states.map((state) => {
    return {
      ...audioStateToNote(state, audioSpec, audioSpecDomain, data),
      state
    }
  });

  return notes;

  // for (let field of sequenceFields) {
  //   const fIdx = audioSpecState[field];
  //   if (fIdx >= audioSpecDomain[field].length - 1) {
  //     nextAudioState.specStates[audioState.activeState][field] = 0;
  //     end = true;
  //     continue; // increment next level up of nesting
  //   }
  //   else {
  //     nextAudioState.specStates[audioState.activeState][field] += 1;
  //     const fieldDef = getFieldDef(field, fields);
  //     if (!end && (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal')) {
  //       ramp = true; // if slider field, ramp (interpolate) the sonification to make continuous tone
  //     }
  //     else {
  //       ramp = false;
  //     }
  //     break;
  //   }
  // }

  // return [];
}

// export function tickSequenceAudioState(audioState: AudioState, audio: ElaboratedAudioSpec[]): AudioState {
//   const audioSpecState = audioState.specStates[audioState.activeState];
//   const audioSpecDomain = audioState.specDomains[audioState.activeState];
//   const audioSpec = audio[audioState.activeState];

//   if (audioSpec.traversal === 'selection') return audioState;

//   // check if sequence reached the end
//   const isEndOfSequence = Object.entries(audioSpecState).every(([field, idx]) => {
//     return idx >= audioSpecDomain[field].length - 1;
//   })
//   if (isEndOfSequence) return audioState;

//   // else increment index(es)
//   const nextAudioState: AudioState = structuredClone(audioState);
//   const sequenceFields = [...audioSpec.traversal.map(f => f.field)].reverse();

//   for (let field of sequenceFields) {
//     const fIdx = audioSpecState[field];
//     if (fIdx >= audioSpecDomain[field].length - 1) {
//       nextAudioState.specStates[audioState.activeState][field] = 0;
//       continue; // increment next level up of nesting
//     }
//     else {
//       nextAudioState.specStates[audioState.activeState][field] += 1;
//       break;
//     }
//   }

//   nextAudioState.ctrl = 'sequence';

//   return nextAudioState;
// }


export function audioStateToNote(audioSpecState: AudioSpecState, audioSpec: ElaboratedAudioSpec, audioDomain: AudioDomain, data: OlliDataset): SonifierNote {
  const selectionSpec = audioStateToSelectionSpec(audioSpecState, audioDomain);
  const selection = selectionTest(data, selectionSpec);

  function encodeAudio(audioEncoding: ElaboratedAudioEncoding, selection: OlliDataset) {
    return Object.entries(audioEncoding).map(([prop, encodingFieldDef]) => {
      if (encodingFieldDef?.field) {
        const scale = getScaleFunction(prop as AudioPropName, encodingFieldDef, data);
        if (selection.length > 1 && encodingFieldDef.aggregate) {
          const aggregatedValue = aggregate(encodingFieldDef, selection);

          return {
            [prop]: scale(aggregatedValue)
          }
        }
        else if (selection.length === 1) {
          // val is a value
          return {
            [prop]: scale(selection[0][encodingFieldDef.field])
          }
        }
      }
      return {};
    }).reduce((acc, val) => {
      return {
        ...acc,
        ...val
      }
    });
  }

  let note: SonifierNote = encodeAudio(audioSpec.encoding, selection);

  if (!Object.keys(note).length) {
    note = {noise: true};
  }

  if (!note.duration) {
    note.duration = Sonifier.defaultSequenceDuration / Object.values(audioDomain).map(d => d.length).reduce((acc, v) => acc + v);
  }

  // add pauses for the end values
  const ends = Object.entries(audioSpecState).map(([field, index]) => {
    return index === audioDomain[field].length - 1 ? 1 : 0;
  }).reverse();
  let endCount = 0;
  for (let x of ends) {
    if (x) {
      endCount++;
    }
    else break;
  }
  if (endCount > 0) {
    note.pauseAfter = Sonifier.pauseDuration * endCount;
  }
  else {
    note.pauseAfter = 0;
    if (audioSpec.traversal !== 'selection' && !audioSpec.encoding.duration) {
      // ramp if the innermost loop is a slider value
      const fieldDef = audioSpec.traversal[audioSpec.traversal.length - 1];
      if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal') {
        note.ramp = true;
      }
    }
  }

  return note;
}
