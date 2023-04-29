import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import * as responder from '../../utils/responder';
import { z } from "zod";

import { LikeKey } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";
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

    const getFeedParams = {
      TableName: process.env['Workout'],
      IndexName: "WorkoutByUserIDCreatedAt",
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: {
        ":hkey": {
          "S": body.userID,
        }
      },
    };
    
    let workouts = await dynamoDBRequest("Query", getFeedParams);
    if (workouts.Items.length === 0) {
      return responder.success({
        workouts: [],
      });
    }
    
    workouts = await Promise.all(
      workouts.Items.map(
        async ({ userID, workoutID, createdAt, name, exercises, likes }) => {

          const like: LikeKey = {
            workoutID: workoutID.S,
            userID: username,
          }

          const operation = "GetItem";
          const operation_body = {
            TableName: process.env['Like'],
            Key: convertToDynamoDBItem(like),
          };
          const result = await dynamoDBRequest(operation, operation_body);

          let liked: boolean = false;
          if (!isEmpty(result)) {
            liked = true;
          }
          
          const user = await cognitoRequest(	
              "AdminGetUser", {
                Username: userID.S,
                UserPoolId: process.env.userPoolID
            });
    
          return {
            id: workoutID?.S,
            userID: userID.S,
            username: user?.UserAttributes?.find(
              (obj) => obj.Name === "preferred_username"
            )?.Value,
            name: name?.S,
            createdAt: createdAt.S,
            exercises: JSON.parse(exercises.S),
            likes: likes.N,
            liked: liked,
          };
        }
      )
    );
    
    return responder.success({
      workouts: workouts,
    });
  } catch (error) {
    return responder.error(error);
  }
}

function isEmpty(obj: object): boolean {
  for (const _ in obj) return false;
  return true;
}