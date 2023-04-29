import { z } from "zod";
import { ParameterError } from "../../utils/errors";
import * as responder from "../../utils/responder";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { cognitoRequest } from "../../utils/cognitoRequest";
import { FollowingKey, FriendRequestKey } from "../../graphql";
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";

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

    const operation = "BatchGetItem";
    const operation_body = {
      RequestItems: {
        [process.env['Following'] || ""]: {
          Keys: [convertToDynamoDBItem(followingKey)]
        },
        [process.env['FriendRequest'] || ""]: {
          Keys: [convertToDynamoDBItem(friendRequestKey)]
        }
      }
    };

    let friendship = "not_following";
    if (username !== body.username) {
      let authResult = await dynamoDBRequest(operation, operation_body);
      if (!isEmpty(authResult.Responses[process.env['Following'] || ""])) {
        friendship = "following";
      } else if (!isEmpty(authResult.Responses[process.env['FriendRequest'] || ""])) {
        friendship = "requested";
      }
    } else {
      friendship = "self";
    }

    return responder.success({
      user: {
        userID: user.Username,
        preferred_username: user.UserAttributes?.find(
          (obj) => obj.Name === "preferred_username"
        )?.Value,
        friendship: friendship,
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
