package com.txtms.domain.request.policy;

/** Actions the current user may execute on a request now (contract {@code allowedActions}). */
public enum RequestAction {
    EDIT_REQUEST,
    EDIT_CONTENT,
    SUBMIT,
    /** Delete a draft that was never submitted (no workflow history to keep). */
    DELETE,
    CANCEL,
    RECALL,
    DECIDE_RECALL,
    ANSWER,
    ASSIGN,
    CHANGE_ASSIGNMENT,
    EDIT_DUE,
    /** Opinions, questions and text correction by an assigned reviewer. */
    REVIEW,
    COMPLETE,
    APPROVE,
    REVISE,
    CLONE,
    FOLLOW_UP,
    UNLOCK,
    EXPORT
}
