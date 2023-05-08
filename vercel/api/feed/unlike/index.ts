
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { LikeKey, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string().min(1)
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = requestBodySchema.parse(await req.json());

    const workout: WorkoutKey = {
      workoutID: body.workoutID,
    }

    const like: LikeKey = {
      userID: username,
      workoutID: body.workoutID,
    };
    
    const operation_body = {
      TransactItems: [
        {
          Update: {
            TableName: process.env["Workout"],
            Key: AttributeValue.wrap(workout),
            UpdateExpression: "SET #likes = #likes + :incr",
            ConditionExpression: "attribute_exists(userID) and attribute_exists(workoutID)",
            ExpressionAttributeNames: { "#likes": "likes" },
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": -1
            }),
          },
        },
        {
          Delete: {
            TableName: process.env["Like"],
            Key: AttributeValue.wrap(like),
            ConditionExpression:
              "attribute_exists(userID) and attribute_exists(workoutID)",
          },
        },
      ],
    };
    
    await dynamoDBRequest("TransactWriteItems", operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Workout Not Found");
      if (RegExp(/\, ConditionalCheckFailed]/gi).test(error.message))
        throw new BodyError("Workout Not Liked");
      throw error;
    })
    
    return responder.success({
      result: "Unliked",
    });
  } catch (error) {
    return responder.error(error);
  }
}