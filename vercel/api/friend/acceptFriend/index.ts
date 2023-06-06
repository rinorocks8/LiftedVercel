import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError, ParameterError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Following, FriendRequestKey, User, UserKey } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';
import { cognitoRequest } from "../../utils/cognitoRequest";
import { deliverNotification } from "../../utils/deliverNotification";

const API_KEY = process.env.API_KEY;

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  requesterID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const url = req.headers.get("x-forwarded-proto") + "://" + req.headers.get("host");

    const body = requestBodySchema.parse(await req.json());

    const accepted_at = new Date().toISOString();

    const friendRequest: FriendRequestKey = {
      userID: username,
      requestingUserID: body.requesterID,
    };
    
    const following1: Following = {
      userID: username,
      followingUserID: body.requesterID,
      acceptedAt: accepted_at,
    };

    const following2: Following = {
      userID: body.requesterID,
      followingUserID: username,
      acceptedAt: accepted_at,
    };

    const userKey1: UserKey = {
      userID: body.requesterID,
    };

    const userKey2: UserKey = {
      userID: username,
    };

    const operation = "TransactWriteItems";
    const operation_body = {
      TransactItems: [
				{
					//Delete request
					Delete: {
						TableName: process.env['FriendRequest'],
            Key: AttributeValue.wrap(friendRequest),
						ConditionExpression: 'attribute_exists(userID) and attribute_exists(requestingUserID)'
					}
				}, {
					//Add requester to user's followers
					Put: {
						TableName: process.env['Following'],
            Item: AttributeValue.wrap(following1),
					}
				}, {
					//Add user to requesters following
					Put: {
						TableName: process.env['Following'],
            Item: AttributeValue.wrap(following2),
					}
        }, {
          Update: {
            TableName: process.env["User"],
            Key: AttributeValue.wrap(userKey1),
            UpdateExpression: "SET followers = if_not_exists(followers, :default) + :incr, following = if_not_exists(following, :default) + :incr",
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": 1,
              ":default": 0
            }),
          }
        }, {
          Update: {
            TableName: process.env["User"],
            Key: AttributeValue.wrap(userKey2),
            UpdateExpression: "SET followers = if_not_exists(followers, :default) + :incr, following = if_not_exists(following, :default) + :incr",
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": 1,
              ":default": 0
            }),
          }
        }
			]
    };

    await dynamoDBRequest(operation, operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Follow Request Does Not Exist");
      throw error;
    })

    //Get username and deviceId
    const userKey: UserKey = {
      userID: username
    }
    const getUser = {
      TableName: process.env['User'],
      Key: AttributeValue.wrap(userKey)
    };
    const [_user, userCognito] = await Promise.all([
      dynamoDBRequest("GetItem", getUser),
      cognitoRequest(	
        "AdminGetUser", {
          Username: body.requesterID,
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
      deliverNotification(user?.endpointArn, `@${preferred_username} accepted your follow request.`)

    // Logic can be handled after response
    fetch(`${url}/api/friend/addFriendPosts`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY || ""
      },
      body: JSON.stringify({
        userID: username,
        requesterID: body.requesterID
      })
    });
    fetch(`${url}/api/friend/addFriendPosts`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY || ""
      },
      body: JSON.stringify({
        userID: body.requesterID,
        requesterID: username
      })
    });
    
    return responder.success({
      result: "Friend Request Accepted",
    });
  } catch (error) {
    return responder.error(error);
  }
}
