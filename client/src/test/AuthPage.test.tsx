import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import AuthPage from "@/pages/AuthPage";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: () => <button data-testid="google-login" />,
}));

vi.mock("wouter", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useLocation: () => ["/auth", vi.fn()],
}));

describe("AuthPage", () => {
  it("toggles between login and register modes", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument();

    await user.click(screen.getByTestId("button-toggle-mode"));

    expect(screen.getByText("Create account")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
  });
});
