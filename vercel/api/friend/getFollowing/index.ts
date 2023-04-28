import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { cognitoRequest } from "../../utils/cognitoRequest";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  userID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const params = {
      TableName: process.env['Following'],
      IndexName: "FollowingByUserIDAcceptedAt",
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: {
        ":hkey": {
          "S": body.userID,
        }
      },
    };

    const results = await dynamoDBRequest("Query", params);
    const following = await Promise.all(
      results.Items?.map(async ({ followingUserID }) => {
        const user = await cognitoRequest(	
          "AdminGetUser", {
            Username: followingUserID.S,
            UserPoolId: process.env.userPoolID
        });
        
        return {
          userID: followingUserID.S,
          preferred_username: user?.UserAttributes?.find(
            (obj) => obj.Name === "preferred_username"
          )?.Value || followingUserID.S,
        };
      })
    );

    return responder.success({
      following: following,
    });
  } catch (error) {
    return responder.error(error.message ? error.message : error);
  }
}