import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Following, FriendRequestKey } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';

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
				}
			]
    };

    await dynamoDBRequest(operation, operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Follow Request Does Not Exist");
      throw error;
    })

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
