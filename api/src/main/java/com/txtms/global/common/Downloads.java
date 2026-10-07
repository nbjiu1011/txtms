package com.txtms.global.common;

import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Binary download responses with an RFC 6266 / RFC 5987 Content-Disposition (ASCII fallback + UTF-8 name). */
public final class Downloads {

    private Downloads() {
    }

    public static ResponseEntity<byte[]> attachment(String fileName, String mimeType, byte[] content) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition("attachment", fileName))
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(mimeType))
                .contentLength(content.length)
                .body(content);
    }

    public static ResponseEntity<byte[]> inline(String mimeType, byte[] content) {
        return ResponseEntity.ok()
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(mimeType))
                .contentLength(content.length)
                .body(content);
    }

    public static String contentDisposition(String type, String fileName) {
        StringBuilder fallback = new StringBuilder();
        for (char ch : fileName.toCharArray()) {
            fallback.append(ch >= 0x20 && ch < 0x7F && ch != '"' && ch != '\\' ? ch : '_');
        }
        return type + "; filename=\"" + fallback + "\"; filename*=UTF-8''" + encode(fileName);
    }

    /** RFC 5987 attr-char percent encoding. */
    static String encode(String value) {
        StringBuilder out = new StringBuilder();
        for (byte b : value.getBytes(StandardCharsets.UTF_8)) {
            int c = b & 0xFF;
            boolean attrChar = c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9'
                    || "!#$&+-.^_`|~".indexOf(c) >= 0;
            if (attrChar) {
                out.append((char) c);
            } else {
                out.append('%').append(String.format("%02X", c));
            }
        }
        return out.toString();
    }
}
