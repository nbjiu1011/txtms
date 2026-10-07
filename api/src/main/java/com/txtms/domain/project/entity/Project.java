package com.txtms.domain.project.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import com.txtms.global.common.BaseEntity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

/** Work unit of a customer. Roles are granted per project; the lead reviewer is a project attribute. */
@Entity
@Table(name = "projects")
public class Project extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private Long customerId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "lead_user_id")
    private Long leadUserId;

    /** Only changed by an atomic increment query (never written from a loaded entity). */
    @Column(name = "variables_revision", nullable = false, updatable = false)
    private int variablesRevision;

    @Column(name = "created_by")
    private Long createdBy;

    @ElementCollection
    @CollectionTable(name = "project_members", joinColumns = @JoinColumn(name = "project_id"))
    private Set<ProjectMember> members = new HashSet<>();

    @ElementCollection
    @CollectionTable(name = "project_templates", joinColumns = @JoinColumn(name = "project_id"))
    @OrderColumn(name = "sort_order")
    private List<ProjectTemplate> templates = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "project_senders", joinColumns = @JoinColumn(name = "project_id"))
    @OrderColumn(name = "sort_order")
    @Column(name = "sender_number", length = 20)
    private List<String> senders = new ArrayList<>();

    protected Project() {
    }

    public Project(Long customerId, String name, Long createdBy, Instant now) {
        this.customerId = customerId;
        this.name = name;
        this.active = true;
        this.createdBy = createdBy;
        initTimestamps(now);
    }

    public void addRole(Long userId, ProjectRole role) {
        members.add(new ProjectMember(userId, role));
    }

    /** Sets the lead reviewer; the lead always holds the reviewer role. */
    public void assignLead(Long userId) {
        this.leadUserId = userId;
        if (userId != null) {
            addRole(userId, ProjectRole.REVIEWER);
        }
    }

    public void rename(String name, Instant now) {
        this.name = name;
        touch(now);
    }

    public void changeActive(boolean active, Instant now) {
        this.active = active;
        touch(now);
    }

    /** Replaces the user's roles in this project; an empty set removes the membership. */
    public void replaceRoles(Long userId, Set<ProjectRole> roles) {
        members.removeIf(m -> m.getUserId().equals(userId));
        roles.forEach(r -> addRole(userId, r));
    }

    /** The approver role goes to exactly the given users (everyone else loses it; other roles are kept). */
    public void replaceApprovers(Set<Long> approverIds) {
        members.removeIf(m -> m.getRole() == ProjectRole.APPROVER && !approverIds.contains(m.getUserId()));
        approverIds.forEach(id -> addRole(id, ProjectRole.APPROVER));
    }

    /** Users holding the role, ordered by id. */
    public List<Long> usersWithRole(ProjectRole role) {
        return members.stream().filter(m -> m.getRole() == role).map(ProjectMember::getUserId).sorted().toList();
    }

    public void addTemplate(String code, String templateName) {
        templates.add(new ProjectTemplate(code, templateName));
    }

    public void addSender(String number) {
        senders.add(number);
    }

    /**
     * Replaces the registered Alimtalk templates (order kept). A new collection instance makes Hibernate delete and
     * re-insert the rows, so reordering never trips the unique (project, code) key with in-place updates.
     */
    public void replaceTemplates(List<ProjectTemplate> next, Instant now) {
        this.templates = new ArrayList<>(next);
        touch(now);
    }

    /** Replaces the registered sender numbers (order kept; rows are re-inserted like the templates). */
    public void replaceSenders(List<String> next, Instant now) {
        this.senders = new ArrayList<>(next);
        touch(now);
    }

    public Set<ProjectRole> rolesOf(Long userId) {
        Set<ProjectRole> roles = EnumSet.noneOf(ProjectRole.class);
        for (ProjectMember m : members) {
            if (m.getUserId().equals(userId)) {
                roles.add(m.getRole());
            }
        }
        return roles;
    }

    /** Roles per user, ordered by user id. */
    public Map<Long, Set<ProjectRole>> roleMap() {
        Map<Long, Set<ProjectRole>> map = new TreeMap<>();
        for (ProjectMember m : members) {
            map.computeIfAbsent(m.getUserId(), k -> EnumSet.noneOf(ProjectRole.class)).add(m.getRole());
        }
        return map;
    }

    public Long getId() {
        return id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }

    public Long getLeadUserId() {
        return leadUserId;
    }

    public int getVariablesRevision() {
        return variablesRevision;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public List<ProjectTemplate> getTemplates() {
        return List.copyOf(templates);
    }

    public List<String> getSenders() {
        return List.copyOf(senders);
    }
}
