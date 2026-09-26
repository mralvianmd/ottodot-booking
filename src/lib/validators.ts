import { z } from "zod";

export const createBookingSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  classId: z.string().min(1, "classId is required"),
});

export const processPaymentSchema = z.object({
  success: z.boolean(),
});

export const classIdParamSchema = z.object({
  id: z.string().min(1, "class id is required"),
});

export const bookingIdParamSchema = z.object({
  id: z.string().min(1, "booking id is required"),
});

export const parentIdParamSchema = z.object({
  id: z.string().min(1, "parent id is required"),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
