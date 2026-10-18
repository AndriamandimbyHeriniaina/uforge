-- The gateway no longer stores apps: the device is the source of truth.

-- DropForeignKey
ALTER TABLE "Generation" DROP CONSTRAINT "Generation_appId_fkey";
ALTER TABLE "Generation" DROP CONSTRAINT "Generation_draftId_fkey";
ALTER TABLE "App" DROP CONSTRAINT "App_ownerId_fkey";
ALTER TABLE "Draft" DROP CONSTRAINT "Draft_appId_fkey";
ALTER TABLE "AppVersion" DROP CONSTRAINT "AppVersion_appId_fkey";
ALTER TABLE "UploadedFile" DROP CONSTRAINT "UploadedFile_userId_fkey";
ALTER TABLE "UploadedFile" DROP CONSTRAINT "UploadedFile_appId_fkey";

-- AlterTable
ALTER TABLE "Generation" DROP COLUMN "draftId",
DROP COLUMN "resultSpec",
ADD COLUMN "changedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: the whole workspace is sent on every turn
ALTER TABLE "PlanQuota" ALTER COLUMN "maxContextChars" SET DEFAULT 400000;
UPDATE "PlanQuota" SET "maxContextChars" = 400000 WHERE "maxContextChars" < 400000;

-- DropTable
DROP TABLE "AppVersion";
DROP TABLE "Draft";
DROP TABLE "UploadedFile";
DROP TABLE "App";

-- DropEnum
DROP TYPE "AppStatus";
DROP TYPE "FilePurpose";
