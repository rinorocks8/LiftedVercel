import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Feed, LikeKey, Workout } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";
import { cognitoRequest } from "../../utils/cognitoRequest";

export const config = {
  runtime: "experimental-edge",
};

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const getFeedParams = {
      TableName: process.env['Feed'],
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: {
        ":hkey": {
          "S": username,
        }
      },
    };
    
    const results = await dynamoDBRequest("Query", getFeedParams);
    if (results.Items.length === 0) {
      return responder.success({
        workouts: [],
      });
    }
    
    const getWorkoutsParams = {
      RequestItems: {
        [process.env['Workout'] || ""]: {
          Keys: results.Items.map(({ userID, createdAt, workoutID, workoutUserID }) => {
            return {
              "userID": workoutUserID,
              "workoutID": workoutID
            };
          }),
        },
      },
    };
    
    let workouts = await dynamoDBRequest("BatchGetItem", getWorkoutsParams);
    if (workouts.Responses[process.env['Workout'] || ""].length === 0) {
      return responder.success({
        workouts: [],
      });
    }
    
    workouts = await Promise.all(
      workouts.Responses[process.env['Workout'] || ""].map(
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