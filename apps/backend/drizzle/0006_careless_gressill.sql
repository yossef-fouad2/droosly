ALTER TABLE "Categories" RENAME TO "categories";--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "Categories_slug_unique";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_unique" UNIQUE("slug");