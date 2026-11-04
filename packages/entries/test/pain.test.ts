/**
 * The pain projection's tests. The ones that matter: every field of the entry's pain report survives, and the id is
 * derived so a replayed submission writes the same row instead of a second one.
 */
import { describe, expect, it } from "vitest";
import { painReportsOf } from "../src/index";
import { makeEntry } from "../../policy/test/helpers";

const USER = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

const entryWithPain = () =>
  makeEntry({
    day: "2026-11-05",
    revision: 2,
    pain: [
      {
        site: "achilles",
        side: "left",
        intensity: 6,
        duringRun: true,
        nextMorningWorse: true,
        affectsGait: false,
        nightPain: true,
        duration: "few-days",
        knownInjury: false,
      },
    ],
  });

describe("an entry's pain becomes rows", () => {
  it("carries every field the table can store", () => {
    const [report] = painReportsOf({ userId: USER, entry: entryWithPain() });
    expect(report).toMatchObject({
      userId: USER,
      day: "2026-11-05",
      site: "achilles",
      side: "left",
      intensity: 6,
      duringRun: true,
      nextMorning: true,
      trendGaitChange: false,
      nightPain: true,
      duration: "few-days",
      knownInjury: false,
      note: null,
    });
  });

  it("derives the id from the entry, so a replay writes the same row", () => {
    const first = painReportsOf({ userId: USER, entry: entryWithPain() });
    const again = painReportsOf({ userId: USER, entry: entryWithPain() });
    expect(first.map((report) => report.id)).toEqual(again.map((report) => report.id));
    // A different revision is a different fact, so it is a different row.
    const corrected = painReportsOf({ userId: USER, entry: makeEntry({ day: "2026-11-05", revision: 3, pain: entryWithPain().pain }) });
    expect(corrected[0]?.id).not.toBe(first[0]?.id);
  });

  it("gives two reports on one day different ids", () => {
    const entry = makeEntry({
      day: "2026-11-05",
      pain: [
        { site: "achilles", intensity: 4 },
        { site: "shin", intensity: 2 },
      ],
    });
    const reports = painReportsOf({ userId: USER, entry });
    expect(reports).toHaveLength(2);
    expect(reports[0]?.id).not.toBe(reports[1]?.id);
    // The flags default to false rather than undefined: the table's columns are NOT NULL.
    expect(reports[0]).toMatchObject({ side: null, duringRun: false, nightPain: false, duration: null });
  });

  it("writes nothing for a day with no pain", () => {
    expect(painReportsOf({ userId: USER, entry: makeEntry({ day: "2026-11-05" }) })).toEqual([]);
  });
});