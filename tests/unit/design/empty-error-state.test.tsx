// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

describe("EmptyState", () => {
  it("renders the title, the description and the action", () => {
    render(
      <EmptyState
        title="Nothing here yet."
        description="Add a task to get this board moving."
        action={<button type="button">Create task</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Nothing here yet." })).toBeTruthy();
    expect(screen.getByText("Add a task to get this board moving.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create task" })).toBeTruthy();
  });

  it("renders without an action", () => {
    render(<EmptyState title="Nothing found." description="Try a different search." />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("is announced as an alert", () => {
    render(<ErrorState description="Something went wrong on our side." />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went wrong on our side.");
  });

  it("uses the spec's error title by default", () => {
    render(<ErrorState description="Something went wrong on our side." />);
    expect(screen.getByRole("heading").textContent).toBe("Well… that wasn't supposed to happen.");
  });

  it("calls onRetry once when Try again is clicked", async () => {
    const onRetry = vi.fn();
    render(<ErrorState description="Something went wrong on our side." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no retry button without onRetry", () => {
    render(<ErrorState description="Something went wrong on our side." />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
