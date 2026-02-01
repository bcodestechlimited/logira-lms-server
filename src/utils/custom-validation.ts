import { z } from "zod";

export const validateObjectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const isValidEmail = (email: string) => {
  return z.string().email().safeParse(email).success;
};
