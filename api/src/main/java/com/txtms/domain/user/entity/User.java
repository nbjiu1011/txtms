package com.txtms.domain.user.entity;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import com.txtms.global.common.BaseEntity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

/** Account. Email is stored lower-cased and is globally unique. */
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null for solution operators. */
    @Column(name = "customer_id")
    private Long customerId;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String dept;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private boolean pending;

    @Column(nullable = false)
    private boolean operator;

    /** Demo persona account: can log in only while demo mode is enabled. */
    @Column(nullable = false)
    private boolean demo;

    @Column(name = "avatar_color", nullable = false, length = 7)
    private String avatarColor;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "customer_admins", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "customer_id")
    private Set<Long> adminCustomerIds = new HashSet<>();

    protected User() {
    }

    public User(Long customerId, String email, String name, String dept, boolean operator, boolean demo,
            String avatarColor, Instant now) {
        this.customerId = customerId;
        this.email = email.toLowerCase();
        this.name = name;
        this.dept = dept;
        this.active = true;
        this.pending = false;
        this.operator = operator;
        this.demo = demo;
        this.avatarColor = avatarColor;
        initTimestamps(now);
    }

    public void grantCustomerAdmin(Long customerId) {
        adminCustomerIds.add(customerId);
    }

    public void changePasswordHash(String passwordHash, Instant now) {
        this.passwordHash = passwordHash;
        touch(now);
    }

    public void updateProfile(String name, String dept, Instant now) {
        this.name = name;
        this.dept = dept;
        touch(now);
    }

    /** Invitation accepted: the pending account becomes active. */
    public void activateFromInvitation(String name, String passwordHash, Instant now) {
        if (!pending) {
            throw new IllegalStateException("user is not pending");
        }
        this.name = name;
        this.passwordHash = passwordHash;
        this.pending = false;
        this.active = true;
        touch(now);
    }

    public boolean isAdminOf(Long customerId) {
        return customerId != null && adminCustomerIds.contains(customerId);
    }

    public Long getId() {
        return id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public String getDept() {
        return dept;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isPending() {
        return pending;
    }

    public boolean isOperator() {
        return operator;
    }

    public boolean isDemo() {
        return demo;
    }

    public String getAvatarColor() {
        return avatarColor;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Set<Long> getAdminCustomerIds() {
        return Set.copyOf(adminCustomerIds);
    }
}
