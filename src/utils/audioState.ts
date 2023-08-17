import { OlliDataset } from 'olli';
import { FieldEqualPredicate, FieldRangePredicate } from 'vega-lite/src/predicate';
import { AudioEncoding, AudioPropName, AudioUnitSpec, FieldDef, UmweltPredicate } from '../grammar';
import { SonifierNote } from './sonifier';
import { aggregate } from './aggregate';
import { DEFAULT_RANGES, getScaleFunction, scale } from './scales';
import { selectionTest } from './selection';
import { Sonifier } from './sonifier';
import fastCartesian from 'fast-cartesian';
import { AudioUnitFieldDomains, AudioUnitFieldSelectedIndices } from '../UmweltAudioUnit';
import { getFieldDef } from './data';
import { fmtValue } from './values';
import { getBins } from './bin';

export function audioStateToPredicate(indices: AudioUnitFieldSelectedIndices, domains: AudioUnitFieldDomains): UmweltPredicate {
  return {
    and: Object.entries(indices).map(([field, idx]) => {
      const value = domains[field][idx];
      const lastIndex = domains[field].length - 1;
      if (Array.isArray(value)) {
        return {
          field,
          range: value,
          inclusive: idx === lastIndex,
        } as FieldRangePredicate;
      } else {
        return {
          field,
          equal: value,
        } as FieldEqualPredicate;
      }
    }),
  };
}

export function generateSequence(audioSpec: AudioUnitSpec, specDomains: AudioUnitFieldDomains, fields: FieldDef[], data: OlliDataset): SonifierNote[] {
  const sequenceFields = [...audioSpec.traversal.map((f) => f.field)];
  const states: AudioUnitFieldSelectedIndices[] = fastCartesian(sequenceFields.map((field) => (specDomains[field] || []).map((_, idx: number) => idx))).map((s) => {
    return Object.fromEntries(
      s.map((value, index) => {
        return [audioSpec.traversal[index].field, value];
      })
    );
  });

  const notes = states.map((state) => {
    return {
      ...audioStateToNote(audioSpec, state, specDomains, fields, data),
      indices: state,
    };
  });

  assignNoteSpeakBefore(notes, specDomains, fields, data);
  assignNoteTimings(notes);

  return notes;
}

export function assignNoteTimings(notes: SonifierNote[]) {
  if (notes.length) {
    notes[0].elapsed = 0;
    for (let i = 1; i < notes.length; i++) {
      notes[i].elapsed = notes[i - 1].elapsed + notes[i - 1].duration + (notes[i - 1].pauseAfter || 0);
    }
  }
}

export function assignNoteSpeakBefore(notes: SonifierNote[], specDomains: AudioUnitFieldDomains, fields: FieldDef[], data: OlliDataset) {
  notes.forEach((note, idx) => {
    const sequenceFields = Object.keys(note.indices);
    const announcement = [];
    sequenceFields.forEach((field) => {
      const fieldDef = getFieldDef(field, fields);
      if (fieldDef.type === 'nominal' || fieldDef.type === 'ordinal') {
        if (idx === 0 || note.indices[field] !== notes[idx - 1].indices[field]) {
          announcement.push(fmtValue(specDomains[field][note.indices[field]], fieldDef));
        }
      } else {
        const bins = getBins(field, data, fields);
        if (idx === 0 && bins.length && bins[0].length) {
          announcement.push(fmtValue(bins[0][0], fieldDef));
        }
        if (idx > 0) {
          const noteValue = specDomains[field][note.indices[field]];
          const prevNoteValue = specDomains[field][notes[idx - 1].indices[field]];
          if (Array.isArray(noteValue) && Array.isArray(prevNoteValue)) {
            if (noteValue[0] !== prevNoteValue[0]) {
              announcement.push(fmtValue(noteValue[0], fieldDef));
            }
          } else {
            const binIdx = bins.findIndex((b) => {
              return b[0] <= noteValue && noteValue <= b[1];
            });
            const prevBinIdx = bins.findIndex((b) => {
              return b[0] <= prevNoteValue && prevNoteValue <= b[1];
            });
            if (binIdx !== prevBinIdx) {
              announcement.push(fmtValue(bins[binIdx][0], fieldDef));
            }
          }
        }
        // TODO last value
      }
    });
    if (announcement.length) {
      note.speakBefore = announcement.join(', ');
    }
  });
}

export function audioStateToNote(audioSpec: AudioUnitSpec, specIndices: AudioUnitFieldSelectedIndices, specDomains: AudioUnitFieldDomains, fields: FieldDef[], data: OlliDataset): SonifierNote {
  const selectionSpec = audioStateToPredicate(specIndices, specDomains);
  const selection = selectionTest(data, selectionSpec);

  function encodeAudio(audioEncoding: AudioEncoding, selection: OlliDataset) {
    return Object.entries(audioEncoding)
      .map(([prop, encodingFieldDef]) => {
        if (encodingFieldDef?.field) {
          if (encodingFieldDef.aggregate === 'count') {
            return {
              [prop]: scale(selection.length, [0, data.length / 2], DEFAULT_RANGES[prop]),
            };
          } else {
            const scaleFunc = getScaleFunction(prop as AudioPropName, encodingFieldDef, fields, data);
            if (selection.length && encodingFieldDef.aggregate) {
              const aggregatedValue = aggregate(encodingFieldDef, selection);

              return {
                [prop]: scaleFunc(aggregatedValue),
              };
            } else if (selection.length === 1) {
              // val is a value
              return {
                [prop]: scaleFunc(selection[0][encodingFieldDef.field]),
              };
            }
          }
        }
        return {};
      })
      .reduce((acc, val) => {
        return {
          ...acc,
          ...val,
        };
      });
  }

  let note: Partial<SonifierNote> = encodeAudio(audioSpec.encoding, selection);

  if (!Object.keys(note).length) {
    note = { noise: true };
  }

  if (!note.duration) {
    note.duration = Math.min(
      0.5,
      Sonifier.defaultSequenceDuration /
        Object.values(specDomains)
          .map((d) => d.length)
          .reduce((acc, v) => acc + v)
    );
  }
  if (!note.pitch) {
    note.pitch = 60;
  }
  if (note.volume === undefined) {
    note.volume = 0;
  }

  // add pauses for the end values
  const ends = Object.entries(specIndices)
    .map(([field, index]) => {
      return index === specDomains[field].length - 1 ? 1 : 0;
    })
    .reverse();
  let endCount = 0;
  for (let x of ends) {
    if (x) {
      endCount++;
    } else break;
  }
  if (endCount > 0) {
    note.pauseAfter = Sonifier.pauseDuration * endCount;
  } else {
    note.pauseAfter = 0;
    if (!audioSpec.encoding.duration) {
      // ramp if the innermost loop is a slider value
      const traversalFieldDef = audioSpec.traversal[audioSpec.traversal.length - 1];
      const fieldDef = getFieldDef(traversalFieldDef.field, fields);
      if (fieldDef.type === 'quantitative' || fieldDef.type === 'temporal' || fieldDef.type === 'ordinal') {
        note.ramp = true;
      }
    }
  }

  return note as SonifierNote;
}
