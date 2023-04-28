import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import * as responder from '../../utils/responder';

import { FriendRequest } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  requestingID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const requested_at = new Date().toISOString();

    const friendRequest: FriendRequest = {
      userID: username,
      requestingUserID: body.requestingID,
      requestedAt: requested_at
    };

    const operation = "PutItem";
    const operation_body = {
      TableName: process.env['FriendRequest'],
      Item: convertToDynamoDBItem(friendRequest),
    };

    await dynamoDBRequest(operation, operation_body);
    
    return responder.success({
      result: "Friend Requested",
    });
  } catch (error) {
    return responder.error(error);
  }
}
