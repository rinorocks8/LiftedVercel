import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Feed, Workout, WorkoutKey } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  name: z.string().min(1),
  exercises: z.array(
    z.array(
      z.object({
        id: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
        variationID: z.string(),
        sets: z.array(
            z.object({
              id: z.string(),
              reps: z.number(),
              weight: z.number(),
              updatedTime: z.number(),
              maxEq: z.number(),
            })
          )
      })
    )
  ),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    if (body.exercises.flat().length > 98) {
      throw new BodyError("Too Many Exercises");
    }

    const checkWorkout: WorkoutKey = {
      userID: username,
      workoutID: body.id
    };

    const check_operation = "GetItem";
    const check_operation_body = {
      TableName: process.env['Workout'],
      Key: convertToDynamoDBItem(checkWorkout),
    };

    let likes: number = 0;
    const check_result = await dynamoDBRequest(check_operation, check_operation_body);
    if (!isEmpty(check_result)) {
      likes = check_result.Item.likes.N
    }

    const workout: Workout = {
      createdAt: body.createdAt,
      exercises: JSON.stringify(body.exercises),
      likes: likes,
      name: body.name,
      userID: username,
      workoutID: body.id
    };

    const transactItems = [
      {
        Put: {
          TableName: process.env["Workout"],
          Item: convertToDynamoDBItem(workout),
        },
      },
    ];
    
    const getFriendsParams = {
      TableName: process.env['Following'],
      IndexName: "FollowingByFollowingUserIDAcceptedAt",
      KeyConditionExpression: "followingUserID = :hkey",
      ExpressionAttributeValues: {
        ":hkey": {
          "S": username,
        }
      },
    };
    const results = await dynamoDBRequest("Query", getFriendsParams);
    const followerIDs = results.Items.map(item => item.userID.S);
    followerIDs.push(username);

    for (const followerID of followerIDs) {
      const post: Feed = {
        createdAt: body.createdAt,
        userID: followerID,
        workoutID: body.id,
        workoutUserID: username
      }

      transactItems.push({
        Put: {
          TableName: process.env["Feed"],
          Item: convertToDynamoDBItem(post),
        },
      });
    }

    const operation_body = {
      TransactItems: transactItems,
    };    

    await dynamoDBRequest("TransactWriteItems", operation_body)
    
    return responder.success({
      result: "Posted Workout",
    });
  } catch (error) {
    return responder.error(error);
  }
}

    
function isEmpty(obj: object): boolean {
  for (const _ in obj) return false;
  return true;
}