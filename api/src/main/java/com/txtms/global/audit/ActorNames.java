package com.txtms.global.audit;

import java.util.Collection;
import java.util.Map;

/** Port resolving actor ids to display names for audit listings (implemented by the user domain). */
public interface ActorNames {

    Map<Long, String> namesOf(Collection<Long> userIds);
}
