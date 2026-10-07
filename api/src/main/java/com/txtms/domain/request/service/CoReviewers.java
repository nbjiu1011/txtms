package com.txtms.domain.request.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

import com.txtms.domain.request.dto.response.RequestDetail;

/**
 * "공동 검수 결과" of the completion dialog (pure): the current reviewers in assignment order, then the users who are
 * no longer assigned but left opinions on the request (previous reviewers, by first opinion), each with their
 * opinion counts per round.
 */
public final class CoReviewers {

    /** One opinion: author and round, in creation order. */
    public record Opinion(long authorId, int round) {
    }

    private CoReviewers() {
    }

    public static List<RequestDetail.CoReviewer> of(List<Long> reviewers, Long primaryId, List<Opinion> opinions) {
        Set<Long> people = new LinkedHashSet<>(reviewers);
        opinions.forEach(o -> people.add(o.authorId()));
        List<RequestDetail.CoReviewer> out = new ArrayList<>();
        for (Long user : people) {
            Map<Integer, Integer> rounds = new TreeMap<>();
            opinions.stream().filter(o -> o.authorId() == user).forEach(o -> rounds.merge(o.round(), 1, Integer::sum));
            List<RequestDetail.RoundCount> counts = rounds.entrySet().stream()
                    .map(e -> new RequestDetail.RoundCount(e.getKey(), e.getValue())).toList();
            int total = counts.stream().mapToInt(RequestDetail.RoundCount::count).sum();
            out.add(new RequestDetail.CoReviewer(user, reviewers.contains(user), Objects.equals(primaryId, user),
                    total, counts));
        }
        return out;
    }
}
