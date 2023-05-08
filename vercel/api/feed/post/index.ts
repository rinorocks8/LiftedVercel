import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import * as responder from '../../utils/responder';
import { Feed } from '../../graphql'

import { AttributeValue } from 'dynamodb-data-types';
import { z } from "zod";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());
    
    const getFriendsParams = {
      TableName: process.env['Following'],
      IndexName: "FollowingByFollowingUserIDAcceptedAt",
      KeyConditionExpression: "followingUserID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey":  username,
      }),
    };
    const results = await dynamoDBRequest("Query", getFriendsParams);
    const followerIDs = results.Items.map(item => item.userID.S);
    followerIDs.push(username);

    const transactItems: any = [];

    for (const followerID of followerIDs) {
      const post: Feed = {
        userID: followerID,
        createdAt: Date.now(),
        workoutID: body.workoutID,
        workoutUserID: username
      }

      transactItems.push({
        Put: {
          TableName: process.env["Feed"],
          Item: AttributeValue.wrap(post)
        },
      });
    }

    const operation_body = {
      TransactItems: transactItems,
    };    

    console.log(transactItems)
    await dynamoDBRequest("TransactWriteItems", operation_body)
    
    return responder.success({
      result: "Posted"
    });
  } catch (error) {
    return responder.error(error);
  }
}