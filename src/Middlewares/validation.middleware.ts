import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError, ZodSchema } from "zod";
import { ServiceResponse } from "../utils/service-response";

export const handleServiceResponse = (
  serviceResponse: ServiceResponse<any>,
  response: Response,
) => {
  return response.status(serviceResponse.statusCode).send(serviceResponse);
};

type ValidationTarget = "body" | "params" | "query";

const validateRequest =
  (schema: ZodSchema, target: ValidationTarget = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req[target]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errorMessage = `Validation failed: ${err.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`;

        const serviceResponse = ServiceResponse.failure(
          errorMessage,
          null,
          StatusCodes.BAD_REQUEST,
        );

        return handleServiceResponse(serviceResponse, res);
      }

      const serviceResponse = ServiceResponse.failure(
        "An unexpected error occurred",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );

      return handleServiceResponse(serviceResponse, res);
    }
  };

export default validateRequest;
