import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError, AuthenticationError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { FollowingKey, UserKey, Comment, WorkoutKey } from '../../graphql';
import { cognitoRequest } from "../../utils/cognitoRequest";

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

    const workoutKey: WorkoutKey = {
      workoutID: body.workoutID,
    }

    const workoutGetParams = {
      TableName: process.env['Workout'],
      Key: AttributeValue.wrap(workoutKey)
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

    const comments = await Promise.all(results.Items.map(async (item) => {
      const comment: Comment = AttributeValue.unwrap(item);

      const userKey: UserKey = {
        userID: comment.userID,
      }

      const [userDBData, cognitoUserData] = await Promise.all([
        dynamoDBRequest("GetItem", {
          TableName: process.env['User'],
          Key: AttributeValue.wrap(userKey)
        }),
        cognitoRequest("AdminGetUser", {
          Username: comment.userID,
          UserPoolId: process.env.userPoolID
        }),
      ]);

      const userDB = userDBData.Item ? AttributeValue.unwrap(userDBData.Item) : {};
      const username = cognitoUserData?.UserAttributes?.find(
        (obj) => obj.Name === "preferred_username"
      )?.Value;

      return {
        ...comment,
        username: username,
        profile_small: userDB?.profile_small ?? "",
        profile_medium: userDB?.profile_medium ?? "",
        profile_large: userDB?.profile_large ?? "",
      };
    }));

    return responder.success({
      comments: comments,
    });
  } catch (error) {
    return responder.error(error);
  }
}
