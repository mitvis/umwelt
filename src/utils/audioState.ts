import { OlliDataset, OlliDatum } from "olli";
import { Bin } from "vega-lite/src/bin";
import { LogicalAnd, LogicalComposition } from "vega-lite/src/logical";
import { FieldPredicate, FieldEqualPredicate, FieldRangePredicate } from "vega-lite/src/predicate";
import { SelectionSpec, ElaboratedAudioSpec, ElaboratedFieldDef, AudioEncodingFieldDef, AudioPropName, AudioTraversalFieldDef, ElaboratedAudioTraversalFieldDef, ElaboratedAudioEncodingFieldDef, ElaboratedAudioEncoding, EncodingPropName } from "../grammar";
import { SonifierNote } from "../sonification";
import { AudioSpecDomains, AudioSpecIndices } from "../UmweltAudio";
import { aggregate } from "./aggregate";
import { getBins } from "./bin";
import { getDomain, getFieldDef } from "./data";
import { getScaleFunction, ScaleFunction } from "./scales";
import { datumToPredicate, selectionTest } from "./selection";
import { rangesAreEqual, serializeValue } from "./values";
import { Sonifier } from '../sonification';
import fastCartesian from 'fast-cartesian'

export function audioStateToSelectionSpec(indices: AudioSpecIndices, domains: AudioSpecDomains): SelectionSpec {
  return {
    predicate: {
      and: Object.entries(indices).map(([field, idx]) => {
        const value = domains[field][idx];
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

export function generateSequence(audioSpec: ElaboratedAudioSpec, specDomains: AudioSpecDomains, data: OlliDataset): SonifierNote[] {

  if (audioSpec.traversal === 'selection') return [];

  const sequenceFields = [...audioSpec.traversal.map(f => f.field)];

  const states: AudioSpecIndices[] = fastCartesian(sequenceFields.map(field => specDomains[field].map((_, idx: number) => idx))).map(s => {
    return Object.fromEntries(s.map((value, index) => {
      if (audioSpec.traversal !== 'selection') {
        return [audioSpec.traversal[index].field, value]
      }
    }))
  });

  const notes = states.map((state) => {
    return {
      ...audioStateToNote(audioSpec, state, specDomains, data),
      indices: state
    }
  });
  notes[0].elapsed = 0;
  for (let i = 1; i < notes.length; i++) {
    notes[i].elapsed = notes[i - 1].elapsed + notes[i - 1].duration + (notes[i - 1].pauseAfter || 0);
  }

  return notes;
}

export function audioStateToNote(audioSpec: ElaboratedAudioSpec, specIndices: AudioSpecIndices, specDomains: AudioSpecDomains, data: OlliDataset): SonifierNote {
  const selectionSpec = audioStateToSelectionSpec(specIndices, specDomains);
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

  let note: Partial<SonifierNote> = encodeAudio(audioSpec.encoding, selection);

  if (!Object.keys(note).length) {
    note = {noise: true};
  }

  if (!note.duration) {
    note.duration = Sonifier.defaultSequenceDuration / Object.values(specDomains).map(d => d.length).reduce((acc, v) => acc + v);
  }

  // add pauses for the end values
  const ends = Object.entries(specIndices).map(([field, index]) => {
    return index === specDomains[field].length - 1 ? 1 : 0;
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

  return note as SonifierNote;
}
