import { Router, type Request, type Response } from "express";
import { getCoursesByID, listCourses } from "../services/courses.service.js";
import { listCoursesQuerySchema ,type ListCoursesQueryInput, type courseSchemainput, courseIdSchema } from "../validation/schemas.js";
import { validate } from "../middleware/validate.js";

const coursesRouter = Router();
export default coursesRouter;

coursesRouter.get("/",
    validate(listCoursesQuerySchema, "query"),
    async (req: Request, res: Response) => {
        const result = await listCourses(req.validated as ListCoursesQueryInput);
        if(!result){
            
        }
        return res.status(200).json(result);
});

coursesRouter.get("/:Id",
    validate(courseIdSchema, "params"),
    async (req: Request, res: Response) =>{
        const result = await getCoursesByID((req.validated as { id: number }).id);
        if(!result){
            
        }
        return res.status(200).json(result);
        
});

//throw exception on fails for the api calls