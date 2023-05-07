import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { z } from "zod";
import * as responder from '../../utils/responder';

import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  lastUpdated: z.number(),
});

async function fetchAllData(queryParamsDynamo: any): Promise<any[]> {
  let updates: any[] = [];
  let lastEvaluatedKey = null;

  do {
    if (lastEvaluatedKey) {
      queryParamsDynamo.ExclusiveStartKey = lastEvaluatedKey;
    }
    let response = await dynamoDBRequest("Query", queryParamsDynamo);
    updates.push(...response.Items.map(item => AttributeValue.unwrap(item)));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return updates;
}


export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = requestBodySchema.parse(await req.json());

    const exerciseQueryParams = {
      TableName: process.env['Exercise'],
      IndexName: "ExerciseByUserIDLastUpdated",
      KeyConditionExpression: "userID = :pk AND lastUpdated > :sk",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":pk": username,
        ":sk": body.lastUpdated,
      }),
    };
    const workoutQueryParams = {
      TableName: process.env['Workout'],
      IndexName: "WorkoutByUserIDLastUpdated",
      KeyConditionExpression: "userID = :pk AND lastUpdated > :sk",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":pk": username,
        ":sk": body.lastUpdated,
      }),
    };

    let [exerciseUpdates, workoutUpdates] = await Promise.all([fetchAllData(exerciseQueryParams), fetchAllData(workoutQueryParams)]);

    return responder.success({
      exercises: exerciseUpdates,
      workouts: workoutUpdates
    });

  } catch (error) {
    return responder.error(error);
  }
}