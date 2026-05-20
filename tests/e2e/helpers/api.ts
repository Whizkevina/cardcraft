import type { APIRequestContext } from "@playwright/test";
import type { TestUser } from "./user";

/** 1×1 PNG for share snapshot tests */
export const TEST_SHARE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const createProjectViaApi = async (request: APIRequestContext, user: TestUser) => {
  const registerRes = await request.post("/api/auth/register", {
    data: { name: user.name, email: user.email, password: user.password },
  });
  if (!registerRes.ok()) {
    throw new Error(`Register failed: ${registerRes.status()}`);
  }

  const designJson = JSON.stringify({
    canvasWidth: 800,
    canvasHeight: 1000,
    background: "#111111",
    objects: [],
  });

  const projectRes = await request.post("/api/projects", {
    data: { title: "Share Test", designJson },
  });

  if (!projectRes.ok()) {
    throw new Error(`Create project failed: ${projectRes.status()}`);
  }

  const project = await projectRes.json();

  const shareRes = await request.post(`/api/projects/${project.id}/enable-share`, {
    data: { shareImage: TEST_SHARE_IMAGE },
  });
  if (!shareRes.ok()) {
    throw new Error(`Enable share failed: ${shareRes.status()}`);
  }

  const shareData = await shareRes.json();
  return { ...project, shareToken: shareData.shareToken };
};

/** Shared project without PNG snapshot — exercises legacy canvas render path */
export const createLegacySharedProject = async (request: APIRequestContext, user: TestUser) => {
  const registerRes = await request.post("/api/auth/register", {
    data: { name: user.name, email: user.email, password: user.password },
  });
  if (!registerRes.ok()) {
    throw new Error(`Register failed: ${registerRes.status()}`);
  }

  const designJson = JSON.stringify({
    canvasWidth: 800,
    canvasHeight: 1000,
    background: "#1a0533",
    objects: [
      { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#1a0533", selectable: false, locked: true },
      { type: "text", text: "Happy Birthday", left: 400, top: 430, fontSize: 42, fontFamily: "Georgia", fill: "#FFD700", textAlign: "center", originX: "center", customType: "greeting" },
      { type: "text", text: "Legacy Share", left: 400, top: 500, fontSize: 58, fontFamily: "Georgia", fontWeight: "bold", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "name" },
    ],
  });

  const projectRes = await request.post("/api/projects", {
    data: { title: "Legacy Share Test", designJson },
  });
  if (!projectRes.ok()) {
    throw new Error(`Create project failed: ${projectRes.status()}`);
  }

  const project = await projectRes.json();

  const shareRes = await request.post(`/api/projects/${project.id}/enable-share`, { data: {} });
  if (!shareRes.ok()) {
    throw new Error(`Enable share failed: ${shareRes.status()}`);
  }

  const shareData = await shareRes.json();
  return { ...project, shareToken: shareData.shareToken, title: "Legacy Share Test" };
};
