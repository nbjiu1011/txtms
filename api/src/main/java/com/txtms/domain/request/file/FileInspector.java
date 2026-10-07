package com.txtms.domain.request.file;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Content checks of an uploaded attachment, in the order of the screen: allowed extension, size, magic number, Office
 * package structure, plain text. Office packages are checked by reading the ZIP central directory only (nothing is
 * inflated, so archive bombs cost nothing).
 */
public final class FileInspector {

    public static final List<String> ALLOWED = List.of("pdf", "docx", "hwp", "xlsx", "pptx", "txt", "png", "jpg");
    public static final List<String> IMAGES = List.of("png", "jpg");

    /** Extensions with a known review unit (also older formats) — used to spot double extensions. */
    private static final Set<String> KNOWN = Set.of("pdf", "doc", "docx", "hwp", "hwpx", "xls", "xlsx", "ppt", "pptx",
            "txt", "png", "jpg", "jpeg");

    private static final Map<String, int[]> SIGNATURES = Map.of(
            "pdf", new int[] {0x25, 0x50, 0x44, 0x46, 0x2D},
            "png", new int[] {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
            "jpg", new int[] {0xFF, 0xD8, 0xFF},
            "hwp", new int[] {0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1});

    private static final Map<String, String> OFFICE_MAIN = Map.of(
            "docx", "word/document.xml",
            "xlsx", "xl/workbook.xml",
            "pptx", "ppt/presentation.xml");

    private FileInspector() {
    }

    /** Lower-case extension of a file name ("" when there is none). */
    public static String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** File name without any client path, at most 255 characters. */
    public static String baseName(String filename) {
        if (filename == null) {
            return "";
        }
        String name = filename.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    /**
     * Checks an attachment and returns its extension.
     *
     * @throws FileRejectedException with the user-facing message
     */
    public static String inspect(String filename, byte[] content, long maxBytes) {
        String ext = extensionOf(filename);
        if (!ALLOWED.contains(ext)) {
            String[] parts = filename == null ? new String[0] : filename.toLowerCase(Locale.ROOT).split("\\.");
            if (parts.length > 2 && KNOWN.contains(parts[parts.length - 2])) {
                throw new FileRejectedException("이중 확장자 파일은 올릴 수 없습니다");
            }
            throw new FileRejectedException("허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG");
        }
        if (content.length > maxBytes) {
            throw new FileRejectedException("파일당 최대 " + maxBytes / (1024 * 1024) + "MB입니다");
        }
        checkSignature(ext, content);
        return ext;
    }

    /** Magic number, Office structure and text checks for an allowed extension. */
    public static void checkSignature(String ext, byte[] content) {
        int[] signature = SIGNATURES.get(ext);
        if (signature != null && !startsWith(content, signature)) {
            throw new FileRejectedException("확장자와 실제 파일 시그니처가 다릅니다");
        }
        if (OFFICE_MAIN.containsKey(ext)) {
            if (content.length < 2 || content[0] != 0x50 || content[1] != 0x4B) {
                throw new FileRejectedException("올바른 Office 파일이 아닙니다");
            }
            Set<String> entries = ZipDirectory.entryNames(content);
            if (entries == null) {
                throw new FileRejectedException("올바른 Office 파일이 아닙니다");
            }
            if (!entries.contains("[Content_Types].xml") || !entries.contains(OFFICE_MAIN.get(ext))) {
                throw new FileRejectedException("Office 내부 문서 형식이 확장자와 다릅니다");
            }
        }
        if (ext.equals("txt") && !plainText(content)) {
            throw new FileRejectedException("텍스트 파일 형식 검증 실패");
        }
    }

    /** First 512 bytes: no NUL byte, no script tag, no executable header. */
    static boolean plainText(byte[] content) {
        int n = Math.min(512, content.length);
        for (int i = 0; i < n; i++) {
            if (content[i] == 0) {
                return false;
            }
            if (i + 2 < n && content[i] == 0x4D && content[i + 1] == 0x5A && (content[i + 2] & 0xFF) == 0x90) {
                return false;
            }
        }
        String head = new String(content, 0, n, StandardCharsets.ISO_8859_1).toLowerCase(Locale.ROOT);
        return !head.contains("<script");
    }

    private static boolean startsWith(byte[] content, int[] signature) {
        if (content.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((content[i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }

    /** Minimal ZIP central directory reader (entry names only). */
    static final class ZipDirectory {

        private static final int EOCD = 0x06054b50;
        private static final int CENTRAL = 0x02014b50;

        private ZipDirectory() {
        }

        /** Entry names, or null when the bytes are not a readable ZIP archive. */
        static Set<String> entryNames(byte[] zip) {
            int eocd = -1;
            int min = Math.max(0, zip.length - 22 - 65_535);
            for (int i = zip.length - 22; i >= min; i--) {
                if (readInt(zip, i) == EOCD) {
                    eocd = i;
                    break;
                }
            }
            if (eocd < 0) {
                return null;
            }
            int count = readShort(zip, eocd + 10);
            long offset = readInt(zip, eocd + 16) & 0xFFFFFFFFL;
            if (offset >= zip.length) {
                return null;
            }
            Set<String> names = new HashSet<>();
            int pos = (int) offset;
            for (int n = 0; n < count; n++) {
                if (pos + 46 > zip.length || readInt(zip, pos) != CENTRAL) {
                    return null;
                }
                int nameLength = readShort(zip, pos + 28);
                int extraLength = readShort(zip, pos + 30);
                int commentLength = readShort(zip, pos + 32);
                if (pos + 46 + nameLength > zip.length) {
                    return null;
                }
                names.add(new String(zip, pos + 46, nameLength, StandardCharsets.UTF_8));
                pos += 46 + nameLength + extraLength + commentLength;
            }
            return names;
        }

        private static int readShort(byte[] b, int i) {
            if (i < 0 || i + 2 > b.length) {
                return 0;
            }
            return (b[i] & 0xFF) | (b[i + 1] & 0xFF) << 8;
        }

        private static int readInt(byte[] b, int i) {
            if (i < 0 || i + 4 > b.length) {
                return 0;
            }
            return (b[i] & 0xFF) | (b[i + 1] & 0xFF) << 8 | (b[i + 2] & 0xFF) << 16 | (b[i + 3] & 0xFF) << 24;
        }
    }
}
