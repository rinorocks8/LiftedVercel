const fs = require("fs");
const { parse } = require("graphql");

const types = {};

function getAttributeType(name, fields) {
  for (const field of fields) {
    if (field.name.value === name) {
      const typeName = field.type.type.name.value;
      return typeName;
    }
  }
  return null;
}

function convertTypeToDynamodbType(typeName) {
  if (typeName === "Int") {
    return "N";
  } else if (typeName === "Boolean") {
    return "B";
  } else {
    return "S";
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function processTable(definition) {
  const tableName = definition.name.value;
  const directives = definition.directives;
  const fields = definition.fields;

  for (const directive of directives) {
    const directiveName = directive.name.value;

    if (directiveName === "key" || directiveName === "gsi") {
      let hashKey = null;
      let rangeKey = null;
      for (const arg of directive.arguments) {
        if (arg.name.value === "pk") {
          hashKey = arg.value.value;
        } else if (arg.name.value === "sk") {
          rangeKey = arg.value.value;
        }
      }

      if (!(tableName in types)) {
        types[tableName] = {
          hash_key: {
            name: hashKey,
            type: convertTypeToDynamodbType(getAttributeType(hashKey, fields)),
            originalType: getAttributeType(hashKey, fields),
          },
          gsi: [],
        };
      }

      if (directiveName === "key") {
        types[tableName].range_key = rangeKey
          ? {
              name: rangeKey,
              type: convertTypeToDynamodbType(
                getAttributeType(rangeKey, fields)
              ),
              originalType: getAttributeType(hashKey, fields),
            }
          : null;
      }

      if (directiveName === "gsi") {
        const gsi = {
          name: `${tableName}By${capitalizeFirstLetter(
            hashKey
          )}${capitalizeFirstLetter(rangeKey)}`,
          hash_key: {
            name: hashKey,
            type: convertTypeToDynamodbType(getAttributeType(hashKey, fields)),
            originalType: getAttributeType(hashKey, fields),
          },
          range_key: {
            name: rangeKey,
            type: convertTypeToDynamodbType(getAttributeType(rangeKey, fields)),
            originalType: getAttributeType(hashKey, fields),
          },
        };
        types[tableName].gsi.push(gsi);
      }
    }
  }
}

fs.readFile("../schema.graphql", "utf-8", (err, schema) => {
  if (err) throw err;

  const documentDict = parse(schema);

  for (const definition of documentDict.definitions) {
    if (definition.kind === "ObjectTypeDefinition") {
      processTable(definition);
    }
  }

  const dataSources = {
    types: types,
  };

  fs.writeFile("schema.json", JSON.stringify(dataSources, null, 2), (err) => {
    if (err) throw err;
  });

  let keyTypes = "";

  Object.keys(types).map((key) => {
    keyTypes += `
type ${key}Key {
  ${types[key].hash_key.name}: ${types[key].hash_key.originalType}!
  ${
    types[key].range_key
      ? `${types[key].range_key.name}: ${types[key].range_key.originalType}!`
      : ""
  }
}
`;

    types[key].gsi.map((gsi) => {
      keyTypes += `
type ${gsi.name}Key {
  ${gsi.hash_key.name}: ${gsi.hash_key.originalType}!
  ${
    gsi.range_key ? `${gsi.range_key.name}: ${gsi.range_key.originalType}!` : ""
  }
}
`;
    });
  });

  schema += keyTypes;

  // Output graphql
  fs.writeFile("./schema_output.graphql", schema, (err) => {
    if (err) throw err;
  });

  const dataSourcesStr = {
    types: JSON.stringify(types),
  };

  console.log(JSON.stringify(dataSourcesStr));
});
