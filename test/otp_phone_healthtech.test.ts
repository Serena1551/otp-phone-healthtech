import assert from "node:assert/strict";
import test from "node:test";
import { chooseLoginOutcome } from "../src/otp_phone_healthtech.ts";

test("the login boundary accepts a phone and numeric code, and rejects unsafe input", () => {
  assert.equal(chooseLoginOutcome({ phone: "+15550001111", code: "123456" }), "accepted");
  assert.equal(chooseLoginOutcome({ phone: "+15550001111", code: "share-this" }), "rejected");
});
