export type TestUser = {
  name: string;
  email: string;
  password: string;
};

export const createTestUser = (suffix = Date.now()) => ({
  name: `Test User ${suffix}`,
  email: `test+${suffix}@example.com`,
  password: "Test1234!",
});
