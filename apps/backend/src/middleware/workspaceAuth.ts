import { AppError } from "../lib/errors.js";
import { getWorkspaceByOwner } from "../services/workspaces.service.js";
import type { NextFunction, Request, Response } from "express";


export async function workspaceAuth(req: Request, _res: Response, next: NextFunction){
    if(req.userId === undefined)
        return next(new AppError("UNAUTHENTICATED","missing user id"));
    
    const workspace = await getWorkspaceByOwner(req.userId);
    if(!workspace) return next(new AppError("FORBIDDEN","no work space for this user"));
    req.workpsaceId = workspace.id;
    next();

}