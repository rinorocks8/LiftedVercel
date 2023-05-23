import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { Comment, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import { moderationRequest } from "../../utils/moderationRequest";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string().min(1),
  text: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = requestBodySchema.parse(await req.json());

    const isCommentFlagged = await moderationRequest(body.text);
    if(isCommentFlagged) {
      throw new BodyError("Inappropriate Comment Content");
    }

    const workout: WorkoutKey = {
      workoutID: body.workoutID,
    }

    const comment: Comment = {
      id: crypto.randomUUID(),
      userID: username,
      workoutID: body.workoutID,
      text: body.text,
      createdAt: new Date().toISOString(),
    };
    
    const operation_body = {
      TransactItems: [
        {
          Update: {
            TableName: process.env["Workout"],
            Key: AttributeValue.wrap(workout),
            UpdateExpression: "SET #comments = if_not_exists(#comments, :default) + :incr",
            ConditionExpression: "attribute_exists(userID) and attribute_exists(workoutID)",
            ExpressionAttributeNames: { "#comments": "comments" },
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": 1,
              ":default": 0
            }),
          },
        },
        {
          Put: {
            TableName: process.env["Comment"],
            Item: AttributeValue.wrap(comment),
          },
        },
      ],
    };
    
    await dynamoDBRequest("TransactWriteItems", operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Workout Not Found");
      throw error;
    })
    
    return responder.success({
      result: "Commented",
    });
  } catch (error) {
    return responder.error(error);
  }
}
