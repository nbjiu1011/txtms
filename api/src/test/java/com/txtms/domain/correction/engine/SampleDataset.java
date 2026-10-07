package com.txtms.domain.correction.engine;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

import com.txtms.domain.correction.service.DatasetRuleValidator;
import com.txtms.domain.correction.service.DatasetXlsxReader;

/** The client sample dataset ({@code docs/교정엔진 샘플 데이터셋.xlsx}, copied to the demo resources). */
public final class SampleDataset {

    public static final String RESOURCE = "/demo/correction-sample-dataset.xlsx";

    private static List<CorrectionRule> rules;

    private SampleDataset() {
    }

    public static synchronized List<CorrectionRule> rules() {
        if (rules == null) {
            try (InputStream in = SampleDataset.class.getResourceAsStream(RESOURCE)) {
                if (in == null) {
                    throw new IllegalStateException("missing " + RESOURCE);
                }
                rules = DatasetRuleValidator.validate(DatasetXlsxReader.read(in, 5000), 5000);
            } catch (com.txtms.global.exception.BusinessException e) {
                throw new IllegalStateException(e.getMessage() + " " + e.getDetails(), e);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return rules;
    }
}
