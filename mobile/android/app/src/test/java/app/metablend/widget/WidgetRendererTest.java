package app.metablend.widget;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.time.Instant;
import java.util.TimeZone;
import org.junit.Test;

// A stored answer's time carries its day unless the answer is from the day it is shown on (owner, 2026-11-20).
public class WidgetRendererTest {
    private static final TimeZone VIENNA = TimeZone.getTimeZone("Europe/Vienna");
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

    private static long at(String iso) {
        return Instant.parse(iso).toEpochMilli();
    }

    @Test
    public void sameDayMorningAndEvening() {
        assertTrue(WidgetRenderer.sameDay(at("2026-11-19T06:00:00Z"), at("2026-11-19T21:00:00Z"), VIENNA));
    }

    @Test
    public void midnightInViennaSeparatesTheDays() {
        // 23:30 and 00:10 in Vienna: two days there, one day in UTC
        long before = at("2026-11-19T22:30:00Z"), after = at("2026-11-19T23:10:00Z");
        assertFalse(WidgetRenderer.sameDay(before, after, VIENNA));
        assertTrue(WidgetRenderer.sameDay(before, after, UTC));
    }

    @Test
    public void theSameWeekdayAWeekLaterIsAnotherDay() {
        assertFalse(WidgetRenderer.sameDay(at("2026-11-12T10:00:00Z"), at("2026-11-19T10:00:00Z"), VIENNA));
    }

    @Test
    public void theDayOfTheClockChangeStaysOneDay() {
        // 29 March 2026: 01:30 winter time and 23:30 summer time in Vienna
        assertTrue(WidgetRenderer.sameDay(at("2026-03-29T00:30:00Z"), at("2026-03-29T21:30:00Z"), VIENNA));
    }

    @Test
    public void newYearsEveIsNotNewYearsDay() {
        assertFalse(WidgetRenderer.sameDay(at("2026-12-31T22:59:00Z"), at("2026-12-31T23:01:00Z"), VIENNA));
    }
}
