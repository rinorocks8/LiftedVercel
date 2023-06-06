import { VercelRequest, VercelResponse } from '@vercel/node';
import * as responder from "../../utils/responder";
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { UserKey } from "../../graphql";

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import parseSchema from "../../utils/parseSchema";

import { DynamoDB, SNS } from 'aws-sdk';
import { UpdateItemInput } from 'aws-sdk/clients/dynamodb';

const requestBodySchema = z.object({
  deviceToken: z.string(),
});

var sns = new SNS();
const dynamodb = new DynamoDB();

// Resolves crypto for non edge function
const crypto = require('crypto').webcrypto;
global.crypto = crypto;

const fetch = require('node-fetch');
global.fetch = fetch;

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const token = req.headers?.authorization?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = parseSchema(requestBodySchema, req.body);

    const platformParams = {
      PlatformApplicationArn: 'arn:aws:sns:us-east-1:486009190107:app/APNS/LiftedIOS',
      Token: body.deviceToken,
    };

    const snsData = await sns.createPlatformEndpoint(platformParams).promise();
    const userKey: UserKey = {
      userID: username
    };
    const updateUser: UpdateItemInput = {
      TableName: process.env['User'] || "",
      Key: AttributeValue.wrap(userKey),
      UpdateExpression: "SET deviceToken = :deviceToken, endpointArn = :endpointArn",
      ExpressionAttributeValues: AttributeValue.wrap({
        ":deviceToken": body.deviceToken ?? "",
        ":endpointArn": snsData.EndpointArn ?? "",
      }),
    };
    await dynamodb.updateItem(updateUser).promise()

    return res.status(200).send("Success");
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}