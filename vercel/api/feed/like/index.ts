
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { Like, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string().min(1),
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

    const like: Like = {
      userID: username,
      workoutID: body.workoutID,
      createdAt: new Date().toISOString(),
    };
    
    const operation_body = {
      TransactItems: [
        {
          Update: {
            TableName: process.env["Workout"],
            Key: AttributeValue.wrap(workout),
            UpdateExpression: "SET #likes = if_not_exists(#likes, :default) + :incr",
            ConditionExpression: "attribute_exists(userID) and attribute_exists(workoutID)",
            ExpressionAttributeNames: { "#likes": "likes" },
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": 1,
              ":default": 0
            }),
          },
        },
        {
          Put: {
            TableName: process.env["Like"],
            Item: AttributeValue.wrap(like),
            ConditionExpression:
              "attribute_not_exists(userID) and attribute_not_exists(workoutID)",
          },
        },
      ],
    };
    
    await dynamoDBRequest("TransactWriteItems", operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Workout Not Found");
      if (RegExp(/\, ConditionalCheckFailed]/gi).test(error.message))
        throw new BodyError("Workout Already Liked");
      throw error;
    })
    
    return responder.success({
      result: "Liked",
    });
  } catch (error) {
    return responder.error(error);
  }
}