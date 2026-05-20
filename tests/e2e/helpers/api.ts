import type { APIRequestContext } from "@playwright/test";
import type { TestUser } from "./user";

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

  const shareRes = await request.post(`/api/projects/${project.id}/enable-share`);
  if (!shareRes.ok()) {
    throw new Error(`Enable share failed: ${shareRes.status()}`);
  }

  const shareData = await shareRes.json();
  return { ...project, shareToken: shareData.shareToken };
};
