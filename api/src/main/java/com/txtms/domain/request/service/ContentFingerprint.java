package com.txtms.domain.request.service;

import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Comparable trees of a content state for change detection (MySQL may reorder JSON keys; trees compare by
 * content). Files are compared by id, current version and amounts, not by their version history or scan status.
 */
@Component
public class ContentFingerprint {

    private final JsonMapper json;

    public ContentFingerprint(JsonMapper json) {
        this.json = json;
    }

    /** Title, payload and files. */
    public JsonNode of(String title, String payload, String filesJson) {
        ObjectNode n = text(title, payload);
        n.set("files", stripFileVersions(json.readTree(filesJson)));
        return n;
    }

    /** Title and payload only (the "text" of the content). */
    public ObjectNode text(String title, String payload) {
        ObjectNode n = json.createObjectNode();
        n.put("title", title == null ? "" : title);
        n.set("payload", json.readTree(payload));
        return n;
    }

    private static JsonNode stripFileVersions(JsonNode files) {
        for (JsonNode f : files) {
            if (f instanceof ObjectNode o) {
                o.remove("versions");
                o.remove("scanStatus");
            }
        }
        return files;
    }
}
