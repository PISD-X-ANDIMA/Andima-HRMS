import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// D4-QA-01: the D4 web layer passes the repo eslint config, including react-hooks/set-state-in-effect (the rule stays on).
describe("eslint (modules/d4/web)", () => {
  it("reports no errors", async () => {
    const results = await new ESLint().lintFiles(["modules/d4/web"]);
    const errors = results.flatMap((file) => file.messages.filter((item) => item.severity === 2)
      .map((item) => `${file.filePath.replace(`${process.cwd()}/`, "")}:${item.line} ${item.ruleId}`));
    expect(errors).toEqual([]);
  }, 120_000);
});
