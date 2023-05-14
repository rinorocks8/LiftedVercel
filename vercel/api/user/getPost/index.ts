import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { z } from "zod";
import * as responder from '../../utils/responder';

import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { AttributeValue } from 'dynamodb-data-types';
import parseSchema from "../../utils/parseSchema";

import { FollowingKey, Workout, WorkoutKey } from '../../graphql'
import { AuthenticationError } from "../../utils/errors";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string(),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = parseSchema(requestBodySchema, await req.json());

    const workoutKey: WorkoutKey = {
      workoutID: body.workoutID
    }
    const getWorkout = {
      TableName: process.env['Workout'],
      Key: AttributeValue.wrap(workoutKey)
    };
    
    
    let _workout = await dynamoDBRequest("GetItem", getWorkout);

    const workout: Workout = AttributeValue.unwrap(_workout.Item)

    if (username !== workout.userID) {
      const followingKey: FollowingKey = {
        userID: username,
        followingUserID: workout.userID,
      };
      const getFollowing = {
        TableName: process.env['Following'],
        Key: AttributeValue.wrap(followingKey)
      };
      const following = await dynamoDBRequest("GetItem", getFollowing)
      if (following.Item === undefined) {
        throw new AuthenticationError("Not Following User")
      }
    }

    return responder.success({
      workout: workout
    });

  } catch (error) {
    return responder.error(error);
  }
}