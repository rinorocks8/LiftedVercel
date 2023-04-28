import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { WorkoutKey } from '../../graphql'
import { convertToDynamoDBItem } from "../../utils/convertToDynamoDBItem";

export const config = {
  runtime: "experimental-edge",
};

const API_KEY = process.env.API_KEY;

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
      userID: username,
      workoutID: body.workoutID,
    }
    
    const params = {
      TableName: process.env["Workout"],
      Key: convertToDynamoDBItem(workout),
      ReturnValues: "ALL_OLD",
    };
    
    const data = await dynamoDBRequest("DeleteItem", params).catch(error => {
      throw error;
    });
    
    if (isEmpty(data)) throw new BodyError("Workout Not Found");

    // Logic can be handled after response
    fetch('http://localhost:3000/api/feed/clearLikes', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ workoutID: body.workoutID})
    });
    
    return responder.success({
      result: "Deleted Workout",
    });
  } catch (error) {
    return responder.error(error);
  }
}
    
function isEmpty(obj: object): boolean {
  for (const _ in obj) return false;
  return true;
}