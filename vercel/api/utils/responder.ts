// utils/responder.ts

import { z } from "zod";
import { ValidationError, AuthenticationError, BodyError } from "./errors";

export function error(error: Error): Response {
  let statusCode: number = 500;
  let body: string = "";

  switch (error.constructor) {
    case ValidationError:
      statusCode = 400;
      body = JSON.stringify({
        error: "Request Body Invalid",
        internalError: error.message,
      });
      break;
    case AuthenticationError:
      statusCode = 401;
      body = JSON.stringify({
        error: "Authentication Error",
        internalError: error.message,
      });
      break;
    case BodyError:
      statusCode = 400;
      body = JSON.stringify({
        error: "Body Content Invalid",
        internalError: error.message,
      });
      break;
    case z.ZodError:
      statusCode = 400;
      body = JSON.stringify({
        error: "Body Content Invalid",
        internalError: JSON.parse(error.message),
      });
      break;
    default:
      body = JSON.stringify({ error: error.message });
      break;
  }

  return new Response(body, {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function success(result: Object): Response {
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}