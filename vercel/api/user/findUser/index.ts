import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import * as responder from '../../utils/responder';
import { cognitoRequest } from "../../utils/cognitoRequest";
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { FollowingKey, FriendRequestKey, UserKey } from "../../graphql";
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  preferred_username: z.string().min(1),
});

function isEmpty(obj: object): boolean {
  for (var i in obj) return false;
  return true;
}

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    let users = await cognitoRequest("ListUsers", {
      UserPoolId: process.env.userPoolID,
      AttributesToGet: ["preferred_username"],
      Filter: `preferred_username ^= \"${body.preferred_username}\"`,
      Limit: 60,
    });

    const usersWithDetails = await Promise.all(users.Users?.map(async (userRes) => {
      const followingKey: FollowingKey = {
        userID: username,
        followingUserID: userRes.Username,
      };

      const friendRequestKey: FriendRequestKey = {
        userID: userRes.Username,
        requestingUserID: username,
      };

      const userKey: UserKey = {
        userID: userRes.Username,
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

      const authResult = await dynamoDBRequest(operation, operation_body);
      let friendship = "not_following";
      if (username !== userRes.Username) {
        if (!isEmpty(authResult.Responses[process.env['Following'] || ""])) {
          friendship = "following";
        } else if (!isEmpty(authResult.Responses[process.env['FriendRequest'] || ""])) {
          friendship = "requested";
        }
      } else {
        friendship = "self";
      }

      const userDB = AttributeValue.unwrap(authResult.Responses[process.env['User'] || ""][0])

      return {
        userID: userRes.Username,
        preferred_username: userRes.Attributes?.find(
          (obj) => obj.Name === "preferred_username"
        )?.Value,
        friendship: friendship,
        followers: userDB.followers ?? 0,
        following: userDB.following ?? 0,
        name: userRes.UserAttributes?.find(
          (obj) => obj.Name === "name"
        )?.Value ?? "",
        bio: userRes.UserAttributes?.find(
          (obj) => obj.Name === "custom:bio"
        )?.Value ?? "",
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
        profile_small: userDB.profile_small ?? "",
        profile_medium: userDB.profile_medium ?? "",
        profile_large: userDB.profile_large ?? "",
      }
    }));

    return responder.success({
      users: usersWithDetails,
    });
  } catch (error) {
    return responder.error(error);
  }
}
