import { buildJsonSchemas } from "fastify-zod";
import { TypeOf, string, z } from "zod";


const createUserSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email(),
  name: z.string().optional(),
  password: z.string({
    required_error: "password is required",
    invalid_type_error: "password must be a string",
  }),
  picture: z.string().optional()
});


const loginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string({
    required_error: "Email is required",
  })
})

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginUserInput = z.infer<typeof loginSchema>;
export type forgotPassword = z.infer<typeof forgotPasswordSchema>

export const { schemas: userSchemas, $ref } = buildJsonSchemas({
  createUserSchema,
  loginSchema,
  forgotPasswordSchema
});