package com.txtms.domain.request.file;

import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** An upload that must not be stored. The message is shown to the user and written to the history. */
public class FileRejectedException extends BusinessException {

    public FileRejectedException(String message) {
        super(ErrorCode.FILE_REJECTED, message);
    }
}
