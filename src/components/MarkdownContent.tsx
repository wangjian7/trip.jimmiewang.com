import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createHeadingSlugger } from "@/lib/markdown-slug";

function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = node.props as { children?: ReactNode };
    return getTextContent(props.children);
  }
  return "";
}

function createMarkdownComponents(slugger: ReturnType<typeof createHeadingSlugger>): Components {
  function heading(
    Tag: "h2" | "h3" | "h4",
    className: string,
  ): Components["h2"] {
    return ({ children, ...props }) => {
      const id = slugger.slug(getTextContent(children));
      return (
        <Tag id={id} className={className} {...props}>
          {children}
        </Tag>
      );
    };
  }

  return {
    table: ({ children, ...props }) => (
      <div className="vv-markdown-table-wrap">
        <table {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
    tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
    tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
    th: ({ children, ...props }) => <th {...props}>{children}</th>,
    td: ({ children, ...props }) => <td {...props}>{children}</td>,
    h2: heading("h2", "vv-markdown-h2"),
    h3: heading("h3", "vv-markdown-h3"),
    h4: heading("h4", "vv-markdown-h4"),
    blockquote: ({ children, ...props }) => (
      <blockquote className="vv-markdown-callout" {...props}>
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className="vv-markdown-divider" {...props} />,
    a: ({ children, href, ...props }) => (
      <a href={href} className="vv-markdown-link" {...props}>
        {children}
      </a>
    ),
    code: ({ children, ...props }) => (
      <code className="vv-markdown-code" {...props}>
        {children}
      </code>
    ),
  };
}

export function MarkdownContent({ content }: { content: string }) {
  const components = createMarkdownComponents(createHeadingSlugger());

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
