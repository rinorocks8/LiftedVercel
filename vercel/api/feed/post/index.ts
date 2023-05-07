import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import * as responder from '../../utils/responder';
import { Feed, Post } from '../../graphql'

import { AttributeValue } from 'dynamodb-data-types';
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  workoutID: z.string().min(1),
  createdAt: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const postID = uuidv4();
    const post: Post = {
      postID: postID,
      userID: username,
      workoutID: body.workoutID,
      createdAt: body.createdAt,
      likes: 0
    };

    const transactItems = [
      {
        Put: {
          TableName: process.env["Post"],
          Item: AttributeValue.wrap(post),
        },
      },
    ];
    
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

    for (const followerID of followerIDs) {
      const post: Feed = {
        userID: followerID,
        createdAt: body.createdAt,
        postID: postID,
        postUserID: username
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

    await dynamoDBRequest("TransactWriteItems", operation_body)
    
    return responder.success({
      result: "Posted",
      postID: postID,
    });
  } catch (error) {
    return responder.error(error);
  }
}