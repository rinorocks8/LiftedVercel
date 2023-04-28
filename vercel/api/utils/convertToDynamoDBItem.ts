type AttributeValue =
  | { S: string }
  | { N: string }
  | { B: string }
  | { BOOL: boolean }
  | { NULL: boolean }
  | { M: DynamoDBItem }
  | { L: Array<DynamoDBItem> };

type DynamoDBItem = Record<string, AttributeValue>;

export function convertToDynamoDBItem<T extends Record<string, any>>(item: T): DynamoDBItem {
  const dynamoDBItem: DynamoDBItem = {};

  for (const key in item) {
    const value: any = item[key];
    if (typeof value === "number" || (!isNaN(value) && Number.isInteger(parseInt(value)))) {
      dynamoDBItem[key] = { N: value.toString() };
    } else if (typeof value === "boolean") {
      dynamoDBItem[key] = { BOOL: value };
    } else if (typeof value === "string") {
        dynamoDBItem[key] = { S: value };
    } else if (value instanceof Array) {
      dynamoDBItem[key] = { L: value.map(convertToDynamoDBItem) };
    } else if (value instanceof Object) {
      dynamoDBItem[key] = { M: convertToDynamoDBItem(value) };
    } else {
      throw new Error(`Unsupported value type for DynamoDB: ${typeof value}`);
    }
  }

  return dynamoDBItem;
}