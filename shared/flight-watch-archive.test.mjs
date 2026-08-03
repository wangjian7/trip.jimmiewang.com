import test from "node:test";
import assert from "node:assert/strict";
import {
  isFlightWatchArchived,
  splitFlightWatchesByArchive,
} from "./flight-watch-archive.mjs";

test("北京时间已过出发日的关注会进入归档", () => {
  const now = new Date("2026-07-31T00:30:00+08:00");

  assert.equal(isFlightWatchArchived("2026-07-30", now), true);
  assert.equal(isFlightWatchArchived("2026-07-31", now), false);
  assert.equal(isFlightWatchArchived("2026-08-01", now), false);
});

test("关注列表会按活动和归档拆分", () => {
  const now = new Date("2026-07-31T09:00:00+08:00");
  const watches = [
    { id: "fw-sha-osa-20260730", travelDate: "2026-07-30" },
    { id: "fw-sha-bne-20260801", travelDate: "2026-08-01" },
    { id: "fw-sha-syd-20260731", travelDate: "2026-07-31" },
  ];

  assert.deepEqual(splitFlightWatchesByArchive(watches, now), {
    active: [
      { id: "fw-sha-bne-20260801", travelDate: "2026-08-01" },
      { id: "fw-sha-syd-20260731", travelDate: "2026-07-31" },
    ],
    archived: [{ id: "fw-sha-osa-20260730", travelDate: "2026-07-30" }],
  });
});
