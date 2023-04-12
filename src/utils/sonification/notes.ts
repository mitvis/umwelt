import * as Tone from 'tone';
import { OlliDataset, OlliDatum } from "olli";
import { SonifiedNote } from "../../sonification";
import { AudioAggregateOp, AudioEncodingFieldDef, AudioPropName, ElaboratedAudioSpec, ElaboratedFieldDef, SelectionSpec } from "../../grammar/Types";
import { getDomain, getFieldDef } from "../data";
import { FieldEqualPredicate, FieldPredicate, FieldRangePredicate } from 'vega-lite/src/predicate';
import { selectionTest } from '../selection';
import { FieldDefBase, FieldName } from 'vega-lite/src/channeldef';
import { serializeValue } from '../values';
import { AudioDomain, AudioPlaybackConfig, AudioSpecState } from '../../UmweltAudio';
import { aggregate } from '../aggregate';
import { getScaleFunction } from '../scales';
import { audioStateToSelectionSpec } from '../audioState';

export function audioStateToNote(audioSpec: ElaboratedAudioSpec, audioSpecState: AudioSpecState, audioDomain: AudioDomain, data: OlliDataset, fields: ElaboratedFieldDef[], playback: AudioPlaybackConfig): SonifiedNote {

  const selectionSpec = audioStateToSelectionSpec(audioSpecState, audioDomain);
  const selection = selectionTest(data, selectionSpec, fields);

  function audioEncoding(encodingPropName: AudioPropName, encodingFieldDef: AudioEncodingFieldDef, selection: OlliDataset) {
    const scale = getScaleFunction(encodingPropName, encodingFieldDef, fields, data);

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

  let note: SonifiedNote = {
    ramp: playback.ramp
  };

  Object.entries(audioSpec.encoding).forEach(([prop, encodingFieldDef]) => {
    const partial = audioEncoding(prop as AudioPropName, encodingFieldDef, selection);
    note = {
      ...note,
      ...partial
    }
  });

  return note;
}

// // important: because "data" param is used to calculate domain, don't pass in selection. pass in full data
// function datumToNote(datum: OlliDatum, encoding: ElaboratedAudioEncoding, data: OlliDataset): SonifiedNote {
//   const note = {} as any;
//   Object.entries(encoding).map(([prop, fieldDef]) => {
//     const field = fieldDef.field;
//     const value = datum[field];
//     const domain = getDomain(field, data);
//     let scaled = scale(Number(value), [Number(domain[0]), Number(domain[domain.length - 1])], getRange(prop as AudioPropName));
//     if (prop === 'pitch') {
//       scaled = Tone.Frequency(scaled, 'midi').toFrequency();
//     }
//     note[prop] = scaled;
//   });
//   return note;
// }

// function sequenceToNotes(audioSpec: ElaboratedAudioSpec, fields: ElaboratedFieldDef[], selected: OlliDataset, data: OlliDataset) {
//   if (audioSpec.traversal === 'selection') return [];
//   const sequenceFields = audioSpec.traversal.sequence.map(fieldDef => fieldDef.field);

//   const encoding = audioSpec.encoding;
//   return generateSequence(sequenceFields, 0, selected, fields, data);
//   // return dataSequence.map(datum => datum ? datumToNote(datum, encoding, selected) : null);

//   function generateSequence(sequenceFields: string[], idx: number, selected: OlliDataset, fields: ElaboratedFieldDef[], data: OlliDataset): SonifiedNote[] {
//     const field = sequenceFields[idx];
//     const fieldDef = getFieldDef(field, fields);
//     const domain = getDomain(field, data);
//     const selectionDomain = getDomain(field, selected);
//     let d = domain;
//     if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal') {
//       d = selectionDomain;
//     }
//     const seq = d.map((value) => {
//       if (idx === sequenceFields.length - 1) {
//         const filtered = selected.filter(datum => datum[field] === value);
//         if (filtered.length === 1) {
//           // if there's one datum for this value, convert it to a note
//           return datumToNote(filtered[0], encoding, data);
//         }
//         else if (filtered.length > 1) {
//           // if there's many datums for this value, and aggregation is defined, apply aggregation
//           const agg = getAggregateIfExists(encoding, filtered);
//           if (agg) {
//             return datumToNote(agg, encoding, data);
//           }
//         }
//         return null;
//       }
//       const nextSequences = generateSequence(sequenceFields, idx + 1, selected.filter(datum => serializeValue(datum[field], fieldDef) === serializeValue(value, fieldDef)), fields, data);
//        // add a pause set to the length of the max duration to space out the sequences
//       const withPause = nextSequences.concat({ duration: getRange('duration')[1] });
//       return withPause;
//     });
//     return seq.flat();
//   }
// }

// export function selectionToNotes(selected: OlliDataset, audioSpec: ElaboratedAudioSpec, fields: ElaboratedFieldDef[], data: OlliDataset): SonifiedNote[] {
//   if (audioSpec) {
//     if (audioSpec.traversal === 'selection') return []; // TODO shrug
//     if (audioSpec.traversal.sequence.length) {
//       // sequence exists on this spec
//       return sequenceToNotes(audioSpec, fields, selected, data);
//     }

//     const agg = getAggregateIfExists(audioSpec.encoding, selected);
//     if (agg) {
//       return [datumToNote(agg, audioSpec.encoding, data)];
//     }

//     return selected.map(datum => {
//       return datumToNote(datum, audioSpec.encoding, data);
//     });
//   }
//   return [];
// }

// function getAggregateIfExists(encoding: ElaboratedAudioEncoding, data: OlliDataset) {
//   const aggEncFieldDef = Object.values(encoding).find((encFieldDef) => {
//     return encFieldDef.aggregate;
//   });
//   if (aggEncFieldDef) {
//     const agg = aggregate(aggEncFieldDef, data);
//     return agg;
//   }
//   return null;
// }

