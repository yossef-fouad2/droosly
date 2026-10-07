import { db } from "../db/index.js";
import { categories } from "../db/schema.js";


export async function getCategories() {
    const allcategories = await db
    .select({nameEn:categories.nameEn, nameAr: categories.nameAr})
    .from(categories);
    
 return allcategories;
}