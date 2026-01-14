/**
 * IDX Market Hours Utilities
 * Indonesia Stock Exchange trading hours (WIB/GMT+7)
 */

/**
 * Check if given timestamp is during market hours
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns true if market is open
 */
export function isMarketOpen(timestamp: number): boolean {
    const date = new Date(timestamp);
    const day = date.getDay(); // 0=Sunday, 6=Saturday
    const hour = date.getHours();
    const minute = date.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // Weekend - market closed
    if (day === 0 || day === 6) {
        return false;
    }

    // Friday has different hours
    if (day === 5) {
        // Session 1: 09:00 - 11:30
        // Lunch: 11:30 - 14:00
        // Session 2: 14:00 - 16:00
        return (
            (totalMinutes >= 9 * 60 && totalMinutes < 11 * 60 + 30) ||
            (totalMinutes >= 14 * 60 && totalMinutes < 16 * 60)
        );
    }

    // Monday-Thursday
    // Session 1: 09:00 - 12:00
    // Lunch: 12:00 - 13:30
    // Session 2: 13:30 - 16:00
    return (
        (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) ||
        (totalMinutes >= 13 * 60 + 30 && totalMinutes < 16 * 60)
    );
}

/**
 * Get next market open time from given timestamp
 *
 * @param timestamp - Current timestamp
 * @returns Next market open timestamp
 */
export function getNextOpenTime(timestamp: number): number {
    const date = new Date(timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // If weekend, jump to Monday 09:00
    if (day === 0) {
        // Sunday → Monday
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return date.getTime();
    }

    if (day === 6) {
        // Saturday → Monday
        date.setDate(date.getDate() + 2);
        date.setHours(9, 0, 0, 0);
        return date.getTime();
    }

    // Friday
    if (day === 5) {
        // Before market open
        if (totalMinutes < 9 * 60) {
            date.setHours(9, 0, 0, 0);
            return date.getTime();
        }

        // During lunch (11:30-14:00)
        if (totalMinutes >= 11 * 60 + 30 && totalMinutes < 14 * 60) {
            date.setHours(14, 0, 0, 0);
            return date.getTime();
        }

        // After market close → Monday 09:00
        if (totalMinutes >= 16 * 60) {
            date.setDate(date.getDate() + 3); // Friday → Monday
            date.setHours(9, 0, 0, 0);
            return date.getTime();
        }

        return timestamp; // Already open
    }

    // Monday-Thursday
    // Before market open
    if (totalMinutes < 9 * 60) {
        date.setHours(9, 0, 0, 0);
        return date.getTime();
    }

    // During lunch (12:00-13:30)
    if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60 + 30) {
        date.setHours(13, 30, 0, 0);
        return date.getTime();
    }

    // After market close → next day 09:00
    if (totalMinutes >= 16 * 60) {
        const nextDay = day === 4 ? 3 : 1; // Thursday → Monday (+3), else +1
        date.setDate(date.getDate() + nextDay);
        date.setHours(9, 0, 0, 0);
        return date.getTime();
    }

    // Currently open
    return timestamp;
}

/**
 * Get session info for given timestamp
 */
export function getSessionInfo(timestamp: number): {
    isOpen: boolean;
    session: 'pre-market' | 'session-1' | 'lunch' | 'session-2' | 'closed';
    nextChange: number; // timestamp of next session change
} {
    const date = new Date(timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // Weekend
    if (day === 0 || day === 6) {
        return {
            isOpen: false,
            session: 'closed',
            nextChange: getNextOpenTime(timestamp),
        };
    }

    const isFriday = day === 5;

    // Determine current session
    if (totalMinutes < 9 * 60) {
        return {
            isOpen: false,
            session: 'pre-market',
            nextChange: new Date(date.setHours(9, 0, 0, 0)).getTime(),
        };
    }

    const session1End = isFriday ? 11 * 60 + 30 : 12 * 60;
    const session2Start = isFriday ? 14 * 60 : 13 * 60 + 30;

    if (totalMinutes < session1End) {
        return {
            isOpen: true,
            session: 'session-1',
            nextChange: new Date(
                date.setHours(
                    Math.floor(session1End / 60),
                    session1End % 60,
                    0,
                    0
                )
            ).getTime(),
        };
    }

    if (totalMinutes < session2Start) {
        return {
            isOpen: false,
            session: 'lunch',
            nextChange: new Date(
                date.setHours(
                    Math.floor(session2Start / 60),
                    session2Start % 60,
                    0,
                    0
                )
            ).getTime(),
        };
    }

    if (totalMinutes < 16 * 60) {
        return {
            isOpen: true,
            session: 'session-2',
            nextChange: new Date(date.setHours(16, 0, 0, 0)).getTime(),
        };
    }

    return {
        isOpen: false,
        session: 'closed',
        nextChange: getNextOpenTime(timestamp),
    };
}

/**
 * Detect if there's a gap between two timestamps
 */
export function detectGap(
    prevTimestamp: number,
    currentTimestamp: number,
    expectedDuration: number
): {
    hasGap: boolean;
    gapDuration: number;
    reason: 'weekend' | 'overnight' | 'lunch' | 'normal';
} {
    const gap = currentTimestamp - prevTimestamp;

    if (gap <= expectedDuration * 1.5) {
        return { hasGap: false, gapDuration: 0, reason: 'normal' };
    }

    const prevDate = new Date(prevTimestamp);
    const currentDate = new Date(currentTimestamp);

    // Weekend gap
    const prevDay = prevDate.getDay();
    const currentDay = currentDate.getDay();

    if (
        (prevDay === 5 && currentDay === 1) ||
        (prevDay === 6 && currentDay === 1) ||
        (prevDay === 0 && currentDay === 1)
    ) {
        return { hasGap: true, gapDuration: gap, reason: 'weekend' };
    }

    // Lunch break gap
    const prevHour = prevDate.getHours();
    const currentHour = currentDate.getHours();

    if (
        (prevHour === 11 || prevHour === 12) &&
        (currentHour === 13 || currentHour === 14)
    ) {
        return { hasGap: true, gapDuration: gap, reason: 'lunch' };
    }

    // Overnight gap
    if (gap > 12 * 60 * 60 * 1000) {
        // > 12 hours
        return { hasGap: true, gapDuration: gap, reason: 'overnight' };
    }

    return { hasGap: true, gapDuration: gap, reason: 'normal' };
}
