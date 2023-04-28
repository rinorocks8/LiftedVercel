import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Following, FriendRequestKey } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";

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

    const body = requestBodySchema.parse(await req.json());

    const accepted_at = new Date().toISOString();

    const friendRequest: FriendRequestKey = {
      userID: body.requesterID,
      requestingUserID: username,
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
            Key: convertToDynamoDBItem(friendRequest),
						ConditionExpression: 'attribute_exists(userID) and attribute_exists(requestingUserID)'
					}
				}, {
					//Add requester to user's followers
					Put: {
						TableName: process.env['Following'],
            Item: convertToDynamoDBItem(following1),
					}
				}, {
					//Add user to requesters following
					Put: {
						TableName: process.env['Following'],
            Item: convertToDynamoDBItem(following2),
					}
				}
			]
    };

    await dynamoDBRequest(operation, operation_body).catch(error => {
      if (RegExp(/\[ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Follow Request Does Not Exist");
      throw error;
    })
    
    return responder.success({
      result: "Friend Request Accepted",
    });
  } catch (error) {
    return responder.error(error);
  }
}
