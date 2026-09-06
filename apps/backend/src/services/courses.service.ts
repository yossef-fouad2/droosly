import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { courses } from "../db/schema.js";
import { courseIdSchema } from "../validation/schemas.js";


await db;

export type ListCoursesInput = {
  page: number;
  limit: number;
  category?: string | undefined;
};

export async function listCourses({ page, limit, category }: ListCoursesInput) {
  const offset = (page - 1) * limit;

  const whereClause = category ? eq(courses.category, category) : undefined;

  const items = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      category: courses.category,
      price: courses.price,
      instructorId: courses.instructorId,
    })
    .from(courses)
    .where(whereClause)
    .orderBy(desc(courses.id))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(courses)
    .where(whereClause);

  const total = Number(totalResult[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}



export type CourseSchema = {
    id: number;
    title: string;
    description: string;
    category: string;
    price: number;
    instructorId: number;
};
export async function  getCoursesByID(id: number){
  const course = await db
  .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      category: courses.category,
      price: courses.price,
      instructorId: courses.instructorId,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1)

    return course[0];
}
