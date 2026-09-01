-- CreateTable
CREATE TABLE "breaks" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conditions_verdict" TEXT,
    "raw_data" JSONB,
    "conditions_updated_at" TIMESTAMP(3),
    "conditions_model_run_at" TIMESTAMP(3),

    CONSTRAINT "breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_saved_breaks" (
    "user_id" TEXT NOT NULL,
    "break_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_saved_breaks_pkey" PRIMARY KEY ("user_id","break_id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "user_id" TEXT NOT NULL,
    "friend_id" TEXT NOT NULL,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("user_id","friend_id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "break_id" TEXT NOT NULL,
    "eta" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "user_id" TEXT NOT NULL,
    "friend_check_in" BOOLEAN NOT NULL DEFAULT true,
    "night_before" BOOLEAN NOT NULL DEFAULT true,
    "dawn_patrol" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "breaks_created_by_id_idx" ON "breaks"("created_by_id");

-- CreateIndex
CREATE INDEX "user_saved_breaks_break_id_idx" ON "user_saved_breaks"("break_id");

-- CreateIndex
CREATE INDEX "crew_members_friend_id_idx" ON "crew_members"("friend_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_user_id_key" ON "check_ins"("user_id");

-- CreateIndex
CREATE INDEX "check_ins_break_id_idx" ON "check_ins"("break_id");

-- CreateIndex
CREATE INDEX "check_ins_eta_idx" ON "check_ins"("eta");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "breaks" ADD CONSTRAINT "breaks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_breaks" ADD CONSTRAINT "user_saved_breaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_breaks" ADD CONSTRAINT "user_saved_breaks_break_id_fkey" FOREIGN KEY ("break_id") REFERENCES "breaks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_break_id_fkey" FOREIGN KEY ("break_id") REFERENCES "breaks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
