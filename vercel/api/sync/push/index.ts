import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { z } from "zod";
import * as responder from '../../utils/responder';

import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  exercises: z.array(z.object({
    id: z.string(),
    lastUpdated: z.number(),
    name: z.string(),
    userID: z.string(),
    isDirty: z.boolean().optional(),
  })).optional(),
  workouts: z.array(z.object({
    id: z.string(),
    lastUpdated: z.number(),
    name: z.string(),
    userID: z.string(),
    isDirty: z.boolean().optional(),
  })).optional(),
});

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = requestBodySchema.parse(await req.json());

    const transactItems: any = [];

    for (let exercise of body.exercises ?? []) {
      delete exercise.isDirty;
      transactItems.push({
        Put: {
          TableName: process.env['Exercise'],
          Item: convertToDynamoDBItem(exercise),
        },
      })
    }

    for (let workout of body.workouts ?? []) {
      delete workout.isDirty;
      transactItems.push({
        Put: {
          TableName: process.env['Workout'],
          Item: convertToDynamoDBItem(workout),
        },
      })
    }

    if (transactItems.length === 0) {
      return responder.success({
        result: "no changes"
      });
    }

    const chunkedTransactItems = chunkArray(transactItems, 100);
    const results: any[] = [];

    for (const chunk of chunkedTransactItems) {
      const operation_body = {
        TransactItems: chunk,
      };
      const check_result = await dynamoDBRequest("TransactWriteItems", operation_body);
      results.push(check_result);
    }

    return responder.success({
      result: results
    });

  } catch (error) {
    return responder.error(error);
  }
}
