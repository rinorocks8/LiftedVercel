import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { AuthenticationError, BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { WorkoutKey } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';


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

    const workout: WorkoutKey = {
      workoutID: body.workoutID
    }
    
    const params = {
      TableName: process.env["Workout"],
      Key: AttributeValue.wrap(workout),
      UpdateExpression: "SET visible = :visible",
      ConditionExpression: "attribute_exists(workoutID) AND userID = :userID",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":visible": false,
        ":userID": username
      }),
    };
    
    const data = await dynamoDBRequest("UpdateItem", params).catch(error => {
      if (RegExp(/The conditional request failed/gi).test(error.message))
        throw new AuthenticationError("Cannot Delete Another Users Workout");
      throw error;
    })

    // // Logic can be handled after response
    // fetch('http://localhost:3000/api/feed/clearLikes', {
    //   method: 'POST',
    //   headers: {
    //     'x-api-key': API_KEY || ""
    //   },
    //   body: JSON.stringify({ postID: body.postID})
    // });
    
    return responder.success({
      result: "Deleted Post",
    });
  } catch (error) {
    return responder.error(error);
  }
}
    
function isEmpty(obj: object): boolean {
  for (const _ in obj) return false;
  return true;
}