import { db } from "../db/index.js";
import { categories } from "../db/schema.js";

export async function getAllCategories() {
  const allcategories = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      nameEn: categories.nameEn,
      nameAr: categories.nameAr,
    })
    .from(categories);

  return allcategories;
}
