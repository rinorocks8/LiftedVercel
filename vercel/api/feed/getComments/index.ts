import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError, AuthenticationError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { FollowingKey, WorkoutKey } from '../../graphql';

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

    const workoutGetParams = {
      TableName: process.env['Workout'],
      Key: AttributeValue.wrap(workout)
    };

    const workoutRes = await dynamoDBRequest("GetItem", workoutGetParams);
    if (workoutRes.Item === undefined) {
      throw new BodyError("Workout Not Found");
    }

    const workoutUserID = AttributeValue.unwrap(workoutRes.Item).userID;
    if (workoutUserID !== username) {
      const followingKey: FollowingKey = {
        userID: username,
        followingUserID: workoutUserID,
      };
      const getFollowing = {
        TableName: process.env['Following'],
        Key: AttributeValue.wrap(followingKey)
      };
      const following = await dynamoDBRequest("GetItem", getFollowing);
      if (following.Item === undefined) {
        throw new AuthenticationError("Not Following User");
      }
    }

    const getCommentsParams = {
      TableName: process.env['Comment'],
      IndexName: "CommentByWorkoutIDCreatedAt",
      KeyConditionExpression: "workoutID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey": body.workoutID,
      }),
    };
    
    let results = await dynamoDBRequest("Query", getCommentsParams);

    const comments = results.Items.map((item) => AttributeValue.unwrap(item));

    return responder.success({
      comments: comments,
    });
  } catch (error) {
    return responder.error(error);
  }
}
