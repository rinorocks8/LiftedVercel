import { ParameterError } from "../../utils/errors";
import * as responder from "../../utils/responder";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { cognitoRequest } from "../../utils/cognitoRequest";
import { FollowingKey, FriendRequestKey, UserKey } from "../../graphql";
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  username: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const user = await cognitoRequest(	
        "AdminGetUser", {
          Username: body.username,
          UserPoolId: process.env.userPoolID,
        }).catch((error) => {
          if (error.message === "User does not exist.")
            throw new ParameterError("User Not Found");
        })

    const followingKey: FollowingKey = {
      userID: username,
      followingUserID: body.username,
    };

    const friendRequestKey: FriendRequestKey = {
      userID: body.username,
      requestingUserID: username,
    };

    const userKey: UserKey = {
      userID: body.username,
    };

    const operation = "BatchGetItem";
    const operation_body = {
      RequestItems: {
        [process.env['Following'] || ""]: {
          Keys: [AttributeValue.wrap(followingKey)]
        },
        [process.env['FriendRequest'] || ""]: {
          Keys: [AttributeValue.wrap(friendRequestKey)]
        },
        [process.env['User'] || ""]: {
          Keys: [AttributeValue.wrap(userKey)]
        }
      }
    };

    let authResult = await dynamoDBRequest(operation, operation_body);
    let friendship = "not_following";
    if (username !== body.username) {
      if (!isEmpty(authResult.Responses[process.env['Following'] || ""])) {
        friendship = "following";
      } else if (!isEmpty(authResult.Responses[process.env['FriendRequest'] || ""])) {
        friendship = "requested";
      }
    } else {
      friendship = "self";
    }

    const userDB = AttributeValue.unwrap(authResult.Responses[process.env['User'] || ""][0])

    return responder.success({
      user: {
        userID: user.Username,
        preferred_username: user.UserAttributes?.find(
          (obj) => obj.Name === "preferred_username"
        )?.Value,
        friendship: friendship,
        followers: userDB.followers ?? 0,
        following: userDB.following ?? 0,
        name: userDB.name ?? "",
        bio: userDB.bio ?? "",
        total_exercises: userDB.total_exercises ?? 0,
        total_workouts: userDB.total_workouts ?? 0,
        total_weight: userDB.total_weight ?? 0,
        total_sets: userDB.total_sets ?? 0,
        total_duration: userDB.total_duration ?? 0,
        longestStreak: userDB.longestStreak ?? 0,
        currentStreak: userDB.currentStreak ?? 0,
        workoutPercentage: userDB.workoutPercentage ?? 0,
        lastUpdated: userDB.lastUpdated ?? 0,
        total_days: userDB.total_days ?? 0,
      },
    });
  } catch (error) {
    return responder.error(error);
  }
}

function isEmpty(obj: object): boolean {
  for (var i in obj) return false;
  return true;
}
