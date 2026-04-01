-- 다중 정답 지원을 위해 Answer 테이블의 (submissionId, questionId) 유니크 제약 제거
-- 이전: 한 응시에서 하나의 문제에 하나의 답안만 허용
-- 이후: 한 응시에서 하나의 문제에 여러 선택지 선택 가능 (복수 정답 문제 지원)

DROP INDEX IF EXISTS "answers_submissionId_questionId_key";
