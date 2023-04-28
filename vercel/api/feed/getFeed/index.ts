import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Feed, Workout } from '../../graphql'
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
          // const getLiked = {
          //   TableName: process.env['Like'],
          //   KeyConditionExpression: "workoutID = :hkey and userID = :skey",
          //   ExpressionAttributeValues: {
          //     ":hkey": {
          //       "S": workoutID,
          //     },
          //     ":skey": {
          //       "S": username,
          //     },
          //   },
          // };
          // const likeResults = await dynamoDBRequest("Query", getLiked);
          // const liked = likeResults.Items.length === 1;
          
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
            liked: false,
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