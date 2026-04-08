-- Migration 017: Replace FCM token with Expo push token
-- Renames fcm_token → expo_push_token on the users table.
-- Safe: column type (text, nullable) is unchanged.

ALTER TABLE "User" RENAME COLUMN fcm_token TO expo_push_token;
