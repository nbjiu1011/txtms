package com.txtms.domain.customer.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * The single gate of the customer admin API (contract §10 notice management, §11). The caller must administer the
 * customer: users who can see the customer but do not administer it (its own users, operators) get
 * {@code FORBIDDEN} "고객사 관리자 권한이 필요합니다"; anyone else {@code NOT_FOUND}.
 */
@Service
@Transactional(readOnly = true)
public class CustomerAdminAccess {

    public static final String ADMIN_REQUIRED = "고객사 관리자 권한이 필요합니다";

    private final ProjectAccess projectAccess;
    private final UserService userService;

    public CustomerAdminAccess(ProjectAccess projectAccess, UserService userService) {
        this.projectAccess = projectAccess;
        this.userService = userService;
    }

    /** The calling admin and the customer they administer. */
    public record Admin(User user, Customer customer) {

        public long userId() {
            return user.getId();
        }

        public long customerId() {
            return customer.getId();
        }
    }

    public Admin require(AuthUser auth, long customerId) {
        User user = userService.require(auth.userId());
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        if (!userService.actorOf(user).adminOf(customer.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, ADMIN_REQUIRED);
        }
        return new Admin(user, customer);
    }

    /** A user of the administered customer (pending and inactive included); other users NOT_FOUND. */
    public User requireCustomerUser(Admin admin, long userId) {
        User target = userService.find(userId).orElseThrow(BusinessException::notFound);
        if (!admin.customer().getId().equals(target.getCustomerId())) {
            throw BusinessException.notFound();
        }
        return target;
    }
}
