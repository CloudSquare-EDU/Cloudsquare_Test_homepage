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
