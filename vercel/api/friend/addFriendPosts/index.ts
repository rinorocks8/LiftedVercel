import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import * as responder from '../../utils/responder';
import { Feed } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import { AuthenticationError } from "../../utils/errors";

const API_KEY = process.env.API_KEY;

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  userID: z.string().min(1),
  requesterID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== API_KEY) {
      throw new AuthenticationError("Unauthorized request")
    }

    const body = requestBodySchema.parse(await req.json());

    const getFeedParams = {
      TableName: process.env['Workout'],
      IndexName: "WorkoutByUserIDStartTime",
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey": body.userID,
      }),
      ProjectionExpression: "workoutID, startTime",
    };
    
    let results = await dynamoDBRequest("Query", getFeedParams);
    if (results.Items.length === 0) {
      return responder.success({
        workouts: [],
      });
    }

    const writeItems: any[] = [];
    for (const _workout of results.Items) {
      const workout = AttributeValue.unwrap(_workout)
      const post: Feed = {
        userID: body.requesterID,
        createdAt: workout.startTime,
        workoutID: workout.workoutID,
        workoutUserID: body.userID
      }

      writeItems.push({
        PutRequest: {
          Item: AttributeValue.wrap(post)
        },
      });
    }

    const batches: any[][] = [];
    while(writeItems.length) {
      batches.push(writeItems.splice(0, 25));
    }

    let promises = batches.map(batch => {
      const operation_body = {
        RequestItems: {
          [process.env["Feed"] ?? ""]: batch
        }
      };
      return dynamoDBRequest("BatchWriteItem", operation_body);
    });
    await Promise.all(promises);

    return responder.success({
      result: `Added ${results.Items.length} posts to feed.`,
    });
  } catch (error) {
    return responder.error(error);
  }
}