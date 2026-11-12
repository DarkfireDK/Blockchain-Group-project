import { test } from "node:test";
import assert from "node:assert/strict";
import { flightReportError } from "../../nextjs/utils/scaffold-eth/flightManagement.js";

const input = { status: 1, departureDate: 1000n, coverageEnd: 2000n, chainTime: 1000n,
  delay: "60", threshold: 60, reporter: true, oracleMatches: true };
test("report opens exactly at departure", () => {
  assert.match(flightReportError({ ...input, chainTime: 999n })!, /尚未/);
  assert.equal(flightReportError(input), undefined);
});
test("report includes final grace second but not next second", () => {
  assert.equal(flightReportError({ ...input, chainTime: 88400n }), undefined);
  assert.match(flightReportError({ ...input, chainTime: 88401n })!, /宽限期/);
});
test("normal and below-threshold delay cannot accidentally settle claim", () => {
  for (const delay of ["0", "59"]) assert.match(flightReportError({ ...input, delay })!, /门槛/);
});
test("threshold uses policy snapshot, not new global setting", () => {
  assert.match(flightReportError({ ...input, threshold: 120 })!, /120/);
  assert.equal(flightReportError({ ...input, threshold: 120, delay: "120" }), undefined);
});
test("unauthorized or wrong Oracle is blocked", () => {
  assert.match(flightReportError({ ...input, reporter: false })!, /上报员/);
  assert.match(flightReportError({ ...input, oracleMatches: false })!, /其他 Oracle/);
});
test("missing chain time and missing snapshot fail closed", () => {
  assert.match(flightReportError({ ...input, chainTime: undefined })!, /链上时间/);
  assert.match(flightReportError({ ...input, threshold: undefined })!, /门槛/);
});
test("unknown and settled policy cannot be reported", () => {
  for (const status of [0, 2, 3]) assert.match(flightReportError({ ...input, status })!, /未结算/);
});
test("integer uint32 boundary is enforced", () => {
  for (const delay of ["", "-1", "1.2", "Infinity", "4294967296", "99999999999999999999"])
    assert.notEqual(flightReportError({ ...input, delay }), undefined);
  assert.equal(flightReportError({ ...input, delay: "4294967295" }), undefined);
});
