package com.txtms.domain.request.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.global.storage.FileStorage;

/**
 * Physical deletion of requests with all their rows: the operator's sample cleanup and a requester deleting a draft
 * that was never submitted.
 */
@Component
public class RequestPurger {

    private static final Logger log = LoggerFactory.getLogger(RequestPurger.class);

    private final RequestRepository requests;
    private final NamedParameterJdbcTemplate named;
    private final FileStorage storage;

    public RequestPurger(RequestRepository requests, JdbcTemplate jdbc, FileStorage storage) {
        this.requests = requests;
        this.named = new NamedParameterJdbcTemplate(jdbc);
        this.storage = storage;
    }

    /**
     * Physically deletes the requests and every child row (contents, versions, attachments, images, history,
     * opinions, questions, assignment changes, reminders, correction suggestions, completion bundles, the
     * notifications about them). Parent links pointing at removed requests are cleared. Stored objects that no
     * remaining row references are deleted after the commit (clones and follow-ups share objects, so shared ones
     * stay). Returns the number of removed requests.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int purge(Collection<String> requestIds) {
        if (requestIds.isEmpty()) {
            return 0;
        }
        requests.flush();
        MapSqlParameterSource ids = new MapSqlParameterSource("ids", new ArrayList<>(new LinkedHashSet<>(requestIds)));
        List<String> locked = named.queryForList("SELECT id FROM requests WHERE id IN (:ids) FOR UPDATE", ids,
                String.class);
        if (locked.isEmpty()) {
            return 0;
        }
        ids = new MapSqlParameterSource("ids", locked);
        String contentIds = "SELECT id FROM contents WHERE request_id IN (:ids)";
        String fileIds = "SELECT id FROM content_files WHERE content_id IN (" + contentIds + ")";
        Set<String> keys = new HashSet<>(named.queryForList("SELECT storage_key FROM content_file_versions "
                + "WHERE storage_key IS NOT NULL AND file_id IN (" + fileIds + ")", ids, String.class));
        keys.addAll(named.queryForList("SELECT storage_key FROM content_images WHERE request_id IN (:ids)", ids,
                String.class));

        named.update("UPDATE requests SET parent_request_id = NULL, parent_content_key = NULL "
                + "WHERE parent_request_id IN (:ids)", ids);
        named.update("UPDATE contents SET parent_request_id = NULL, parent_content_key = NULL "
                + "WHERE parent_request_id IN (:ids)", ids);
        for (String table : List.of("notifications", "request_reminders", "request_assignment_changes",
                "request_opinions", "request_asks", "request_history", "correction_suggestions",
                "completion_bundle_items", "completion_bundles", "content_images")) {
            named.update("DELETE FROM " + table + " WHERE request_id IN (:ids)", ids);
        }
        named.update("DELETE FROM content_file_versions WHERE file_id IN (SELECT id FROM (" + fileIds + ") f)", ids);
        named.update("DELETE FROM content_files WHERE content_id IN (SELECT id FROM (" + contentIds + ") c)", ids);
        named.update("DELETE FROM content_versions WHERE content_id IN (SELECT id FROM (" + contentIds + ") c)", ids);
        named.update("DELETE FROM contents WHERE request_id IN (:ids)", ids);
        named.update("DELETE FROM request_reviewers WHERE request_id IN (:ids)", ids);
        int removed = named.update("DELETE FROM requests WHERE id IN (:ids)", ids);

        if (!keys.isEmpty()) {
            MapSqlParameterSource k = new MapSqlParameterSource("keys", keys);
            Set<String> stillUsed = new HashSet<>(named.queryForList("SELECT storage_key FROM content_file_versions "
                    + "WHERE storage_key IN (:keys)", k, String.class));
            stillUsed.addAll(named.queryForList("SELECT storage_key FROM content_images WHERE storage_key IN (:keys)",
                    k, String.class));
            keys.removeAll(stillUsed);
            deleteAfterCommit(keys);
        }
        return removed;
    }

    private void deleteAfterCommit(Set<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        List<String> toDelete = List.copyOf(keys);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                toDelete.forEach(storage::delete);
                log.info("Removed {} stored objects of deleted requests", toDelete.size());
            }
        });
    }
}
