package com.txtms.domain.request.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.Test;

import com.txtms.global.exception.ErrorCode;

class FileInspectorTest {

    private static final long MAX = 20L * 1024 * 1024;

    static byte[] pdf() {
        return "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n".getBytes(StandardCharsets.US_ASCII);
    }

    static byte[] png() {
        return new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    }

    static byte[] zip(String... entries) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(out)) {
            for (String e : entries) {
                zip.putNextEntry(new ZipEntry(e));
                zip.write("<x/>".getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            zip.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void rejected(String name, byte[] content, String message) {
        assertThatThrownBy(() -> FileInspector.inspect(name, content, MAX))
                .isInstanceOfSatisfying(FileRejectedException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.FILE_REJECTED);
                    assertThat(e.getMessage()).isEqualTo(message);
                });
    }

    @Test
    void acceptsAllowedFilesWithMatchingSignatures() {
        assertThat(FileInspector.inspect("약관 개정안.PDF", pdf(), MAX)).isEqualTo("pdf");
        assertThat(FileInspector.inspect("a.png", png(), MAX)).isEqualTo("png");
        assertThat(FileInspector.inspect("a.jpg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}, MAX))
                .isEqualTo("jpg");
        assertThat(FileInspector.inspect("a.hwp", new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0,
                (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1, 0}, MAX)).isEqualTo("hwp");
        assertThat(FileInspector.inspect("a.docx", zip("[Content_Types].xml", "word/document.xml"), MAX))
                .isEqualTo("docx");
        assertThat(FileInspector.inspect("a.xlsx", zip("[Content_Types].xml", "xl/workbook.xml"), MAX))
                .isEqualTo("xlsx");
        assertThat(FileInspector.inspect("a.pptx", zip("[Content_Types].xml", "ppt/presentation.xml"), MAX))
                .isEqualTo("pptx");
        assertThat(FileInspector.inspect("a.txt", "줄 1\n줄 2".getBytes(StandardCharsets.UTF_8), MAX))
                .isEqualTo("txt");
    }

    @Test
    void rejectsDisallowedAndDoubleExtensions() {
        rejected("run.exe", new byte[] {1}, "허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG");
        rejected("noext", new byte[] {1}, "허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG");
        rejected("a.jpeg", new byte[] {1}, "허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG");
        rejected("invoice.pdf.exe", new byte[] {1}, "이중 확장자 파일은 올릴 수 없습니다");
    }

    @Test
    void rejectsFakeSignatures() {
        rejected("fake.pdf", "just text".getBytes(StandardCharsets.US_ASCII), "확장자와 실제 파일 시그니처가 다릅니다");
        rejected("fake.png", pdf(), "확장자와 실제 파일 시그니처가 다릅니다");
        rejected("fake.hwp", pdf(), "확장자와 실제 파일 시그니처가 다릅니다");
        rejected("tiny.jpg", new byte[] {(byte) 0xFF}, "확장자와 실제 파일 시그니처가 다릅니다");
    }

    @Test
    void checksOfficeStructure() {
        rejected("a.docx", pdf(), "올바른 Office 파일이 아닙니다");
        rejected("a.docx", new byte[] {0x50, 0x4B, 3, 4, 0, 0}, "올바른 Office 파일이 아닙니다");
        rejected("a.docx", zip("[Content_Types].xml", "xl/workbook.xml"), "Office 내부 문서 형식이 확장자와 다릅니다");
        rejected("a.xlsx", zip("xl/workbook.xml"), "Office 내부 문서 형식이 확장자와 다릅니다");
    }

    @Test
    void checksPlainText() {
        rejected("a.txt", new byte[] {'a', 0, 'b'}, "텍스트 파일 형식 검증 실패");
        rejected("a.txt", "hello <SCRIPT>alert(1)</script>".getBytes(StandardCharsets.US_ASCII), "텍스트 파일 형식 검증 실패");
        rejected("a.txt", new byte[] {'M', 'Z', (byte) 0x90, 0x41}, "텍스트 파일 형식 검증 실패");
        // a script tag after the first 512 bytes is not inspected
        byte[] late = new byte[600];
        Arrays.fill(late, (byte) 'a');
        System.arraycopy("<script".getBytes(StandardCharsets.US_ASCII), 0, late, 590, 7);
        assertThat(FileInspector.inspect("a.txt", Arrays.copyOf(late, 597), MAX)).isEqualTo("txt");
    }

    @Test
    void rejectsOversizeFiles() {
        byte[] big = new byte[21];
        System.arraycopy(pdf(), 0, big, 0, 5);
        assertThatThrownBy(() -> FileInspector.inspect("a.pdf", big, 20))
                .isInstanceOf(FileRejectedException.class)
                .hasMessage("파일당 최대 0MB입니다");
        assertThat(FileInspector.inspect("a.pdf", Arrays.copyOf(big, 20), 20)).isEqualTo("pdf");
    }

    @Test
    void baseNameDropsClientPaths() {
        assertThat(FileInspector.baseName("C:\\Users\\me\\약관.pdf")).isEqualTo("약관.pdf");
        assertThat(FileInspector.baseName("../../etc/passwd.txt")).isEqualTo("passwd.txt");
        assertThat(FileInspector.extensionOf("A.B.Docx")).isEqualTo("docx");
    }

    @Test
    void eicarIsUnsafeAndDemoOutcomesOnlyInDemoMode() {
        byte[] eicar = ("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
                .getBytes(StandardCharsets.US_ASCII);
        DemoMalwareScanner demo = new DemoMalwareScanner(TestProperties.withDemo(true));
        DemoMalwareScanner production = new DemoMalwareScanner(TestProperties.withDemo(false));
        assertThat(demo.scan(eicar, null)).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.UNSAFE);
        assertThat(production.scan(eicar, "SAFE")).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.UNSAFE);
        assertThat(demo.scan(pdf(), null)).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.SAFE);
        assertThat(demo.scan(pdf(), "failed")).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.FAILED);
        assertThat(demo.scan(pdf(), "UNSAFE")).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.UNSAFE);
        assertThat(demo.scan(pdf(), "bogus")).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.SAFE);
        assertThat(production.scan(pdf(), "FAILED")).isEqualTo(com.txtms.domain.request.entity.FileScanStatus.SAFE);
    }
}
