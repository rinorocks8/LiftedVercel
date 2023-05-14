import { BodyError } from "./errors";

export default function parseSchema (requestBodySchema, _body) {
  const body = requestBodySchema.safeParse(_body);
  if (!body.success) {
    throw new BodyError(JSON.stringify(body.error.issues))
  }
  return body.data;
}