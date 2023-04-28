import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { z } from "zod";
import { AuthenticationError, BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { LikeKey } from '../../graphql'

export const config = {
  runtime: "experimental-edge",
};

const API_KEY = process.env.API_KEY;

const requestBodySchema = z.object({
  workoutID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== API_KEY) {
      throw new AuthenticationError("Unauthorized request")
    }

    const body = requestBodySchema.parse(await req.json());

    const queryParamsDynamo = {
      TableName: process.env["Like"],
      KeyConditionExpression: "workoutID = :pk",
      ExpressionAttributeValues: {
        ":pk": {
          "S": body.workoutID,
        }
      },
      ProjectionExpression: "workoutID, userID",
      ExclusiveStartKey: null,
    };
    
    let likes: LikeKey[] = [];
    let response;
    do {
      response = await dynamoDBRequest("Query", queryParamsDynamo);
      likes.push(...response.Items);
      queryParamsDynamo.ExclusiveStartKey = response.LastEvaluatedKey;
    } while (response.LastEvaluatedKey);

    const batches: any = [];
    for (let i = 0; i < likes.length; i += 25) {
      const batch = likes.slice(i, i + 25);
      const deleteRequests = batch.map((item) => {
        return {
          DeleteRequest: {
            Key: item,
          },
        };
      });
      batches.push(deleteRequests);
    }
    
    for (let i = 0; i < batches.length; i++) {
      const params = {
        RequestItems: {
          [process.env["Like"] || ""]: batches[i],
        },
      };
      await dynamoDBRequest("BatchWriteItem", params);
      console.log(`Batch ${i + 1} of ${batches.length} completed`);
    }
    
    return responder.success({
      result: "Deleted Likes",
    });
  } catch (error) {
    return responder.error(error);
  }
}