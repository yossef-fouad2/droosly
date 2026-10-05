import { z } from "zod";

// --- Auth ---
export const signupSchema = z.object({
  email: z.email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export const loginSchema = z.object({
  email: z.email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});




// --- Courses ---
export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  categoryId: z.coerce.number().int().positive().optional(),
});

export const courseIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});
export const createCourseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required"),
  categoryId: z.coerce.number().int().positive(),
  price: z.coerce.number().int().nonnegative("Price must be non-negative"),
  // instructorId intentionally omitted — derived from the authenticated user
});

export const updateCourseSchema = createCourseSchema.partial();
// --- Inferred TypeScript types ---
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesQueryInput = z.infer<typeof listCoursesQuerySchema>;
export type courseSchemainput = z.infer<typeof courseIdSchema>;

