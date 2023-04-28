import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { z } from "zod";
import * as responder from '../../utils/responder';
import { cognitoRequest } from "../../utils/cognitoRequest";

export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  preferred_username: z.string().min(1),
});

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];

    const body = requestBodySchema.parse(await req.json());

    let users = await cognitoRequest("ListUsers", {
      UserPoolId: process.env.userPoolID,
      AttributesToGet: ["preferred_username"],
      Filter: `preferred_username ^= \"${body.preferred_username}\"`,
      Limit: 60,
    });
    users = users.Users?.map((userRes) => ({
      userID: userRes.Username,
      preferred_username: userRes.Attributes?.find(
        (obj) => obj.Name === "preferred_username"
      )?.Value,
    }));

    return responder.success({
      users: users,
    });
  } catch (error) {
    return responder.error(error);
  }
}
