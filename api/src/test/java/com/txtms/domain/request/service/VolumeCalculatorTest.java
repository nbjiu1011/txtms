package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.response.Volume;
import com.txtms.domain.request.entity.FileUnit;
import com.txtms.domain.request.service.VolumeCalculator.ContentInput;
import com.txtms.domain.request.service.VolumeCalculator.FileInput;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class VolumeCalculatorTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private JsonNode payload(String raw) {
        return json.readTree(raw);
    }

    @Test
    void countsBodyCharactersIncludingSpacesAndLineBreaksButNotButtonsOrTitles() {
        ContentInput c = new ContentInput(payload(
                "{\"templateCode\":\"T\",\"body\":\"안녕 #{name}\\n님\",\"buttons\":[{\"name\":\"자세히 보기\",\"link\":\"https://a\"}]}"),
                List.of());
        Volume v = VolumeCalculator.compute(ContentType.ALIMTALK, List.of(c));
        assertThat(v.chars()).isEqualTo("안녕 #{name}\n님".length());
        assertThat(v.files()).isEmpty();
    }

    @Test
    void sumsAcrossContentsAndSkipsContentsWithAttachments() {
        ContentInput sms = new ContentInput(payload("{\"sender\":\"1588\",\"body\":\"12345\",\"customerCenter\":true}"),
                List.of());
        ContentInput sms2 = new ContentInput(payload("{\"sender\":\"1588\",\"body\":\"abc\"}"), List.of());
        assertThat(VolumeCalculator.compute(ContentType.SMS, List.of(sms, sms2)).chars()).isEqualTo(8);

        ContentInput withFile = new ContentInput(payload("{\"title\":\"제목\",\"text\":\"본문 텍스트\"}"),
                List.of(new FileInput(FileUnit.PAGE, 6)));
        ContentInput textOnly = new ContentInput(payload("{\"title\":\"긴 제목입니다\",\"text\":\"본문\"}"), List.of());
        Volume v = VolumeCalculator.compute(ContentType.FREEFORM, List.of(withFile, textOnly));
        assertThat(v.chars()).isEqualTo(2);
        assertThat(v.files()).containsExactly(new Volume.FileVolume(FileUnit.PAGE, 6));
    }

    @Test
    void rcsCountsCardBodiesOnly() {
        ContentInput rcs = new ContentInput(payload(
                "{\"cards\":[{\"title\":\"제목\",\"body\":\"abcd\",\"buttonName\":\"버튼\"},{\"title\":\"t\",\"body\":\"ef\"}]}"),
                List.of());
        assertThat(VolumeCalculator.compute(ContentType.RCS, List.of(rcs)).chars()).isEqualTo(6);
    }

    @Test
    void fileAmountsAreSummedPerUnitAndNeverAcrossUnits() {
        ContentInput a = new ContentInput(payload("{\"title\":\"\",\"text\":\"\"}"),
                List.of(new FileInput(FileUnit.PAGE, 6), new FileInput(FileUnit.ROW, 100)));
        ContentInput b = new ContentInput(payload("{\"title\":\"\",\"text\":\"\"}"),
                List.of(new FileInput(FileUnit.PAGE, 4), new FileInput(FileUnit.IMAGE, null)));
        Volume v = VolumeCalculator.compute(ContentType.FREEFORM, List.of(a, b));
        assertThat(v.files()).containsExactly(new Volume.FileVolume(FileUnit.PAGE, 10),
                new Volume.FileVolume(FileUnit.ROW, 100), new Volume.FileVolume(FileUnit.IMAGE, 0));
        assertThat(v.chars()).isZero();
    }

    @Test
    void countsUtf16CodeUnitsLikeTheBrowser() {
        ContentInput emoji = new ContentInput(payload("{\"body\":\"😀a\"}"), List.of());
        assertThat(VolumeCalculator.compute(ContentType.SMS, List.of(emoji)).chars()).isEqualTo(3);
    }
}
