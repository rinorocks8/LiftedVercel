import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Feed, LikeKey, Post, Workout, WorkoutKey } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";
import { cognitoRequest } from "../../utils/cognitoRequest";
import { AttributeValue } from 'dynamodb-data-types';

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
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey":  username
      }),
    };
    
    const results = await dynamoDBRequest("Query", getFeedParams);
    if (results.Items.length === 0) {
      return responder.success({
        posts: [],
      });
    }

    const getPostsParams = {
      RequestItems: {
        [process.env['Post'] || ""]: {
          Keys: results.Items.map((feed: Feed) => ({
            "postID": feed.postID
          })),
        },
      },
    };

    let posts = await dynamoDBRequest("BatchGetItem", getPostsParams);
    if (posts.Responses[process.env['Post'] || ""].length === 0) {
      return responder.success({
        posts: [],
      });
    }
    
    posts = await Promise.all(
      posts.Responses[process.env['Post'] || ""].map(
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