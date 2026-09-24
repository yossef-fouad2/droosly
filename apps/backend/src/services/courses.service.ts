import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { courses, type Course, type NewCourse } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import type { CreateCourseInput,  } from "../validation/schemas.js";





// to avoid duplication of course columns
const courseColumns = {
  id: courses.id,
  title: courses.title,
  description: courses.description,
  category: courses.category,
  price: courses.price,
  instructorId: courses.instructorId,
};

export type ListCoursesInput = {
  page: number;
  limit: number;
  category?: string | undefined;
};

export async function listCourses({ page, limit, category }: ListCoursesInput) {
  const offset = (page - 1) * limit;

  const whereClause = category ? eq(courses.category, category) : undefined;

  const items = await db
    .select(courseColumns)
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



//get single course by id
export async function  getCoursesByID(id: number){
  const [course] = await db
  .select(courseColumns)
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

    if(!course){
      throw new AppError("NOT_FOUND","Course with id ${id} not found")
    }
    return course;
}



export async function createCourse(
  input: CreateCourseInput,
  instructorId: number,
 ) {
  const newCourse: NewCourse = {
    title: input.title,
    description: input.description,
    category: input.category,
    price: input.price,
    instructorId,
  };

  const [course] = await db.insert(courses).values(newCourse).returning();

  return course;
}
