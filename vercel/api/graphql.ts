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

export type Feed = {
  __typename?: 'Feed';
  createdAt: Scalars['String'];
  userID: Scalars['ID'];
  workoutID: Scalars['String'];
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

export type Workout = {
  __typename?: 'Workout';
  createdAt: Scalars['String'];
  exercises: Scalars['String'];
  likes: Scalars['Int'];
  name: Scalars['String'];
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
};

export type WorkoutByUserIdCreatedAtKey = {
  __typename?: 'WorkoutByUserIDCreatedAtKey';
  createdAt: Scalars['ID'];
  userID: Scalars['ID'];
};

export type WorkoutKey = {
  __typename?: 'WorkoutKey';
  userID: Scalars['ID'];
  workoutID: Scalars['ID'];
};
