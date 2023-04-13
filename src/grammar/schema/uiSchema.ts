import { JSONSchema7 } from "json-schema";
import { VisualPropName } from "../Types";

const originalSchema: JSONSchema7 = require('./umwelt.schema.json');

const postProcessSchema = (originalSchema: JSONSchema7) => {
  let schema = structuredClone(originalSchema);

  const fieldNameWatcher = {
    "watch": {
      "fieldNames": "UmweltSpec.fields"
    },
    "enumSource": [{
      "source": "fieldNames",
      "value": "{{item.name}}"
    }]
  }

  schema.definitions = Object.fromEntries(Object.entries(schema.definitions).map(([key, def]: [string, any]) => {
    switch (key) {
      case 'UmweltSpec':
        def.id = 'UmweltSpec';
        def.title = key;
        def.properties.data.propertyOrder = 1;
        def.properties.fields.propertyOrder = 2;
        break;
      case 'TextNode':
        def.properties.children.propertyOrder = 1001;
        def.defaultProperties = ['field', 'children'];
        break;
      case 'EncodingFieldDef':
      case 'AudioEncodingFieldDef':
      case 'AudioTraversalFieldDef':
        def.title = key;
        def.properties.field = {
          ...def.properties.field,
          ...fieldNameWatcher
        }
        def.properties.field.propertyOrder = 1;
        break;
      case 'VisualEncoding':
        def.defaultProperties = ['x', 'y', 'color'];
        break;
      case 'AudioEncoding':
        def.defaultProperties = ['pitch'];
        break;
      case 'VisualEncoding':
      case 'AudioEncoding':
        def.properties = Object.fromEntries(Object.entries(def.properties).map(([prop, encDef]: [VisualPropName, any]) => {
          encDef.anyOf[0] = {
            ...encDef.anyOf[0],
            ...fieldNameWatcher
          }
          return [prop, encDef];
        }))
        break;
      case 'UrlData':
        def.title = key;
        def.defaultProperties = ['url'];
        break;
      case 'InlineData':
        def.title = key;
        def.defaultProperties = ['values'];
        break;
      case 'InlineDataset':
        def = {
          "items": {
            "type": "object"
          },
          "type": "array"
        };
        break;
      case 'FieldDef':
        def.defaultProperties = ['name', 'type'];
      case "FieldEqualPredicate":
      case "FieldLTPredicate":
      case "FieldGTPredicate":
      case "FieldLTEPredicate":
      case "FieldGTEPredicate":
      case "FieldRangePredicate":
      case "FieldOneOfPredicate":
      case "FieldValidPredicate":
        def.title = key;
        def.defaultProperties = def.required;
        Object.entries(def.properties).forEach(([key, def]: [string, any]) => {
          if (def.anyOf) {
            def.anyOf = def.anyOf.filter(d => {
              return !["#/definitions/DateTime", "#/definitions/ExprRef"].includes(d["$ref"]);
            })
          }
        })
        break;
    }
    return [key, def]
  }));
  return schema;
}

// propertyOrder

// "defaultProperties": ["name"]

export const uiSchema = postProcessSchema(originalSchema);