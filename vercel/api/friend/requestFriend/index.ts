import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import * as responder from '../../utils/responder';

import { FriendRequest } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';
import { BodyError } from "../../utils/errors";

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

    if (username === body.requestingID) {
      throw new BodyError("Cannot Friend Request Yourself.")
    }

    const requested_at = new Date().toISOString();

    const friendRequest: FriendRequest = {
      userID: body.requestingID,
      requestingUserID: username,
      requestedAt: requested_at
    };

    const operation = "PutItem";
    const operation_body = {
      TableName: process.env['FriendRequest'],
      Item: AttributeValue.wrap(friendRequest),
    };

    await dynamoDBRequest(operation, operation_body);
    
    return responder.success({
      result: "Friend Requested",
    });
  } catch (error) {
    return responder.error(error);
  }
}
