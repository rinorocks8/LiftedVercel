import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import * as responder from "../../utils/responder";
import { BodyError } from "../../utils/errors";
import { FriendRequestKey } from "../../graphql";
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

    const friendRequestKey: FriendRequestKey = {
      userID: username,
      requestingUserID: body.requesterID,
    };

    const operation = "DeleteItem";
    const operation_body = {
      TableName: process.env['FriendRequest'],
      Key: convertToDynamoDBItem(friendRequestKey),
      ConditionExpression: "attribute_exists(userID) and attribute_exists(requestingUserID)",
    };

    await dynamoDBRequest(operation, operation_body).catch((error) => {
      if (RegExp(/The conditional request failed/gi).test(error.message))
        throw new BodyError("Friend Request Not Found");
      throw error;
    });

    return responder.success({
      result: "Friend Request Rejected",
    });
  } catch (error) {
    return responder.error(error);
  }
}
