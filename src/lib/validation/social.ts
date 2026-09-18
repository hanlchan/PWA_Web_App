import { z } from "zod";

export const userSearchSchema = z.string().trim().min(2, "至少输入 2 个字符").max(30, "搜索内容不能超过 30 个字符");
export const socialIdSchema = z.string().uuid("对象编号无效");
