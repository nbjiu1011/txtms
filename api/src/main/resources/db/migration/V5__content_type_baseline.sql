-- Reference data every environment needs, demo mode or not (contract §17.7). Until now only the demo seed wrote
-- these rows, so a database without demo data could not create requests ("사용 중인 유형만 선택할 수 있습니다").
-- Existing rows are kept (an operator may have switched a type off); only RCS is forced off: it is deferred from
-- Phase 1 (client decision 2026-10-12) and stays in the enum for existing RCS requests only.

INSERT IGNORE INTO content_types (type, active, mock_enabled, sort_order, updated_at, updated_by) VALUES
    ('ALIMTALK', 1, 1, 1, UTC_TIMESTAMP(6), NULL),
    ('SMS',      1, 1, 2, UTC_TIMESTAMP(6), NULL),
    ('RCS',      0, 0, 3, UTC_TIMESTAMP(6), NULL),
    ('FREEFORM', 1, 0, 4, UTC_TIMESTAMP(6), NULL);

UPDATE content_types SET active = 0, mock_enabled = 0, updated_at = UTC_TIMESTAMP(6) WHERE type = 'RCS';

INSERT IGNORE INTO writing_guides (type, principles, good_expressions, checklist, updated_at, updated_by) VALUES
    ('ALIMTALK',
     '정보성 메시지만 발송합니다. 승인된 템플릿의 고정 문구는 바꾸지 않고, 변수 위치만 채웁니다.\n버튼명은 동작을 그대로 설명합니다.',
     '[{"avoid":"클릭하세요","prefer":"버튼을 눌러 확인하세요"},{"avoid":"혜택을 드립니다","prefer":"혜택을 받으실 수 있습니다"}]',
     '["템플릿 고정 문구 변경 없음","변수 표기 #{변수명} 확인","버튼 링크 도메인 확인","개인정보 노출 여부"]',
     UTC_TIMESTAMP(6), NULL),
    ('SMS',
     '광고성 문자는 첫머리에 (광고)를 표기하고 수신거부 안내를 포함합니다. 발신번호는 등록된 번호만 사용합니다.',
     '[{"avoid":"금일","prefer":"오늘"},{"avoid":"익일","prefer":"다음 날"}]',
     '["(광고) 표기","무료 수신거부 번호","발신번호 등록 여부","90바이트 초과 시 장문 전환 확인"]',
     UTC_TIMESTAMP(6), NULL),
    ('FREEFORM',
     '문서 파일은 실제 검수할 범위를 먼저 적습니다. 수정본은 새 버전으로 올립니다.',
     '[{"avoid":"하였습니다","prefer":"했습니다"}]',
     '["검수 범위 입력","파일 버전 확인"]',
     UTC_TIMESTAMP(6), NULL);
