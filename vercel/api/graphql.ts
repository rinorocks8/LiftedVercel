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
  exerciseID: Scalars['ID'];
  lastUpdated: Scalars['Int'];
  sets?: Maybe<Scalars['String']>;
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

export type ExerciseByWorkoutIdVariationIdKey = {
  __typename?: 'ExerciseByWorkoutIDVariationIDKey';
  variationID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type ExerciseKey = {
  __typename?: 'ExerciseKey';
  exerciseID: Scalars['ID'];
};

export type Feed = {
  __typename?: 'Feed';
  createdAt: Scalars['String'];
  postID: Scalars['ID'];
  postUserID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FeedByUserIdCreatedAtKey = {
  __typename?: 'FeedByUserIDCreatedAtKey';
  createdAt: Scalars['ID'];
  userID: Scalars['ID'];
};

export type FeedKey = {
  __typename?: 'FeedKey';
  postID: Scalars['ID'];
  userID: Scalars['ID'];
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
  postID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type LikeKey = {
  __typename?: 'LikeKey';
  postID: Scalars['ID'];
  userID: Scalars['ID'];
};

export type Post = {
  __typename?: 'Post';
  createdAt: Scalars['String'];
  likes: Scalars['Int'];
  postID: Scalars['ID'];
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type PostByUserIdCreatedAtKey = {
  __typename?: 'PostByUserIDCreatedAtKey';
  createdAt: Scalars['ID'];
  userID: Scalars['ID'];
};

export type PostKey = {
  __typename?: 'PostKey';
  postID: Scalars['ID'];
};

export type Workout = {
  __typename?: 'Workout';
  endTime?: Maybe<Scalars['String']>;
  exerciseGroups?: Maybe<Scalars['String']>;
  lastUpdated: Scalars['Int'];
  name?: Maybe<Scalars['String']>;
  startTime: Scalars['String'];
  userID: Scalars['ID'];
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
