
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { AuthenticationError, BodyError, ParameterError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { FollowingKey, Like, User, UserKey, Workout, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import { deliverNotification } from "../../utils/deliverNotification";
import { cognitoRequest } from "../../utils/cognitoRequest";

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

    //Pull up workout -> get userID
    const workoutKey: WorkoutKey = {
      workoutID: body.workoutID
    }
    const getWorkout = {
      TableName: process.env['Workout'],
      Key: AttributeValue.wrap(workoutKey)
    };
    let _workout = await dynamoDBRequest("GetItem", getWorkout);
    const workout: Workout = AttributeValue.unwrap(_workout.Item)

    //check up following
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

    //transact like, get username
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
            Key: AttributeValue.wrap(workoutKey),
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
    
    //Get username and deviceId
    const userKey: UserKey = {
      userID: workout.userID
    }
    const getUser = {
      TableName: process.env['User'],
      Key: AttributeValue.wrap(userKey)
    };
    const [_user, userCognito] = await Promise.all([
      dynamoDBRequest("GetItem", getUser),
      cognitoRequest(	
        "AdminGetUser", {
          Username: username,
          UserPoolId: process.env.userPoolID,
        }).catch((error) => {
          if (error.message === "User does not exist.")
            throw new ParameterError("User Not Found");
        })
    ])
    
    const preferred_username = userCognito.UserAttributes?.find(
      (obj) => obj.Name === "preferred_username"
    )?.Value;
    const user: User = AttributeValue.unwrap(_user.Item)
    if (user?.endpointArn)
      deliverNotification(user?.endpointArn, `@${preferred_username} liked your post.`)
    
    return responder.success({
      result: "Liked",
    });
  } catch (error) {
    return responder.error(error);
  }
}