// questionBankRoutes.ts
// 역할: /question-banks 라우트 — 전체 관리자 전용

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as ctrl from '../controllers/questionBankController';

export const questionBankRoutes = Router();

questionBankRoutes.use(authenticate, requireAdmin);

// 문제은행 CRUD
questionBankRoutes.get('/',           ctrl.listBanks);
questionBankRoutes.get('/:id',        ctrl.getBank);
questionBankRoutes.post('/',          ctrl.createBank);
questionBankRoutes.patch('/:id',      ctrl.updateBank);
questionBankRoutes.delete('/:id',     ctrl.deleteBank);

// 문제 CRUD
questionBankRoutes.post('/:id/questions',                    ctrl.addQuestion);
questionBankRoutes.patch('/:id/questions/:questionId',       ctrl.updateQuestion);
questionBankRoutes.delete('/:id/questions/:questionId',      ctrl.deleteQuestion);

// 엑셀 일괄 등록
questionBankRoutes.post('/:id/bulk',  ctrl.bulkImport);
