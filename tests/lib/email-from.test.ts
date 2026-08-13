import { describe, expect, it } from "vitest";
import { parseFrom } from "@/lib/email";

describe("parseFrom", () => {
  it("splits a display name from the address", () => {
    expect(parseFrom("ONEVIEW Finance <no-reply@harisand.co>")).toEqual({
      name: "ONEVIEW Finance",
      email: "no-reply@harisand.co",
    });
  });

  it("accepts a bare address", () => {
    expect(parseFrom("no-reply@harisand.co")).toEqual({ email: "no-reply@harisand.co" });
  });

  it("strips quotes some clients add around the name", () => {
    expect(parseFrom('"Haris&Co. Finance" <no-reply@harisand.co>')).toEqual({
      name: "Haris&Co. Finance",
      email: "no-reply@harisand.co",
    });
  });

  it("tolerates stray whitespace", () => {
    expect(parseFrom("  Finance   < no-reply@harisand.co >  ")).toEqual({
      name: "Finance",
      email: "no-reply@harisand.co",
    });
  });

  // An empty display name must not be sent as name: "" — Brevo rejects a
  // sender object with a blank name rather than ignoring it.
  it("omits an empty name rather than sending a blank one", () => {
    expect(parseFrom("<no-reply@harisand.co>")).toEqual({ email: "no-reply@harisand.co" });
  });
});
