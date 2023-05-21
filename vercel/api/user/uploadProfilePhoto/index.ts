import { VercelRequest, VercelResponse } from '@vercel/node';
import { S3, Rekognition, DynamoDB } from 'aws-sdk';
import sharp from 'sharp';
import formidable from "formidable";
import * as fs from "fs"
import { verifyCognitoToken } from '../../utils/verifyCognitoToken';
import { UserKey } from '../../graphql';
import { AttributeValue } from 'dynamodb-data-types';
import { UpdateItemInput } from 'aws-sdk/clients/dynamodb';

const s3 = new S3();
const rekognition = new Rekognition();
const dynamodb = new DynamoDB();

// Resolves crypto for non edge function
const crypto = require('crypto').webcrypto;
global.crypto = crypto;

const fetch = require('node-fetch');
global.fetch = fetch;

export const config = {
  api: {
    bodyParser: false,
  },
}

const srcToFile = (src: string) => fs.readFileSync(src);
const allowedFileTypes = ['image/jpeg', 'image/png'];

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const token = req.headers?.authorization?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    
    const form = formidable({ multiples: true });
    form.parse(req, async (err, fields, files) => {
      const imageBuffer = srcToFile(files.image.filepath)
      const imageType = files.image.mimetype

      if (imageBuffer === undefined) {
        throw new Error("Image Upload Failed")
      }
      if (!allowedFileTypes.includes(imageType)) {
        throw new Error("File Type Not Accepted.")
      }

      const moderationLabels = await detectExplicitContent(imageBuffer);
      const excludedLabels = [
        'Female Swimwear Or Underwear',
        'Male Swimwear Or Underwear',
        'Barechested Male',
        'Revealing Clothes',
        'Explosions And Blasts',
      ];

      // Filter out excluded labels
      const filteredLabels = moderationLabels.filter(
        (label) => !excludedLabels.includes(label.Name ?? "") && label.ParentName !== ''
      );
      console.log(filteredLabels)

      if (filteredLabels.length > 0) {
        return res.status(400).json({ error: 'Image contains explicit content.' });
      }

      const thumbnails = await generateThumbnails(imageBuffer);
      const uploadPromises = thumbnails.map((thumbnail) =>
        uploadImageToS3(username, thumbnail.buffer, thumbnail.name, imageType)
      );

      const versionIds = await Promise.all(uploadPromises);

      const userKey: UserKey = {
        userID: username
      };
      const updateUser: UpdateItemInput = {
        TableName: process.env['User'] || "",
        Key: AttributeValue.wrap(userKey),
        UpdateExpression: "SET profile_small = :profile_small, profile_medium = :profile_medium, profile_large = :profile_large",
        ExpressionAttributeValues: AttributeValue.wrap({
          ":profile_small": versionIds[0],
          ":profile_medium":  versionIds[1],
          ":profile_large":  versionIds[2],
        }),
      };
      await dynamodb.updateItem(updateUser).promise()

      return res.status(200).send("Success");
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function detectExplicitContent(imageBuffer: Buffer) {
  const params = {
    Image: {
      Bytes: imageBuffer,
    },
    MinConfidence: 75,
  };

  const moderationLabels = await rekognition.detectModerationLabels(params).promise();

  return moderationLabels.ModerationLabels || [];
}

async function generateThumbnails(imageBuffer: Buffer) {
  const sizes = [
    { name: 'small', width: 100, height: 100 },
    { name: 'medium', width: 300, height: 300 },
    { name: 'large', width: 600, height: 600 },
  ];

  const promises = sizes.map(async (size) => {
    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(size.width, size.height)
      .toBuffer();
    return { name: size.name, buffer: resizedImageBuffer };
  });

  return Promise.all(promises);
}

async function uploadImageToS3(username: string, imageBuffer: Buffer, size: string, imageType: string) {
  const key = `${username}/${username}_${size}.jpg`;

  const response = await s3
    .upload({
      Bucket: 'liftedprofiles',
      Key: key,
      Body: imageBuffer,
      ACL: 'public-read',
      ContentType: imageType,
      ContentDisposition: `inline`,
      ContentEncoding: 'base64',
    })
    .promise();

  return (response as any).VersionId;
}
