-- CreateEnum
CREATE TYPE "CommunityGroupPrivacy" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommunityGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CommunityGroupCategory" AS ENUM ('FUN', 'SPORT', 'EDUCATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityGroupMemberRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "CommunityGroupMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED', 'BANNED');

-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'POLL');

-- CreateEnum
CREATE TYPE "CommunityPostVisibility" AS ENUM ('PUBLIC', 'GROUP', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommunityPostStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED');

-- CreateTable
CREATE TABLE "CommunityGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CommunityGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" "CommunityGroupCategory" NOT NULL,
    "privacy" "CommunityGroupPrivacy" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityGroupCoverPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityGroupCoverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityGroupMemeber" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityGroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "CommunityGroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityGroupMemeber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "groupId" TEXT,
    "type" "CommunityPostType" NOT NULL,
    "visibility" "CommunityPostVisibility" NOT NULL,
    "content" TEXT,
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPostPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostVideo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPostVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostPoll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPostPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostPollOption" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPostPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostPollVote" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPostShare" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityGroup_creatorId_idx" ON "CommunityGroup"("creatorId");

-- CreateIndex
CREATE INDEX "CommunityGroup_privacy_idx" ON "CommunityGroup"("privacy");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityGroupCoverPhoto_groupId_key" ON "CommunityGroupCoverPhoto"("groupId");

-- CreateIndex
CREATE INDEX "CommunityGroupCoverPhoto_groupId_idx" ON "CommunityGroupCoverPhoto"("groupId");

-- CreateIndex
CREATE INDEX "CommunityGroupMemeber_groupId_idx" ON "CommunityGroupMemeber"("groupId");

-- CreateIndex
CREATE INDEX "CommunityGroupMemeber_userId_idx" ON "CommunityGroupMemeber"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityGroupMemeber_groupId_userId_key" ON "CommunityGroupMemeber"("groupId", "userId");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_idx" ON "CommunityPost"("authorId");

-- CreateIndex
CREATE INDEX "CommunityPost_groupId_idx" ON "CommunityPost"("groupId");

-- CreateIndex
CREATE INDEX "CommunityPost_visibility_idx" ON "CommunityPost"("visibility");

-- CreateIndex
CREATE INDEX "CommunityPost_type_idx" ON "CommunityPost"("type");

-- CreateIndex
CREATE INDEX "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityPostPhoto_postId_idx" ON "CommunityPostPhoto"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPostVideo_postId_key" ON "CommunityPostVideo"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostVideo_postId_idx" ON "CommunityPostVideo"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPostPoll_postId_key" ON "CommunityPostPoll"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostPoll_postId_idx" ON "CommunityPostPoll"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostPollOption_pollId_idx" ON "CommunityPostPollOption"("pollId");

-- CreateIndex
CREATE INDEX "CommunityPostPollVote_optionId_idx" ON "CommunityPostPollVote"("optionId");

-- CreateIndex
CREATE INDEX "CommunityPostPollVote_voterId_idx" ON "CommunityPostPollVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPostPollVote_optionId_voterId_key" ON "CommunityPostPollVote"("optionId", "voterId");

-- CreateIndex
CREATE INDEX "CommunityPostLike_postId_idx" ON "CommunityPostLike"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostLike_userId_idx" ON "CommunityPostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPostLike_postId_userId_key" ON "CommunityPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "CommunityPostComment_postId_idx" ON "CommunityPostComment"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostComment_userId_idx" ON "CommunityPostComment"("userId");

-- CreateIndex
CREATE INDEX "CommunityPostComment_parentId_idx" ON "CommunityPostComment"("parentId");

-- CreateIndex
CREATE INDEX "CommunityPostShare_postId_idx" ON "CommunityPostShare"("postId");

-- CreateIndex
CREATE INDEX "CommunityPostShare_userId_idx" ON "CommunityPostShare"("userId");

-- AddForeignKey
ALTER TABLE "CommunityGroup" ADD CONSTRAINT "CommunityGroup_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGroupCoverPhoto" ADD CONSTRAINT "CommunityGroupCoverPhoto_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGroupMemeber" ADD CONSTRAINT "CommunityGroupMemeber_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGroupMemeber" ADD CONSTRAINT "CommunityGroupMemeber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostPhoto" ADD CONSTRAINT "CommunityPostPhoto_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostVideo" ADD CONSTRAINT "CommunityPostVideo_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostPoll" ADD CONSTRAINT "CommunityPostPoll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostPollOption" ADD CONSTRAINT "CommunityPostPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CommunityPostPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostPollVote" ADD CONSTRAINT "CommunityPostPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CommunityPostPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostPollVote" ADD CONSTRAINT "CommunityPostPollVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostShare" ADD CONSTRAINT "CommunityPostShare_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPostShare" ADD CONSTRAINT "CommunityPostShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
