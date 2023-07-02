import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError, ParameterError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { cognitoRequest } from "../../utils/cognitoRequest";
import { moderationRequest } from "../../utils/moderationRequest";
import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { UserKey } from "../../graphql";
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  newUsername: z.string().optional(),
  name: z.string().optional(),
  bio: z.string().optional(),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const UserAttributes: { Name: string; Value: string; }[] = []

    if (body.newUsername) {
      if (body.newUsername.length < 6)
        throw new BodyError("Username must be at least 6 characters.");
      if (body.newUsername.length > 24)
        throw new BodyError("Username cannot be over 24 characters.");
      if (!body.newUsername.match(
            "^([a-zA-Z](([a-zA-Z0-9]*[a-zA-Z0-9_.])|([a-zA-Z0-9_.][a-zA-Z0-9]*))*[a-zA-Z]{1,})$"
          ))
        throw new BodyError("Username can only contain alphanumeric characters, underscores and dots. Underscores and dots cannot be at the start or end of the username. Underscores and dots cannot be next to each other or used multiple times in a row.");
      
      const isUsernameFlagged = await moderationRequest(body.newUsername);
      if (isUsernameFlagged)
        throw new BodyError("Inappropriate Username Detected");
      
      UserAttributes.push({
        "Name": "preferred_username",
        "Value": body.newUsername,
      })
    }

    if (body.name) {
      const isNameFlagged = await moderationRequest(body.name);
      if (isNameFlagged)
        throw new BodyError("Inappropriate Name Detected");

      UserAttributes.push({
        "Name": "name",
        "Value": body.name,
      })
    }

    if (body.bio) {
      const isBioFlagged = await moderationRequest(body.bio);
      if (isBioFlagged)
        throw new BodyError("Inappropriate Bio Detected");

      UserAttributes.push({
        "Name": "custom:bio",
        "Value": body.bio,
      })
    }

    if (UserAttributes.length === 0)
      throw new BodyError("No Changes");

    await cognitoRequest(
      "AdminUpdateUserAttributes", {
      UserAttributes: UserAttributes,
      Username: username,
      UserPoolId: process.env.userPoolID
    }).catch((error) => {
      if (error.message === "User does not exist.")
        throw new ParameterError("User Not Found");
    });

    const user = await cognitoRequest(	
      "AdminGetUser", {
        Username: username,
        UserPoolId: process.env.userPoolID,
      })
    
    const userKey: UserKey = {
      userID: username
    }
    
    const params = {
      TableName: process.env["User"],
      Key: AttributeValue.wrap(userKey),
      UpdateExpression: "SET #name = :new_name, lastUpdated = :lastUpdated, bio = :bio, username = :username",
      ExpressionAttributeNames: {
        "#name": "name"
      },
      ExpressionAttributeValues: AttributeValue.wrap({
        ":new_name": user.UserAttributes?.find(
          (obj) => obj.Name === "name"
        )?.Value ?? "",
        ":bio": user.UserAttributes?.find(
          (obj) => obj.Name === "custom:bio"
        )?.Value ?? "",
        ":username": user.UserAttributes?.find(
          (obj) => obj.Name === "preferred_username"
        )?.Value,
        ":lastUpdated": Date.now()
      }),
    };
    await dynamoDBRequest("UpdateItem", params)
    
    return responder.success({
      result: "Success",
    });
  } catch (error) {
    return responder.error(error);
  }
}
