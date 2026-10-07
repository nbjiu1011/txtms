package com.txtms.domain.request.file;

import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * An upload that must not be stored. The message is shown to the user and written to the history. The code is
 * {@code FILE_REJECTED}, or {@code FILE_UNSAFE} / {@code FILE_SCAN_FAILED} for malware scan outcomes (contract §14).
 */
public class FileRejectedException extends BusinessException {

    public FileRejectedException(String message) {
        super(ErrorCode.FILE_REJECTED, message);
    }

    public FileRejectedException(ErrorCode code, String message) {
        super(code, message);
    }
}
