import { describe, expect, it } from "bun:test";

describe("hello world", () => {
  it("says hello", () => {
    const msg = "hello world";
    expect(msg).toBe("hello world");
  });
});

