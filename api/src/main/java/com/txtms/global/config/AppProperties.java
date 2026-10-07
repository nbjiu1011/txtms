package com.txtms.global.config;

import java.time.Duration;
import java.util.List;

import org.springframework.util.unit.DataSize;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Application settings ({@code app.*}). Defaults live in application.yml. */
@ConfigurationProperties("app")
public record AppProperties(
        Jwt jwt,
        Session session,
        Auth auth,
        Lock lock,
        Audit audit,
        String webBaseUrl,
        Cors cors,
        Demo demo,
        Attachment attachment,
        Storage storage,
        Content content,
        Bulk bulk,
        Sms sms,
        Correction correction,
        Reminder reminder) {

    public record Jwt(String secret, Duration accessTokenTtl) {
    }

    public record Session(Duration idleTimeout, Duration rememberDuration, Duration touchInterval) {
    }

    public record Auth(
            String refreshCookieName,
            boolean refreshCookieSecure,
            int loginMaxFailures,
            Duration loginLockDuration,
            Duration passwordResetTtl,
            Duration invitationTtl) {
    }

    /** Edit lock idle time and the switch of the automatic release job. */
    public record Lock(Duration ttl, boolean releaseJobEnabled) {
    }

    /**
     * Access/export audit records (요청 조회, 파일 다운로드, 완료본 반출, 첨부 반출) are deleted {@code days} after they were
     * written by a daily job ({@code cron}, KST) that runs only when {@code enabled} (client agreement 17 pending).
     */
    public record Audit(Retention retention) {

        public record Retention(boolean enabled, int days, String cron) {
        }
    }

    /**
     * Re-notification of unfinished work (actions.md §8.3): at most {@code maxCount} reminders per request and user,
     * {@code interval} apart. The job runs every minute when {@code jobEnabled}.
     */
    public record Reminder(boolean jobEnabled, Duration interval, int maxCount) {
    }

    public record Cors(List<String> allowedOrigins) {
        public Cors {
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }

    /** Attachment limits per file and per request (card images are not counted). */
    public record Attachment(DataSize maxFileSize, int maxCount, DataSize maxTotalSize, DataSize maxImageSize) {
    }

    /** Local file storage root (stub until object storage is connected). */
    public record Storage(String localRoot) {
    }

    /**
     * Server-protection caps checked on every draft save, and the submit limits of the content types.
     */
    public record Content(int maxContentsPerRequest, int maxTextLength, int maxButtons, int maxCards,
            int maxInfoTextLength, int alimtalkBodyMax, int buttonNameMax, int smsBytesMax) {
    }

    /** XLSX bulk registration limits. */
    public record Bulk(int maxRows, DataSize maxFileSize) {
    }

    /** Notice lines appended to SMS bodies when the flags are set (counted in the LMS byte limit). */
    public record Sms(String customerCenterLine, String optOutLine) {
    }

    /**
     * Text correction: time budget of one pattern rule on one field, rules per dataset, dataset XLSX upload size.
     */
    public record Correction(Duration ruleTimeout, int maxRules, DataSize maxFileSize) {
    }

    public record Demo(boolean enabled, String defaultPassword) {
        public boolean hasDefaultPassword() {
            return defaultPassword != null && !defaultPassword.isBlank();
        }
    }
}
