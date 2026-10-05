CREATE TABLE "grade_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "grade_levels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "terms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "category";