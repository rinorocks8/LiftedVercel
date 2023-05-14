import { dynamoDBRequest } from "../../utils/dynamoDBRequest";
import * as responder from '../../utils/responder';
import { verifyCognitoToken } from "../../utils/verifyCognitoToken";
import { ExerciseKey, UserKey, WorkoutKey } from '../../graphql'

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
    total_sets: z.number().optional(),
    total_weight: z.number().optional(),
    maxEq: z.number().optional(),

    deleted: z.boolean().optional()
  })).optional(),
  workouts: z.array(z.object({
    lastUpdated: z.number(),
    userID: z.string(),

    workoutID: z.string(),
    workout: z.string(),
    startTime: z.number(),
    total_duration: z.number().optional(),
    total_sets: z.number().optional(),
    total_weight: z.number().optional(),

    deleted: z.boolean().optional()
  })).optional(),
  user: z.object({
    userID: z.string(),
    name: z.string(),
    welcome: z.boolean(),
    maxTimer: z.number(),
    timerAutoStart: z.boolean(),
    timerNotifications: z.boolean(),
    programs: z.string(),
    total_exercises: z.number(),
    total_workouts: z.number(),
    total_weight: z.number(),
    total_sets: z.number(),
    total_duration: z.number(),
  }).optional(),
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
          UpdateExpression: "SET variationID = :new_variationID, exercise_sets = :new_exercise_sets, userID = :new_userID, lastUpdated = :new_lastUpdated, workoutID = :new_workoutID, deleted = :new_deleted, total_sets = :total_sets, total_weight = :total_weight, maxEq = :maxEq",
          ExpressionAttributeValues: AttributeValue.wrap({
            ":new_userID": _exercise.userID,
            ":new_lastUpdated":  _exercise.lastUpdated,
            ":new_workoutID":  _exercise.workoutID,
            ":new_variationID": _exercise.variationID,
            ":new_exercise_sets": _exercise.sets,
            ":new_deleted": _exercise.deleted,
            ":total_sets": _exercise.total_sets ?? 0,
            ":total_weight": _exercise.total_weight ?? 0,
            ":maxEq": _exercise.maxEq ?? 0
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
          UpdateExpression: "SET workout = :new_workout, lastUpdated = :new_lastUpdated, userID = :new_userID, startTime = :new_startTime, deleted = :new_deleted, total_duration = :total_duration, total_sets = :total_sets, total_weight = :total_weight",
          ExpressionAttributeValues: AttributeValue.wrap({
            ":new_userID": _workout.userID,
            ":new_lastUpdated": _workout.lastUpdated,
            ":new_workout": _workout.workout,
            ":new_startTime": _workout.startTime,
            ":new_deleted": _workout.deleted,
            ":total_duration": _workout.total_duration ?? 0,
            ":total_sets": _workout.total_sets ?? 0,
            ":total_weight": _workout.total_weight ?? 0,
          }),
        },
      })
    }

    // for (let _workout of body.workouts ?? []) {
    if (body.user) {
      let userKey: UserKey = {
        userID: username
      }
      transactItems.push({
        Update: {
          TableName: process.env['User'],
          Key: AttributeValue.wrap(userKey),  // you need to provide the userKey here
          UpdateExpression: "SET #name = :new_name, welcome = :new_welcome, maxTimer = :new_maxTimer, timerAutoStart = :new_timerAutoStart, timerNotifications = :new_timerNotifications, programs = :new_programs, total_exercises = :new_total_exercises, total_workouts = :new_total_workouts, total_weight = :new_total_weight, total_sets = :new_total_sets, total_duration = :new_total_duration",
          ExpressionAttributeNames: {
              "#name": "name"
          },
          ExpressionAttributeValues: AttributeValue.wrap({
              ":new_name": body.user.name,
              ":new_welcome": body.user.welcome,
              ":new_maxTimer": body.user.maxTimer,
              ":new_timerAutoStart": body.user.timerAutoStart,
              ":new_timerNotifications": body.user.timerNotifications,
              ":new_programs": body.user.programs,
              ":new_total_exercises": body.user.total_exercises ?? 0,
              ":new_total_workouts": body.user.total_workouts ?? 0,
              ":new_total_weight": body.user.total_weight ?? 0,
              ":new_total_sets": body.user.total_sets ?? 0,
              ":new_total_duration": body.user.total_duration ?? 0
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
