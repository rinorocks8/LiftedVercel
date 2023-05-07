import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { AuthenticationError, BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { PostKey } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';


export const config = {
  runtime: "experimental-edge",
};

const API_KEY = process.env.API_KEY;

const requestBodySchema = z.object({
  postID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = requestBodySchema.parse(await req.json());

    const post: PostKey = {
      postID: body.postID
    }
    
    const params = {
      TableName: process.env["Post"],
      Key: AttributeValue.wrap(post),
      ReturnValues: "ALL_OLD",
      ConditionExpression: "userID = :hkey",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":hkey":  username
      }),
    };
    
    const data = await dynamoDBRequest("DeleteItem", params).catch(error => {
      if (RegExp(/The conditional request failed/gi).test(error.message))
        throw new AuthenticationError("Cannot Delete Another Users Workout");
      throw error;
    })


    if (isEmpty(data)) throw new BodyError("Post Not Found");

    // Logic can be handled after response
    fetch('http://localhost:3000/api/feed/clearLikes', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY || ""
      },
      body: JSON.stringify({ postID: body.postID})
    });
    
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