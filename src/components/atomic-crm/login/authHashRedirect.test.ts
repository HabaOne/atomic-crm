import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";

// public/auth-hash-redirect.js runs as a classic script before the app
// bundle, so the test loads it the same way instead of importing it.
const script = readFileSync(
  path.resolve(__dirname, "../../../../public/auth-hash-redirect.js"),
  "utf8",
);

const run = (hash: string) => {
  const replaced: string[] = [];
  runInNewContext(script, {
    window: {
      location: { hash, replace: (url: string) => replaced.push(url) },
    },
    URLSearchParams,
  });
  return replaced.at(0);
};

describe("auth-hash-redirect", () => {
  it("sends an invite link that lands on the app root to the auth callback", () => {
    expect(
      run("#access_token=a.b.c&expires_in=3600&refresh_token=r1&type=invite"),
    ).toBe("./#/auth-callback?access_token=a.b.c&refresh_token=r1&type=invite");
  });

  it("does the same for password recovery links", () => {
    expect(run("#access_token=t&refresh_token=r&type=recovery")).toBe(
      "./#/auth-callback?access_token=t&refresh_token=r&type=recovery",
    );
  });

  it("leaves app routes alone", () => {
    expect(run("#/contacts")).toBeUndefined();
    expect(run("#/auth-callback?access_token=t&type=invite")).toBeUndefined();
    expect(run("")).toBeUndefined();
  });

  it("leaves other token types alone", () => {
    expect(
      run("#access_token=t&refresh_token=r&type=magiclink"),
    ).toBeUndefined();
  });

  it("leaves links without a refresh token alone", () => {
    expect(run("#access_token=t&type=invite")).toBeUndefined();
  });
});
