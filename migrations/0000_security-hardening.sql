CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"actor_id" varchar,
	"actor_username" text,
	"actor_role" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" varchar,
	"ip_address" text,
	"user_agent" text,
	"changes" jsonb DEFAULT '{}'::jsonb,
	"success" boolean NOT NULL,
	"error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cycles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cycles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar,
	"level" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "key_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"assignee_id" varchar,
	"assignee_name" text DEFAULT '' NOT NULL,
	"collaborator_id" varchar,
	"collaborator_name" text DEFAULT '' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'normal' NOT NULL,
	"okr_type" text DEFAULT '承诺型' NOT NULL,
	"self_score" real,
	"self_score_note" text DEFAULT '' NOT NULL,
	"progress_history" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "key_results_progress_check" CHECK ("key_results"."progress" between 0 and 100),
	CONSTRAINT "key_results_weight_check" CHECK ("key_results"."weight" > 0),
	CONSTRAINT "key_results_self_score_check" CHECK ("key_results"."self_score" is null or ("key_results"."self_score" >= 0 and "key_results"."self_score" <= 1))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kr_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kr_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"content" text NOT NULL,
	"mentioned_user_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text DEFAULT 'comment_mention' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"related_kr_id" varchar,
	"related_objective_id" varchar,
	"from_user_id" varchar,
	"from_user_name" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "objectives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"department_id" varchar NOT NULL,
	"cycle" text NOT NULL,
	"parent_objective_id" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"is_collaborative" boolean DEFAULT false NOT NULL,
	"collaborative_dept_ids" jsonb DEFAULT '[]'::jsonb,
	"collaborative_user_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_to_parent" boolean DEFAULT false NOT NULL,
	"okr_type" text DEFAULT '承诺型' NOT NULL,
	"created_by" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"department_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text,
	"auth_provider" text DEFAULT 'dingtalk' NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"department_id" varchar,
	"dingtalk_user_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_dingtalk_user_id_unique" UNIQUE("dingtalk_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" text DEFAULT 'dingtalk' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
UPDATE "users" SET "auth_provider" = CASE WHEN "role" = 'super_admin' THEN 'local' ELSE 'dingtalk' END;--> statement-breakpoint
UPDATE "users" SET "password" = NULL WHERE "role" <> 'super_admin';--> statement-breakpoint
WITH duplicate_dingtalk AS (
	SELECT "id", row_number() OVER (PARTITION BY "dingtalk_user_id" ORDER BY "created_at", "id") AS row_number
	FROM "users" WHERE "dingtalk_user_id" IS NOT NULL
)
UPDATE "users" SET "dingtalk_user_id" = NULL
WHERE "id" IN (SELECT "id" FROM duplicate_dingtalk WHERE row_number > 1);--> statement-breakpoint
DELETE FROM "user_departments" a USING "user_departments" b
WHERE a.ctid < b.ctid AND a."user_id" = b."user_id" AND a."department_id" = b."department_id";--> statement-breakpoint
DELETE FROM "user_departments" ud WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = ud."user_id") OR NOT EXISTS (SELECT 1 FROM "departments" d WHERE d."id" = ud."department_id");--> statement-breakpoint
UPDATE "users" u SET "department_id" = NULL WHERE "department_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "departments" d WHERE d."id" = u."department_id");--> statement-breakpoint
INSERT INTO "departments" ("id", "name", "parent_id", "level")
SELECT 'security_unassigned_department', '未分配', NULL, 0
WHERE EXISTS (SELECT 1 FROM "objectives" o WHERE NOT EXISTS (SELECT 1 FROM "departments" d WHERE d."id" = o."department_id"))
AND NOT EXISTS (SELECT 1 FROM "departments" WHERE "id" = 'security_unassigned_department');--> statement-breakpoint
UPDATE "objectives" o SET "department_id" = 'security_unassigned_department' WHERE NOT EXISTS (SELECT 1 FROM "departments" d WHERE d."id" = o."department_id");--> statement-breakpoint
UPDATE "objectives" o SET "created_by" = NULL WHERE "created_by" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = o."created_by");--> statement-breakpoint
DELETE FROM "key_results" kr WHERE NOT EXISTS (SELECT 1 FROM "objectives" o WHERE o."id" = kr."objective_id");--> statement-breakpoint
UPDATE "key_results" kr SET "assignee_id" = NULL WHERE "assignee_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = kr."assignee_id");--> statement-breakpoint
UPDATE "key_results" kr SET "collaborator_id" = NULL WHERE "collaborator_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = kr."collaborator_id");--> statement-breakpoint
UPDATE "key_results" SET "progress" = greatest(0, least(100, "progress")), "weight" = CASE WHEN "weight" > 0 THEN "weight" ELSE 1 END, "self_score" = CASE WHEN "self_score" BETWEEN 0 AND 1 THEN "self_score" ELSE NULL END;--> statement-breakpoint
DELETE FROM "kr_comments" c WHERE NOT EXISTS (SELECT 1 FROM "key_results" kr WHERE kr."id" = c."kr_id") OR NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."user_id");--> statement-breakpoint
DELETE FROM "notifications" n WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = n."user_id");--> statement-breakpoint
UPDATE "notifications" n SET "related_kr_id" = NULL WHERE "related_kr_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "key_results" kr WHERE kr."id" = n."related_kr_id");--> statement-breakpoint
UPDATE "notifications" n SET "related_objective_id" = NULL WHERE "related_objective_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "objectives" o WHERE o."id" = n."related_objective_id");--> statement-breakpoint
UPDATE "notifications" n SET "from_user_id" = NULL WHERE "from_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = n."from_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_dingtalk_user_id_unique" ON "users" USING btree ("dingtalk_user_id") WHERE "dingtalk_user_id" IS NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'key_results_progress_check') THEN
		ALTER TABLE "key_results" ADD CONSTRAINT "key_results_progress_check" CHECK ("progress" BETWEEN 0 AND 100);
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'key_results_weight_check') THEN
		ALTER TABLE "key_results" ADD CONSTRAINT "key_results_weight_check" CHECK ("weight" > 0);
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'key_results_self_score_check') THEN
		ALTER TABLE "key_results" ADD CONSTRAINT "key_results_self_score_check" CHECK ("self_score" IS NULL OR ("self_score" >= 0 AND "self_score" <= 1));
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_collaborator_id_users_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kr_comments" ADD CONSTRAINT "kr_comments_kr_id_key_results_id_fk" FOREIGN KEY ("kr_id") REFERENCES "public"."key_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kr_comments" ADD CONSTRAINT "kr_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_kr_id_key_results_id_fk" FOREIGN KEY ("related_kr_id") REFERENCES "public"."key_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_objective_id_objectives_id_fk" FOREIGN KEY ("related_objective_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "key_results_objective_idx" ON "key_results" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "key_results_assignee_idx" ON "key_results" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "key_results_collaborator_idx" ON "key_results" USING btree ("collaborator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kr_comments_kr_idx" ON "kr_comments" USING btree ("kr_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kr_comments_user_idx" ON "kr_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objectives_department_idx" ON "objectives" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objectives_created_by_idx" ON "objectives" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objectives_cycle_idx" ON "objectives" USING btree ("cycle");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_departments_user_department_unique" ON "user_departments" USING btree ("user_id","department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_departments_user_idx" ON "user_departments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_departments_department_idx" ON "user_departments" USING btree ("department_id");
