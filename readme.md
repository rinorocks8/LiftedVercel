# Lifted API

Welcome to the Lifted API repository! Lifted is a social media gym app that enables users to log workouts and share them with friends. This API handles all the backend services and data management for the Lifted app.

## Vercel Edge Functions

Lifted API is built using Vercel Edge Functions, a highly performant serverless infrastructure. By utilizing Vercel's Edge Network, we are able to deploy our functions closer to the end-users, resulting in significantly reduced latency.

## Switching from AWS Lambda

Previously, the Lifted API was implemented using AWS Lambda. After making the switch to Vercel Edge Functions, we observed a 10x increase in response time. This substantial improvement allows users to have a smoother and more enjoyable experience when using the Lifted app.

## Features

Log workouts
Share workouts with friends
Follow and unfollow friends
Like workouts

## Tech Stack

- Vercel Edge Functions
- Terraform
- AWS DynamoDB
- AWS Cognito
- GraphQL
- TypeScript
- zod for validation

## Schema-driven Development

The Lifted API uses a schema.graphql file to automatically generate TypeScript types for use within the API. This helps maintain a consistent and reliable type system throughout the application. Additionally, the schema.graphql file is used to create a DynamoDB table with defined keys and Global Secondary Indexes (GSIs) according to the schema.

### Terraform Integration

We use Terraform to automate the creation of resources needed for the Lifted API. This includes setting up the DynamoDB table based on the schema and creating an AWS Cognito User Pool for user authentication and authorization. The AWS Cognito User Pool is also configured to support Google OAuth, allowing users to sign in with their Google accounts. This approach streamlines our infrastructure setup and ensures consistency across environments.
