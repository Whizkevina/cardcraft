import { expect, test } from "@playwright/test";
import { createTestUser } from "./helpers/user";

test.describe("API routes", () => {
  test("register, create project, and list projects", async ({ request }) => {
    const user = createTestUser();

    const registerRes = await request.post("/api/auth/register", {
      data: { name: user.name, email: user.email, password: user.password },
    });
    expect(registerRes.ok()).toBeTruthy();

    const createRes = await request.post("/api/projects", {
      data: {
        title: "API Test Project",
        designJson: JSON.stringify({ objects: [], background: "#000" }),
      },
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();

    const listRes = await request.get("/api/projects");
    expect(listRes.ok()).toBeTruthy();
    const projects = await listRes.json();
    expect(projects.some((p: { id: number }) => p.id === project.id)).toBeTruthy();
  });

  test("guest download tracking enforces daily limit", async ({ request }) => {
    for (let i = 0; i < 3; i++) {
      const res = await request.post("/api/downloads/track");
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.allowed).toBe(true);
    }

    const blocked = await request.post("/api/downloads/track");
    const blockedData = await blocked.json();
    expect(blockedData.allowed).toBe(false);
  });

  test("pricing quote returns localized display fields", async ({ request }) => {
    const res = await request.get("/api/pricing/quote");
    expect(res.ok()).toBeTruthy();
    const quote = await res.json();
    expect(quote.currency).toBeTruthy();
    expect(quote.proPrice?.formatted).toMatch(/[\d$€£¥₦]/);
    expect(quote.charge?.currency).toBe("NGN");
    expect(quote.charge?.amountNgn).toBe(10000);
  });

  test("share token endpoint requires enabled sharing", async ({ request }) => {
    const user = createTestUser();
    await request.post("/api/auth/register", {
      data: { name: user.name, email: user.email, password: user.password },
    });

    const createRes = await request.post("/api/projects", {
      data: {
        title: "Private Share Test",
        designJson: JSON.stringify({ objects: [], background: "#111" }),
      },
    });
    const project = await createRes.json();

    const privateShare = await request.get(`/api/share/${project.shareToken}`);
    expect(privateShare.status()).toBe(404);

    const enableRes = await request.post(`/api/projects/${project.id}/enable-share`, {
      data: { shareImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" },
    });
    expect(enableRes.ok()).toBeTruthy();
    const shareData = await enableRes.json();
    expect(shareData.shareImageStored).toBe(true);

    const publicShare = await request.get(`/api/share/${shareData.shareToken}`);
    expect(publicShare.ok()).toBeTruthy();
    const payload = await publicShare.json();
    expect(payload.title).toBe("Private Share Test");
    expect(payload.shareImage).toMatch(/^data:image\/png;base64,/);

    const ogPage = await request.get(`/share/${shareData.shareToken}`);
    expect(ogPage.ok()).toBeTruthy();
    expect(ogPage.headers()["content-type"]).toContain("text/html");
    const html = await ogPage.text();
    expect(html).toContain(`og:image`);
    expect(html).toContain(`/share/${shareData.shareToken}/image.png`);

    const ogImage = await request.get(`/share/${shareData.shareToken}/image.png`);
    expect(ogImage.ok()).toBeTruthy();
    expect(ogImage.headers()["content-type"]).toMatch(/image\/(png|jpeg)/);
  });
});
