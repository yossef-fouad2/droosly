import { Router, type Request, type Response } from "express";
import {
  createCourse,
  deleteCourse,
  getCoursesByID,
  listCourses,
  updateCourse,
} from "../services/courses.service.js";
import {
  courseIdSchema,
  listCoursesQuerySchema,
  type ListCoursesQueryInput,
  createCourseSchema,
  type CreateCourseInput,
  updateCourseSchema,
  type UpdateCourseInput,
} from "../validation/schemas.js";
import { validate } from "../middleware/validate.js";
import requireAuth from "../middleware/requireAuth.js";
import { AppError } from "../lib/errors.js";
import { workspaceAuth } from "../middleware/workspaceAuth.js";

const coursesRouter = Router();
export default coursesRouter;

coursesRouter.get(
  "/",
  validate(listCoursesQuerySchema, "query"),
  async (req: Request, res: Response) => {
    const result = await listCourses(req.validated as ListCoursesQueryInput);
    return res.status(200).json(result);
  },
);

coursesRouter.get(
  "/:id",
  validate(courseIdSchema, "params"),
  async (req: Request, res: Response) => {
    const result = await getCoursesByID((req.validated as { id: number }).id);
    if (!result) {
    }
    return res.status(200).json(result);
  },
);

// create course
coursesRouter.post(
  "/",
  requireAuth,
  workspaceAuth,
  validate(createCourseSchema, "body"),
  async (req: Request, res: Response) => {
    const input = req.validated as CreateCourseInput;
    const course = await createCourse(input, req.workspaceId!);
    return res.status(201).json(course);
  },
);

// update course
coursesRouter.patch(
  "/:id",
  requireAuth,
  workspaceAuth,
  validate(courseIdSchema, "params"),
  validate(updateCourseSchema, "body"),
  async (req: Request, res: Response) => {
    if (req.userId === undefined) {
      throw new AppError("UNAUTHENTICATED", "Missing user id");
    }
    const { id } = req.validated!.params as { id: number };
    const input = req.validated!.body as UpdateCourseInput;
    const instructorId = req.userId;
    const course = await updateCourse(id, req.workspaceId!, input);
    return res.status(200).json(course);
  },
);

// delete course
coursesRouter.delete(
  "/:id",
  requireAuth,
  workspaceAuth,
  validate(courseIdSchema, "params"),
  validate(updateCourseSchema, "body"),
  async (req: Request, res: Response) => {
    if (req.userId === undefined) {
      throw new AppError("UNAUTHENTICATED", "Missing user id");
    }
    const { id } = req.validated!.params as { id: number };

    await deleteCourse(id, req.workspaceId!);
    return res.status(204).send();
  },
);

//throw exception on fails for the api calls
