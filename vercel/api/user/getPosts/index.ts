import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import * as responder from '../../utils/responder';
import { z } from "zod";

import { LikeKey, Post, WorkoutKey } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";
import { cognitoRequest } from "../../utils/cognitoRequest";
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
      TableName: process.env['Post'],
      IndexName: "PostByUserIDCreatedAt",
      KeyConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey": body.userID,
      }),
    };
    
    let posts = await dynamoDBRequest("Query", getFeedParams);
    if (posts.Items.length === 0) {
      return responder.success({
        posts: [],
      });
    }

    posts = await Promise.all(
      posts.Items.map(
        async (_post) => {
          const post: Post = AttributeValue.unwrap(_post);

          const like: LikeKey = {
            postID: post.postID,
            userID: username,
          }
          const workout: WorkoutKey = {
            workoutID: post.workoutID,
          }
          const getParams = {
            RequestItems: {
              [process.env['Like'] || ""]: {
                Keys: [
                  AttributeValue.wrap(like)
                ]
              },
              [process.env['Workout'] || ""]: {
                Keys: [
                  AttributeValue.wrap(workout),
                ]
              },
            },
          };
      
          let requests = await dynamoDBRequest("BatchGetItem", getParams);

          let liked: boolean = false;
          if (requests.Responses[process.env['Like'] || ""].length > 0) {
            liked = true;
          }
          
          const user = await cognitoRequest(	
              "AdminGetUser", {
                Username: post.userID,
                UserPoolId: process.env.userPoolID
            });
    
          return {
            id: post.postID,
            userID: post.userID,
            username: user?.UserAttributes?.find(
              (obj) => obj.Name === "preferred_username"
            )?.Value,
            createdAt: post.createdAt,
            likes: post.likes,
            liked: liked,
            workout: requests.Responses[process.env['Workout'] || ""].length > 0 ? AttributeValue.unwrap(requests.Responses[process.env['Workout'] || ""][0]) : {workoutID: post.workoutID}
          };
        }
      )
    );
    
    return responder.success({
      posts: posts,
    });
  } catch (error) {
    return responder.error(error);
  }
}

function isEmpty(obj: object): boolean {
  for (const _ in obj) return false;
  return true;
}