package com.txtms.domain.ops.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * The operator gate of {@code /api/ops/**} (also enforced for every path by {@link OpsAccessInterceptor}).
 * Operators have no customer; any other signed-in user gets {@code FORBIDDEN}.
 */
@Service
@Transactional(readOnly = true)
public class OperatorAccess {

    public static final String OPERATOR_REQUIRED = "운영 담당자 권한이 필요합니다";
    public static final String RESET_REQUIRED = "시연 데이터 초기화는 솔루션 운영 담당자만 실행할 수 있습니다";

    private final UserService users;

    public OperatorAccess(UserService users) {
        this.users = users;
    }

    public User require(AuthUser auth) {
        return require(auth, OPERATOR_REQUIRED);
    }

    public User require(AuthUser auth, String message) {
        if (auth == null) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }
        User user = users.find(auth.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, message));
        if (!user.isOperator() || !users.canUseAccount(user)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
        return user;
    }
}
