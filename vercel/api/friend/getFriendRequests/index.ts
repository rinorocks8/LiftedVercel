import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { cognitoRequest } from "../../utils/cognitoRequest";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const params = {
      TableName: process.env['FriendRequest'],
      IndexName: "FriendRequestByUserIDRequestedAt",
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: {
        ":hkey": {
          "S": username
        },
      },
    };

    const results = await dynamoDBRequest("Query", params);
    const requests = await Promise.all(
      results.Items?.map(async ({ requestingUserID }) => {
        const user = await cognitoRequest(	
          "AdminGetUser", {
            Username: requestingUserID.S,
            UserPoolId: process.env.userPoolID
          });

        return {
          userID: requestingUserID.S,
          preferred_username: user?.UserAttributes?.find(
            (obj) => obj.Name === "preferred_username"
          )?.Value || requestingUserID.S,
        };
      })
    );

    return responder.success({
      requests: requests,
    });
  } catch (error) {
    return responder.error(error.message ? error.message : error);
  }
}
