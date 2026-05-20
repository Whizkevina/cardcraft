import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SharePanel } from "@/components/SharePanel";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null, isPro: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

describe("SharePanel", () => {
  it("toggles SVG text mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SharePanel
        fabricRef={{ current: null }}
        projectTitle="Test Card"
        projectId={null}
        onQROpen={vi.fn()}
        svgTextMode="embed"
        onSvgTextModeChange={onChange}
      />
    );

    await user.click(screen.getByTestId("button-svg-paths"));
    expect(onChange).toHaveBeenCalledWith("paths");
    expect(screen.getByTestId("button-download-svg")).toBeInTheDocument();
  });
});
