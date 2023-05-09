import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import * as responder from '../../utils/responder';
import { Feed, Workout, WorkoutKey } from '../../graphql'

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
    
    const queryFriendsParams = {
      TableName: process.env['Following'],
      IndexName: "FollowingByFollowingUserIDAcceptedAt",
      KeyConditionExpression: "followingUserID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey":  username,
      }),
    };



    const results = await dynamoDBRequest("Query", queryFriendsParams);

    const followerIDs = results.Items.map(item => item.userID.S);
    followerIDs.push(username);

    const writeItems: any[] = [];
    for (const followerID of followerIDs) {
      const post: Feed = {
        userID: followerID,
        createdAt: Date.now(),
        workoutID: body.workoutID,
        workoutUserID: username
      }

      writeItems.push({
        PutRequest: {
          Item: AttributeValue.wrap(post)
        },
      });
    }

    const batches: any[][] = [];
    while(writeItems.length) {
      batches.push(writeItems.splice(0, 25));
    }

    let promises = batches.map(batch => {
      const operation_body = {
        RequestItems: {
          [process.env["Feed"] ?? ""]: batch
        }
      };
      return dynamoDBRequest("BatchWriteItem", operation_body);
    });

    const workoutKey: WorkoutKey = {
      workoutID: body.workoutID
    };
    
    const params = {
      TableName: process.env["Workout"],
      Key: AttributeValue.wrap(workoutKey),
      UpdateExpression: "SET visible = :visible",
      ConditionExpression: "attribute_exists(workoutID) AND userID = :userID",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":visible": true,
        ":userID": username
      }),
    };
    promises.push(dynamoDBRequest("UpdateItem", params))

    await Promise.all(promises);
    
    return responder.success({
      result: "Posted"
    });
  } catch (error) {
    return responder.error(error);
  }
}