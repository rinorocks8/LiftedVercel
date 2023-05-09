import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import * as responder from '../../utils/responder';
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { ExerciseKey, WorkoutKey } from '../../graphql'

import { z } from "zod";
import { AttributeValue } from 'dynamodb-data-types';
import parseSchema from "../../utils/parseSchema";


export const config = {
  runtime: "experimental-edge",
};

const requestBodySchema = z.object({
  exercises: z.array(z.object({
    lastUpdated: z.number(),
    userID: z.string(),

    exerciseID: z.string(),
    workoutID: z.string(),
    variationID: z.string(),
    sets: z.string(),
    deleted: z.boolean().optional()
  })).optional(),
  workouts: z.array(z.object({
    lastUpdated: z.number(),
    userID: z.string(),

    workoutID: z.string(),
    workout: z.string(),
    startTime: z.number(),
    deleted: z.boolean().optional()
  })).optional(),
});

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default async function handleRequest(req: Request): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyCognitoToken(token || "");
    const username = decoded["username"];
    const body = parseSchema(requestBodySchema, await req.json());
    const transactItems: any = [];

    for (let _exercise of body.exercises ?? []) {
      let exerciseKey: ExerciseKey = {
        exerciseID: _exercise.exerciseID
      }
      transactItems.push({
        Update: {
          TableName: process.env['Exercise'],
          Key: AttributeValue.wrap(exerciseKey),
          UpdateExpression: "SET variationID = :new_variationID, exercise_sets = :new_exercise_sets, userID = :new_userID, lastUpdated = :new_lastUpdated, workoutID = :new_workoutID, deleted = :new_deleted",
          ExpressionAttributeValues: AttributeValue.wrap({
            ":new_userID": _exercise.userID,
            ":new_lastUpdated":  _exercise.lastUpdated,
            ":new_workoutID":  _exercise.workoutID,
            ":new_variationID": _exercise.variationID,
            ":new_exercise_sets": _exercise.sets,
            ":new_deleted": _exercise.deleted
          }),
        },
      })
    }

    for (let _workout of body.workouts ?? []) {
      let workoutKey: WorkoutKey = {
        workoutID: _workout.workoutID
      }
      transactItems.push({
        Update: {
          TableName: process.env['Workout'],
          Key: AttributeValue.wrap(workoutKey),
          UpdateExpression: "SET workout = :new_workout, lastUpdated = :new_lastUpdated, userID = :new_userID, startTime = :new_startTime, deleted = :new_deleted",
          ExpressionAttributeValues: AttributeValue.wrap({
            ":new_userID": _workout.userID,
            ":new_lastUpdated": _workout.lastUpdated,
            ":new_workout": _workout.workout,
            ":new_startTime": _workout.startTime,
            ":new_deleted": _workout.deleted
          }),
        },
      })
    }

    if (transactItems.length === 0) {
      return responder.success({
        result: "no changes"
      });
    }

    const chunkedTransactItems = chunkArray(transactItems, 100);
    const results: any[] = [];

    for (const chunk of chunkedTransactItems) {
      const operation_body = {
        TransactItems: chunk,
      };
      const check_result = await dynamoDBRequest("TransactWriteItems", operation_body);
      results.push(check_result);
    }

    return responder.success({
      result: results
    });

  } catch (error) {
    return responder.error(error);
  }
}
