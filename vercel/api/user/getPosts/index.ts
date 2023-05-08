import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import * as responder from '../../utils/responder';
import { LikeKey, Workout } from '../../graphql'
import { cognitoRequest } from "../../utils/cognitoRequest";

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';

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
      IndexName: "WorkoutByUserIDStartTime",
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey": body.userID,
      }),
    };
    
    let results = await dynamoDBRequest("Query", getFeedParams);
    if (results.Items.length === 0) {
      return responder.success({
        workouts: [],
      });
    }

    const workouts = await Promise.all(
      results.Items.map(
        async (_workout) => {
          const workout: Workout = AttributeValue.unwrap(_workout);

          const likeKey: LikeKey = {
            workoutID: workout.workoutID,
            userID: username,
          }
          //Parallelize this?
          const getParams = {
            RequestItems: {
              [process.env['Like'] || ""]: {
                Keys: [
                  AttributeValue.wrap(likeKey)
                ]
              },
            },
          };
      
          //TODO Parallelize this?
          let requests = await dynamoDBRequest("BatchGetItem", getParams);
          const user = await cognitoRequest(	
            "AdminGetUser", {
              Username: workout.userID,
              UserPoolId: process.env.userPoolID
          });

          let liked: boolean = false;
          if (requests.Responses[process.env['Like'] || ""].length > 0) {
            liked = true;
          }
    
          return {
            id: workout.workoutID,
            userID: workout.userID,
            username: user?.UserAttributes?.find(
              (obj) => obj.Name === "preferred_username"
            )?.Value,
            createdAt: workout.startTime,
            likes: workout.likes,
            liked: liked,
            workout: workout.workout
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