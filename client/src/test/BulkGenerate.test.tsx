import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import BulkGenerate from "@/pages/BulkGenerate";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [{ id: 1, title: "Test Template", thumbnailColor: "#111111" }],
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: 1, tier: "pro" }, isPro: true, isLoading: false }),
}));

vi.mock("@/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

describe("BulkGenerate", () => {
  it("loads CSV rows and shows preview table", async () => {
    const user = userEvent.setup();
    render(<BulkGenerate />);

    const csv = new File(["name,greeting,date,subtitle\nJane Doe,Hello,April 29,Test"], "sample.csv", { type: "text/csv" });
    const input = screen.getByTestId("input-csv-upload");

    await user.upload(input, csv);

    expect(await screen.findByText("1 rows loaded")).toBeInTheDocument();
    expect(screen.getByTestId("row-bulk-0")).toBeInTheDocument();
  });
});
