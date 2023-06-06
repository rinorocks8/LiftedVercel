import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import * as responder from '../../utils/responder';

import { FriendRequest, User, UserKey } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';
import { BodyError, ParameterError } from "../../utils/errors";
import { cognitoRequest } from "../../utils/cognitoRequest";
import { deliverNotification } from "../../utils/deliverNotification";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  requestingID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    if (username === body.requestingID) {
      throw new BodyError("Cannot Friend Request Yourself.")
    }

    const requested_at = new Date().toISOString();

    const friendRequest: FriendRequest = {
      userID: body.requestingID,
      requestingUserID: username,
      requestedAt: requested_at
    };

    const operation = "PutItem";
    const operation_body = {
      TableName: process.env['FriendRequest'],
      Item: AttributeValue.wrap(friendRequest),
    };

    await dynamoDBRequest(operation, operation_body);

    //Get username and deviceId
    const userKey: UserKey = {
      userID: body.requestingID
    }
    const getUser = {
      TableName: process.env['User'],
      Key: AttributeValue.wrap(userKey)
    };
    const [_user, userCognito] = await Promise.all([
      dynamoDBRequest("GetItem", getUser),
      cognitoRequest(	
        "AdminGetUser", {
          Username: username,
          UserPoolId: process.env.userPoolID,
        }).catch((error) => {
          if (error.message === "User does not exist.")
            throw new ParameterError("User Not Found");
        })
    ])
    const preferred_username = userCognito.UserAttributes?.find(
      (obj) => obj.Name === "preferred_username"
    )?.Value;
    const user: User = AttributeValue.unwrap(_user.Item)
    if (user?.endpointArn)
      deliverNotification(user?.endpointArn, `@${preferred_username} requested to follow you.`)
    
    return responder.success({
      result: "Friend Requested",
    });
  } catch (error) {
    return responder.error(error);
  }
}
