import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { courses,  type NewCourse } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import type { CreateCourseInput, UpdateCourseInput,  } from "../validation/schemas.js";





// to avoid duplication of course columns
const courseColumns = {
  id: courses.id,
  title: courses.title,
  description: courses.description,
  categoryId: courses.categoryId,
  price: courses.price,
  workspaceId: courses.workspaceId,
};

export type ListCoursesInput = {
  page: number;
  limit: number;
  categoryId?: number | undefined;
};

export async function listCourses({ page, limit, categoryId }: ListCoursesInput) {
  const offset = (page - 1) * limit;

  const whereClause = categoryId ? eq(courses.categoryId, categoryId) : undefined;

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
      throw new AppError("NOT_FOUND",`Course with id ${id} not found`)
    }
    return course;
}



export async function createCourse(
  input: CreateCourseInput,
  workspaceId: number,
 ) {
  const newCourse: NewCourse = {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    price: input.price,
    workspaceId,
  };

  const [course] = await db.insert(courses).values(newCourse).returning();

  return course;
}

export async function  updateCourse(
  id:number,
  workspaceId: number,
  input: UpdateCourseInput ) {
   const existing = await getCoursesByID(id);
   if(existing.workspaceId !== workspaceId){
    throw new AppError("FORBIDDEN",`course ${id} belongs to another teacher`);
   }
   const [course] = await db
   .update(courses)
   .set(input)
   .where(eq(courses.id, id))
   .returning(courseColumns);

  return course;
   
}


export async function deleteCourse(
  id:number,
  workspaceId: number,
  ) {
   const existing = await getCoursesByID(id);
   if(!existing){
      throw new AppError("FORBIDDEN",`course ${id} Not found`);
   }   
   if(existing.workspaceId !== workspaceId){
    throw new AppError("FORBIDDEN",`course ${id} belongs to another teacher`);
   }
   const [course] = await db
   .delete(courses)
   .where(eq(courses.id, id))
   .returning(courseColumns);

  return course;
   
}
