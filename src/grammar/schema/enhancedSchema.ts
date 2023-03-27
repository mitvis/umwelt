import { JSONSchema7 } from "json-schema";
import { VisualPropName } from "../Types";

const originalSchema: JSONSchema7 = require('./umwelt.schema.json');

const postProcessSchema = (originalSchema: JSONSchema7) => {
  let schema = structuredClone(originalSchema);

  const fieldNameWatcher = {
    "watch": {
      "fieldNames": "UIUmweltSpec.fields"
    },
    "enumSource": [{
      "source": "fieldNames",
      "value": "{{item.name}}"
    }]
  }

  schema.definitions = Object.fromEntries(Object.entries(schema.definitions).map(([key, def]: [string, any]) => {
    switch (key) {
      case 'UIUmweltSpec':
        def.id = 'UIUmweltSpec';
        def.properties.data.propertyOrder = 1;
        def.properties.fields.propertyOrder = 2;
        break;
      case 'FieldTextNode':
      case 'PredTextNode':
        def.properties.children.propertyOrder = 1001;
        break;
      case 'EncodingFieldDef':
      case 'AudioEncodingFieldDef':
      case 'AudioTraversalFieldDef':
        def.properties.field = {
          ...def.properties.field,
          ...fieldNameWatcher
        }
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
    }
    return [key, def]
  }));
  return schema;
}

// propertyOrder

// "defaultProperties": ["name"]

export const enhancedSchema = postProcessSchema(originalSchema);