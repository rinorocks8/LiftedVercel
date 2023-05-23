import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { CommentKey, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import { AuthenticationError } from "../../utils/errors";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string().min(1),
  commentID: z.string().min(1),
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

    const comment: CommentKey = {
      id: body.commentID,
    };
    
    const operation_body = {
      TransactItems: [
        {
          Update: {
            TableName: process.env["Workout"],
            Key: AttributeValue.wrap(workout),
            UpdateExpression: "SET #comments = if_not_exists(#comments, :default) - :decr",
            ConditionExpression: "attribute_exists(userID) and attribute_exists(workoutID) and #comments > :zero",
            ExpressionAttributeNames: { "#comments": "comments" },
            ExpressionAttributeValues: AttributeValue.wrap({
              ":decr": 1,
              ":zero": 0,
              ":default": 0
            }),
          },
        },
        {
          Delete: {
            TableName: process.env["Comment"],
            Key: AttributeValue.wrap(comment),
            ConditionExpression: "attribute_exists(userID) and attribute_exists(id) and userID = :username",
            ExpressionAttributeValues: AttributeValue.wrap({
              ":username": username,
            }),
          },
        },
      ],
    };
    
    await dynamoDBRequest("TransactWriteItems", operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Comment or Workout Not Found, No Comment to Delete or Unauthorized to delete this comment");
      if (RegExp(/ConditionalCheckFailed\]/gi).test(error.message))
        throw new AuthenticationError("Unauthorized to delete this comment");
      throw error;
    })
    
    return responder.success({
      result: "Comment Deleted",
    });
  } catch (error) {
    return responder.error(error);
  }
}
