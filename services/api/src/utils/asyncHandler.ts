import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wrapper for async route handlers to catch errors and pass to error middleware
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
