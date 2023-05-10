export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Exercise = {
  __typename?: 'Exercise';
  deleted: Scalars['Boolean'];
  exerciseID: Scalars['ID'];
  exercise_sets: Scalars['String'];
  lastUpdated: Scalars['Int'];
  userID: Scalars['ID'];
  variationID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type ExerciseByUserIdLastUpdatedKey = {
  __typename?: 'ExerciseByUserIDLastUpdatedKey';
  lastUpdated: Scalars['ID'];
  userID: Scalars['ID'];
};

export type ExerciseByUserIdVariationIdKey = {
  __typename?: 'ExerciseByUserIDVariationIDKey';
  userID: Scalars['ID'];
  variationID: Scalars['ID'];
};

export type ExerciseKey = {
  __typename?: 'ExerciseKey';
  exerciseID: Scalars['ID'];
};

export type Feed = {
  __typename?: 'Feed';
  createdAt: Scalars['Int'];
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
  workoutUserID: Scalars['ID'];
};

export type FeedByUserIdCreatedAtKey = {
  __typename?: 'FeedByUserIDCreatedAtKey';
  createdAt: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FeedKey = {
  __typename?: 'FeedKey';
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type Following = {
  __typename?: 'Following';
  acceptedAt: Scalars['String'];
  followingUserID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FollowingByFollowingUserIdAcceptedAtKey = {
  __typename?: 'FollowingByFollowingUserIDAcceptedAtKey';
  acceptedAt: Scalars['ID'];
  followingUserID: Scalars['ID'];
};

export type FollowingByUserIdAcceptedAtKey = {
  __typename?: 'FollowingByUserIDAcceptedAtKey';
  acceptedAt: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FollowingKey = {
  __typename?: 'FollowingKey';
  followingUserID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FriendRequest = {
  __typename?: 'FriendRequest';
  requestedAt: Scalars['String'];
  requestingUserID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FriendRequestByUserIdRequestedAtKey = {
  __typename?: 'FriendRequestByUserIDRequestedAtKey';
  requestedAt: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FriendRequestKey = {
  __typename?: 'FriendRequestKey';
  requestingUserID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type Like = {
  __typename?: 'Like';
  createdAt: Scalars['String'];
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type LikeKey = {
  __typename?: 'LikeKey';
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type User = {
  __typename?: 'User';
  lastUpdated: Scalars['Int'];
  maxTimer: Scalars['Int'];
  name: Scalars['String'];
  programs: Scalars['String'];
  timerAutoStart: Scalars['Boolean'];
  timerNotifications: Scalars['Boolean'];
  userID: Scalars['ID'];
  welcome: Scalars['Boolean'];
};

export type UserKey = {
  __typename?: 'UserKey';
  userID: Scalars['ID'];
};

export type Workout = {
  __typename?: 'Workout';
  caption: Scalars['String'];
  deleted: Scalars['Boolean'];
  lastUpdated: Scalars['Int'];
  likes: Scalars['Int'];
  startTime: Scalars['Int'];
  userID: Scalars['ID'];
  visible: Scalars['Boolean'];
  workout: Scalars['String'];
  workoutID: Scalars['ID'];
};

export type WorkoutByUserIdLastUpdatedKey = {
  __typename?: 'WorkoutByUserIDLastUpdatedKey';
  lastUpdated: Scalars['ID'];
  userID: Scalars['ID'];
};

export type WorkoutByUserIdStartTimeKey = {
  __typename?: 'WorkoutByUserIDStartTimeKey';
  startTime: Scalars['ID'];
  userID: Scalars['ID'];
};

export type WorkoutKey = {
  __typename?: 'WorkoutKey';
  workoutID: Scalars['ID'];
};
