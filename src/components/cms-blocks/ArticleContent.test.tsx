import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/cms/resolve-competition", () => ({
  resolveCompetition: vi.fn(async (id: number) =>
    id === 1 ? { id: 1, name: "Prvenstvo Srbije 2026", date: "2026-05-01", dateEnd: null, location: "Beograd", level: "national" } : null
  ),
}));
vi.mock("@/lib/cms/resolve-shooter", () => ({
  resolveShooter: vi.fn(async (id: number) => (id === 999 ? null : {
    id, firstName: "Petar", lastName: "Petrović", avatarUrl: null, nationality: "SRB", clubName: "SK Pančevo 1813", forma: null,
  })),
}));

import { ArticleContent } from "./ArticleContent";

const lexicalContent = {
  root: {
    children: [
      {
        type: "block",
        fields: { blockType: "competition-embed", competitionId: 1 },
      },
      {
        type: "block",
        fields: { blockType: "shooter-embed", shooterId: 999 },
      },
    ],
  },
};

describe("ArticleContent", () => {
  it("renders a competition card for a resolvable competition-embed block", async () => {
    render(await ArticleContent({ content: lexicalContent }));
    expect(screen.getByText("Prvenstvo Srbije 2026")).toBeInTheDocument();
  });

  it("renders a fallback message for a shooter-embed block whose shooter no longer exists", async () => {
    render(await ArticleContent({ content: lexicalContent }));
    expect(screen.getByText("Podaci o strelacu nisu dostupni.")).toBeInTheDocument();
  });
});
