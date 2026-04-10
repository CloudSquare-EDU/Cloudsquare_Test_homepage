// userController.ts
// 역할: /users 요청 처리 (전부 ADMIN 전용)

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { AuthRequest, ErrorCode } from '../types';
import { AppError } from '../middlewares/errorHandler';
import * as userService from '../services/userService';

const createUserSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  name: z.string().min(1, '이름을 입력해주세요.'),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN'], { required_error: 'role을 입력해주세요.' }),
});

export const getAllUsers = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await userService.createUser({
      ...input,
      role: input.role as Role | undefined,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.user?.userId === req.params.id) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, '자신의 권한은 변경할 수 없습니다.');
    }
    const { role } = updateRoleSchema.parse(req.body);
    const user = await userService.updateUserRole(req.params.id, role as Role);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const bulkCreateUserSchema = z.object({
  users: z
    .array(
      z.object({
        email: z.string().email('유효한 이메일을 입력해주세요.'),
        password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
        name: z.string().min(1, '이름을 입력해주세요.'),
        role: z.enum(['USER', 'ADMIN']).optional(),
      }),
    )
    .min(1, '최소 1명 이상의 사용자가 필요합니다.'),
});

export const bulkCreateUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { users } = bulkCreateUserSchema.parse(req.body);
    const result = await userService.bulkCreateUsers(
      users.map((u) => ({ ...u, role: u.role as Role | undefined })),
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// 관리자가 특정 사용자 비밀번호 초기화
export const resetUserPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const schema = z.object({
      password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    });
    const { password } = schema.parse(req.body);
    await userService.resetUserPassword(req.params.id, password);
    res.json({ success: true, data: { message: '비밀번호가 초기화되었습니다.' } });
  } catch (err) {
    next(err);
  }
};

// 본인 비밀번호 변경
export const changeMyPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요.'),
      newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.'),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);
    if (!req.user?.userId) throw new AppError(401, ErrorCode.UNAUTHORIZED, '인증이 필요합니다.');
    await userService.changeMyPassword(req.user.userId, currentPassword, newPassword);
    res.json({ success: true, data: { message: '비밀번호가 변경되었습니다.' } });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.user?.userId === req.params.id) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, '자신의 계정은 삭제할 수 없습니다.');
    }
    await userService.deleteUser(req.params.id);
    res.json({ success: true, data: { message: '사용자가 삭제되었습니다.' } });
  } catch (err) {
    next(err);
  }
};
