import { z } from "zod";

export const passwordSchema = z.string().min(8, "密码至少需要 8 位").max(72, "密码不能超过 72 位");
export const emailSchema = z.string().trim().toLowerCase().email("请输入有效邮箱");

export const loginSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const registerSchema = loginSchema.extend({ confirmPassword: passwordSchema }).strict()
  .refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "两次密码不一致" });
export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: passwordSchema }).strict()
  .refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "两次密码不一致" });
