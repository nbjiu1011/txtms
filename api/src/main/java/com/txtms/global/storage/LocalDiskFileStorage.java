package com.txtms.global.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.txtms.global.config.AppProperties;

/**
 * Local disk storage under {@code app.storage.local-root} ({@code yyyy/MM/uuid}).
 * TODO(stub): replace with object storage (S3 or similar) before production; local disk is not shared between
 * instances and has no backup.
 */
@Component
public class LocalDiskFileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalDiskFileStorage.class);
    private static final Pattern KEY = Pattern.compile("^\\d{4}/\\d{2}/[0-9a-f]{32}$");

    private final Path root;

    public LocalDiskFileStorage(AppProperties properties) {
        this.root = Path.of(properties.storage().localRoot()).toAbsolutePath().normalize();
        log.warn("File storage is a local-disk stub at {} (TODO: object storage)", root);
    }

    @Override
    public String store(byte[] content) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String key = String.format("%04d/%02d/%s", today.getYear(), today.getMonthValue(),
                UUID.randomUUID().toString().replace("-", ""));
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store file", e);
        }
        return key;
    }

    @Override
    public Optional<byte[]> read(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            return Optional.empty();
        }
        Path path = resolve(key);
        if (!Files.isRegularFile(path)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(path));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read file", e);
        }
    }

    @Override
    public boolean exists(String key) {
        return key != null && KEY.matcher(key).matches() && Files.isRegularFile(resolve(key));
    }

    @Override
    public void delete(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            log.warn("Could not delete stored file {}: {}", key, e.getMessage());
        }
    }

    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key");
        }
        return path;
    }
}
