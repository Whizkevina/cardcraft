import path from "path";
import { fileURLToPath } from "url";
import { expect, test } from "@playwright/test";
import { createTestUser } from "./helpers/user";
import { registerUser } from "./helpers/auth";
import { setUserTier } from "./helpers/db";
import { dismissCookieBanner } from "./helpers/ui";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(__dirname, "fixtures/sample.csv");

test("bulk generation loads CSV and generates cards", async ({ page }) => {
  const user = createTestUser();
  await registerUser(page, user);
  await setUserTier(user.email, "pro");
  await page.reload();
  await page.goto("/#/bulk");
  await dismissCookieBanner(page);
  await expect(page.getByTestId("select-template")).toBeVisible({ timeout: 30000 });

  await page.getByTestId("select-template").click();
  const templateOption = page.getByRole("option").first();
  await expect(templateOption).toBeVisible();
  await templateOption.click();

  await page.getByTestId("input-csv-upload").setInputFiles(csvPath);
  await expect(page.getByText("3 rows loaded")).toBeVisible();

  await page.getByTestId("button-generate-all").click();
  await expect(page.getByTestId("row-bulk-0").getByText(/done/i)).toBeVisible({ timeout: 90000 });
});
