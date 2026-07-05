import { Fragment, type JSX } from "react";
import { CompetitionEmbedBlock } from "./CompetitionEmbedBlock";
import { ShooterEmbedBlock } from "./ShooterEmbedBlock";
import { GalleryBlock } from "./GalleryBlock";

interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  tag?: string;
  fields?: { blockType: string; [key: string]: unknown };
}

interface LexicalContent {
  root: { children: LexicalNode[] };
}

function renderTextNode(node: LexicalNode, key: number) {
  return <span key={key}>{node.text}</span>;
}

async function renderNode(node: LexicalNode, key: number): Promise<React.ReactNode> {
  if (node.type === "text") return renderTextNode(node, key);

  if (node.type === "block" && node.fields) {
    const { blockType } = node.fields;
    // CompetitionEmbedBlock/ShooterEmbedBlock are async function
    // components — called and awaited directly here rather than
    // referenced via <Component /> JSX. Plain react-dom (used by
    // @testing-library/react's render(), and any renderer other than
    // Next.js's own RSC payload renderer) does not know how to await an
    // async function component invoked via JSX; it silently renders
    // nothing. Since this whole tree is already resolved eagerly via
    // Promise.all, resolving these here keeps the final tree fully
    // synchronous JSX by the time ArticleContent returns it. Wrapped in
    // a keyed Fragment (not <span>, which is inline and would sit
    // awkwardly around these blocks' block-level content — <p>/<Link>).
    if (blockType === "competition-embed") {
      const el = await CompetitionEmbedBlock({ competitionId: node.fields.competitionId as number });
      return <Fragment key={key}>{el}</Fragment>;
    }
    if (blockType === "shooter-embed") {
      const el = await ShooterEmbedBlock({ shooterId: node.fields.shooterId as number });
      return <Fragment key={key}>{el}</Fragment>;
    }
    if (blockType === "gallery") {
      return (
        <GalleryBlock
          key={key}
          images={node.fields.images as { id: number; url: string; alt: string }[]}
        />
      );
    }
    return null;
  }

  const children = node.children
    ? await Promise.all(node.children.map((child, i) => renderNode(child, i)))
    : null;

  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "heading") {
    const Tag = (node.tag ?? "h2") as keyof JSX.IntrinsicElements;
    return <Tag key={key}>{children}</Tag>;
  }
  return <div key={key}>{children}</div>;
}

export async function ArticleContent({ content }: { content: LexicalContent }) {
  const nodes = await Promise.all(content.root.children.map((node, i) => renderNode(node, i)));
  return <div className="prose max-w-none">{nodes}</div>;
}
