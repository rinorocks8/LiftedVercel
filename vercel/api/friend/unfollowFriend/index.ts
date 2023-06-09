import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import { BodyError } from "../../utils/errors";
import * as responder from '../../utils/responder';

import { FollowingKey, UserKey } from '../../graphql'
import { AttributeValue } from 'dynamodb-data-types';

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  unfollowingID: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    const following1: FollowingKey = {
      userID: username,
      followingUserID: body.unfollowingID,
    };

    const following2: FollowingKey = {
      userID: body.unfollowingID,
      followingUserID: username,
    };

    const userKey1: UserKey = {
      userID: body.unfollowingID,
    };

    const userKey2: UserKey = {
      userID: username,
    };

    const operation = "TransactWriteItems";
    const operation_body = {
      TransactItems: [
				{
					Delete: {
						TableName: process.env['Following'],
            Key: AttributeValue.wrap(following1),
						ConditionExpression: 'attribute_exists(userID) and attribute_exists(followingUserID)'
					}
        },
        {
					Delete: {
						TableName: process.env['Following'],
            Key: AttributeValue.wrap(following2),
						ConditionExpression: 'attribute_exists(userID) and attribute_exists(followingUserID)'
					}
        }, {
          Update: {
            TableName: process.env["User"],
            Key: AttributeValue.wrap(userKey1),
            UpdateExpression: "SET followers = if_not_exists(followers, :default) + :incr, following = if_not_exists(following, :default) + :incr",
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": -1,
              ":default": 0
            }),
          }
        }, {
          Update: {
            TableName: process.env["User"],
            Key: AttributeValue.wrap(userKey2),
            UpdateExpression: "SET followers = if_not_exists(followers, :default) + :incr, following = if_not_exists(following, :default) + :incr",
            ExpressionAttributeValues: AttributeValue.wrap({
              ":incr": -1,
              ":default": 0
            }),
          }
        }
			]
    };

    await dynamoDBRequest(operation, operation_body).catch(error => {
      if (RegExp(/ConditionalCheckFailed,/gi).test(error.message))
        throw new BodyError("Not Following This User");
      throw error;
    })
    
    return responder.success({
      result: "Unfollowed User",
    });
  } catch (error) {
    return responder.error(error);
  }
}
