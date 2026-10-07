package com.txtms.global.storage;

import java.util.Optional;

/**
 * Binary storage of attachments and images. Objects are immutable: a stored key always returns the same bytes, so
 * clones and snapshots may share keys and nothing is overwritten.
 */
public interface FileStorage {

    /** Stores the bytes and returns a new opaque key. */
    String store(byte[] content);

    /** The stored bytes, or empty when the key is unknown. */
    Optional<byte[]> read(String key);

    /** Whether an object is stored under the key (without reading it). */
    boolean exists(String key);

    /**
     * Removes the object (sample data cleanup). Callers delete only keys no stored row references any more; unknown
     * keys are ignored.
     */
    void delete(String key);
}
