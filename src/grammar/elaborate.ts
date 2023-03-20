import { OlliDataset } from "olli";
import { AudioSpec, ElaboratedAudioEncoding, ElaboratedAudioSpec, ElaboratedFieldDef, ElaboratedUmweltSpec, ElaboratedVisualSpec, FieldDef, TextNode, TextPredTreeNode, UmweltSpec, VisualSpec } from "./Types"
import { typeInference, recommendVisuals, recommendAudio, recommendTextStructure } from "../utils/inference";
import { getFieldDef } from "../utils/data";
import { datumToPredicate, selectionTest } from "../utils/selection";
import { fieldToPredicates, textNodeToPredicateTextNode } from "../utils/text";
import { LogicalAnd } from "vega-lite/src/logical";
import { FieldPredicate } from "vega-lite/src/predicate";


export function elaborate(spec: UmweltSpec, data: OlliDataset): ElaboratedUmweltSpec {

  function elaborateFields(fields: FieldDef[]): ElaboratedFieldDef[] {
    return fields.map(fieldDef => {
      return {
        name: fieldDef.name,
        type: fieldDef.type || typeInference(data, fieldDef.name),
        scale: fieldDef.scale || {}
      }
    });
  }

  // function elaborateRecommender(structure: ElaboratedStructureNode[], visualRender: VisualSpec | boolean, encoding: Encoding<string>) {
  //   let partial = undefined;
  //   if (typeof visualRender === "object") {
  //     partial = {mark: visualRender.mark, encoding};
  //   }
  //   const rec = recommendVisuals(spec, structure, data, partial);
  //   const structureCopy = structuredClone(structure);
  //   Object.keys(rec.encoding).forEach(channel => {
  //     if (!encoding[channel]) {
  //       // user-given encoding did not already have this channel
  //       traverseStructure(structureCopy, (node) => {
  //         if (node.field === rec.encoding[channel].field) {
  //           node.encoding.visual.push({type: channel as VisualPropertyType})
  //         }
  //       })
  //     }
  //   });

  //   return {
  //     structure: structureCopy,
  //     mark: rec.mark
  //   };
  // }

  // const structure = elaborateStructure(spec.structure);
  // const encoding = assembleEncoding(structure);
  // const recommender = elaborateRecommender(structure, spec.render.visual, encoding);

  function elaborateEncoding(encoding, fields: ElaboratedFieldDef[]) {
    const copy = structuredClone(encoding);
    // elaborate string field names into object field references
    Object.entries(encoding).forEach(([k, v]) => {
      if (typeof v === 'string') {
        const {name, ...fieldDef} = getFieldDef(v, fields);
        copy[k] = {
          field: name,
          ...fieldDef
        };
      }
    });
    return copy;
  }

  function elaborateVisual(visual: VisualSpec | boolean, fields: ElaboratedFieldDef[]): ElaboratedVisualSpec | false {
    if (!visual) return false;
    let partial: VisualSpec = structuredClone(visual);
    if (visual !== true) {
      if (visual.encoding) {
        partial.encoding = elaborateEncoding(visual.encoding, fields);
      }
    }
    else {
      partial = {};
    }
    try {
      return recommendVisuals(spec, data, partial);
    } catch (e) {
      console.error(e);
      console.log(partial);
      return partial as ElaboratedVisualSpec;
    }
  }

  function elaborateAudio(audio: AudioSpec | AudioSpec[] | boolean, fields: ElaboratedFieldDef[]): ElaboratedAudioSpec[] | false {
    if (!audio) return false;
    if (audio === true) {
      return [recommendAudio(spec, data, {})];
    }

    function elaborateSingleAudio(audio: AudioSpec, fields: ElaboratedFieldDef[]): ElaboratedAudioSpec {
      return {
        ...structuredClone(audio),
        encoding: elaborateEncoding(audio.encoding, fields) as ElaboratedAudioEncoding
      };
    }

    if (Array.isArray(audio)) {
      return audio.map(a => elaborateSingleAudio(a, fields));
    }
    else {
      return [elaborateSingleAudio(audio, fields)];
    }

  }


  function elaborateText(textSpec: TextNode | TextNode[] | boolean, fields: ElaboratedFieldDef[], data: OlliDataset, visual?: ElaboratedVisualSpec | false): TextPredTreeNode[] | false {
    if (!textSpec) {
      return false;
    }
    else if (textSpec === true) {
      // TODO infer text
      const inferredTextSpec = recommendTextStructure(fields, visual);
      return textNodeToPredicateTextNode(inferredTextSpec, fields, data, {and: []});
    }
    else {
      let cleanedTextSpec: TextNode[];
      if (!Array.isArray(textSpec)) {
        cleanedTextSpec = [textSpec];
      }
      else {
        cleanedTextSpec = textSpec;
      }
      return textNodeToPredicateTextNode(cleanedTextSpec, fields, data, {and: []});
    }
  }

  const fields = elaborateFields(spec.fields);

  const visual = elaborateVisual(spec.visual, fields);

  const text = elaborateText(spec.text, fields, data, visual);

  return {
    data: {values: data},
    selection: spec.selection,
    fields,
    visual,
    audio: elaborateAudio(spec.audio, fields),
    text
  }
}