import { OlliDataset } from "olli";
import { AudioSpec, AudioTraversal, ElaboratedAudioEncoding, ElaboratedAudioSpec, ElaboratedAudioTraversal, ElaboratedFieldDef, ElaboratedUmweltSpec, ElaboratedVisualSpec, FieldDef, TextNode, ElaboratedTextNode, UmweltSpec, VisualSpec, VisualEncoding, AudioEncoding, ElaboratedEncodingFieldDef, EncodingFieldDef, ElaboratedAudioTraversalFieldDef } from "./Types"
import { typeInference, recommendVisuals, recommendAudio, recommendTextStructure } from "../utils/inference";
import { getFieldDef } from "../utils/data";
import { textSpecToFullPredicateSpec } from "../utils/text";
import { isString } from "vega";


export function elaborateFields(fields: FieldDef[], data: OlliDataset): ElaboratedFieldDef[] {
  return fields.map(fieldDef => {
    return {
      name: fieldDef.name,
      type: fieldDef.type || typeInference(data, fieldDef.name),
      scale: fieldDef.scale
    }
  });
}

export function elaborate(spec: UmweltSpec, data: OlliDataset, fields: ElaboratedFieldDef[]): ElaboratedUmweltSpec {

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

  function elaborateEncoding<T extends VisualEncoding | AudioEncoding>(encoding: T, fields: ElaboratedFieldDef[]) {
    const copy: T = structuredClone(encoding);
    // elaborate string field names into object field references
    Object.entries(encoding).forEach(([k, v]) => {
      copy[k] = elaborateFieldDef(v);
    });
    return copy;
  }

  function elaborateFieldDef(v: string | EncodingFieldDef): ElaboratedEncodingFieldDef {
    if (typeof v === 'string') {
      const {name, ...fieldDef} = getFieldDef(v, fields);
      return {
        ...fieldDef,
        field: name,
        scale: {
          ...(fieldDef.scale || {})
        }
      };
    }
    else {
      const {name, ...fieldDef} = getFieldDef(v.field, fields);
      return {
        ...fieldDef,
        ...v,
        scale: {
          ...(fieldDef.scale || {}),
          ...(v.scale || {})
        }
      }
    }
  }

  function elaborateVisual(visual: VisualSpec | boolean, fields: ElaboratedFieldDef[]): ElaboratedVisualSpec | false {
    if (visual === false) return false;
    let partial: VisualSpec = structuredClone(visual);
    if (visual === true || visual === undefined) {
      partial = {};
    }
    else if (visual.encoding) {
      partial.encoding = elaborateEncoding(visual.encoding, fields);
    }
    try {
      return recommendVisuals(spec, data, partial);
    } catch (e) {
      console.warn(e);
      return partial as ElaboratedVisualSpec;
    }
  }

  function elaborateAudio(audio: AudioSpec | AudioSpec[] | boolean, fields: ElaboratedFieldDef[]): ElaboratedAudioSpec[] | false {
    if (audio === false) return false;
    if (audio === true || audio === undefined) {
      // return [recommendAudio(spec, data, {})];
      return false; // TODO implement recommendAudio
    }

    function elaborateSingleAudio(audio: AudioSpec, fields: ElaboratedFieldDef[]): ElaboratedAudioSpec {
      return {
        traversal: elaborateTraversal(audio.traversal, fields),
        encoding: elaborateEncoding(audio.encoding, fields) as ElaboratedAudioEncoding
      };
    }

    function elaborateTraversal(traversal: AudioTraversal | "selection", fields: ElaboratedFieldDef[]): ElaboratedAudioTraversal | "selection" {
      if (traversal === 'selection') return traversal;
      // TODO should probably inherit properties from the umvelt fields definition?

        if (traversal) {
          if (Array.isArray(traversal)) {
            return traversal.map((s) => {
              return elaborateFieldDef(s) as ElaboratedAudioTraversalFieldDef;
            });
          }
          else {
            return [ elaborateFieldDef(traversal) as ElaboratedAudioTraversalFieldDef ];
          }
        }
        return [];
    }

    if (Array.isArray(audio)) {
      return audio.map(a => elaborateSingleAudio(a, fields));
    }
    else {
      return [elaborateSingleAudio(audio, fields)];
    }

  }


  function elaborateText(textSpec: TextNode | TextNode[] | boolean, fields: ElaboratedFieldDef[], data: OlliDataset, visual?: ElaboratedVisualSpec | false): ElaboratedTextNode[] | false {

    function ensureFirstLayerHasOneRoot(textPredTree: ElaboratedTextNode[]): ElaboratedTextNode[] {
      if (textPredTree.length === 1) {
        return textPredTree
      }
      return [
        {
          fullPredicate: {and: []},
          children: textPredTree
        }
      ]
    }

    if (textSpec === false) {
      return false;
    }
    else if (textSpec === true || textSpec === undefined) {
      const inferredTextSpec = recommendTextStructure(fields, visual);
      console.log('inferred text spec', inferredTextSpec);
      return ensureFirstLayerHasOneRoot(textSpecToFullPredicateSpec(inferredTextSpec, fields, data, {and: []}));
    }
    else {
      let normalizedTextSpec: TextNode[];
      if (!Array.isArray(textSpec)) {
        normalizedTextSpec = [textSpec];
      }
      else {
        normalizedTextSpec = textSpec;
      }
      return ensureFirstLayerHasOneRoot(textSpecToFullPredicateSpec(normalizedTextSpec, fields, data, {and: []}));
    }
  }

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