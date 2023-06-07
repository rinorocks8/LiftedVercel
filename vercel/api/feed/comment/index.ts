import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { AuthenticationError, BodyError, ParameterError } from "../../utils/errors";
import * as responder from '../../utils/responder';
import { Comment, FollowingKey, User, UserKey, Workout, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import { moderationRequest } from "../../utils/moderationRequest";
import { cognitoRequest } from "../../utils/cognitoRequest";
import { deliverNotification } from "../../utils/deliverNotification";

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
            Key: AttributeValue.wrap(workoutKey),
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
      deliverNotification(user?.endpointArn, `@${preferred_username} commented: "${body.text}"`)
    
    return responder.success({
      result: "Commented",
    });
  } catch (error) {
    return responder.error(error);
  }
}
