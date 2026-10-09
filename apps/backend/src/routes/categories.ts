import { Router, type Request, type Response } from "express";
import { getAllCategories } from "../services/category.js";

const categoriesRouter = Router();

categoriesRouter.get("/", async (req: Request, res: Response) => {
  const result = await getAllCategories();
  if (!result) return;
  return res.status(200).json(result);
});

export default categoriesRouter;
