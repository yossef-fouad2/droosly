import { Router, type Request, type Response } from "express";
import { createCourse, getCoursesByID, listCourses } from "../services/courses.service.js";
import { listCoursesQuerySchema ,type ListCoursesQueryInput, type courseSchemainput, courseIdSchema, createCourseSchema, type CreateCourseInput } from "../validation/schemas.js";
import { validate } from "../middleware/validate.js";
import requireAuth from "../middleware/requireAuth.js";
import { AppError } from "../lib/errors.js";

const coursesRouter = Router();
export default coursesRouter;

coursesRouter.get("/",
    validate(listCoursesQuerySchema, "query"),
    async (req: Request, res: Response) => {
        const result = await listCourses(req.validated as ListCoursesQueryInput);      
        return res.status(200).json(result);
});

coursesRouter.get("/:id",
    validate(courseIdSchema, "params"),
    async (req: Request, res: Response) =>{
        const result = await getCoursesByID((req.validated as { id: number }).id);
        if(!result){
            
        }
        return res.status(200).json(result);
        
});
coursesRouter.post("/",
    requireAuth,
    validate(createCourseSchema, "body"),
    async (req: Request, res: Response) => {
        if (req.userId === undefined) {
            throw new AppError("UNAUTHENTICATED", "Missing user id");
        }
        const input = req.validated as CreateCourseInput;
        const course = await createCourse(input, req.userId);
        return res.status(201).json(course);
    }
)

//throw exception on fails for the api calls