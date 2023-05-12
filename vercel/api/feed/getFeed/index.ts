import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { Feed, FollowingKey, LikeKey, Workout, WorkoutKey } from '../../graphql'
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
    
    let results = await dynamoDBRequest("Query", getFeedParams);
    if (results.Items.length === 0) {
      return responder.success({
        workouts: [],
      });
    }

    const workouts = await Promise.all(
      results.Items.map(
        async (_feed) => {
          const feed: Feed = AttributeValue.unwrap(_feed);

          const likeKey: LikeKey = {
            workoutID: feed.workoutID,
            userID: username,
          }
          const workoutKey: WorkoutKey = {
            workoutID: feed.workoutID,
          }
          const followingKey: FollowingKey = {
            userID: username,
            followingUserID: feed.workoutUserID,
          };

          //Parallelize this?
          const getParams = {
            RequestItems: {
              [process.env['Like'] || ""]: {
                Keys: [
                  AttributeValue.wrap(likeKey)
                ]
              },
              [process.env['Following'] || ""]: {
                Keys: [
                  AttributeValue.wrap(followingKey)
                ]
              },
              [process.env['Workout'] || ""]: {
                Keys: [
                  AttributeValue.wrap(workoutKey),
                ]
              },
            },
          };
      
          //TODO Parallelize this?
          let requests = await dynamoDBRequest("BatchGetItem", getParams);
          const user = await cognitoRequest(	
            "AdminGetUser", {
              Username: feed.workoutUserID,
              UserPoolId: process.env.userPoolID
          });

          const liked: boolean = requests.Responses[process.env['Like'] || ""].length > 0;
          const following: boolean = requests.Responses[process.env['Following'] || ""].length > 0 || username === feed.workoutUserID;

          const workout: Workout = requests.Responses[process.env['Workout'] || ""].length > 0 ? AttributeValue.unwrap(requests.Responses[process.env['Workout'] || ""][0]) : {workoutID: feed.workoutID, deleted: true}
    
          return {
            id: workout.workoutID,
            userID: workout.userID,
            username: user?.UserAttributes?.find(
              (obj) => obj.Name === "preferred_username"
            )?.Value,
            createdAt: feed.createdAt,
            likes: workout.likes ?? 0,
            liked: liked,
            caption: workout.caption ?? "",
            postLocation: workout.postLocation ?? "",
            workout: workout.workout,
            visible: workout.visible ?? undefined,
            deleted: workout.deleted ?? undefined,
            following: following
          };
        }
      )
    );

    const visibleWorkouts = workouts.filter(workout => workout.visible !== false && workout.deleted !== true && workout.following !== false);

    return responder.success({
      workouts: visibleWorkouts,
    });
  } catch (error) {
    return responder.error(error);
  }
}