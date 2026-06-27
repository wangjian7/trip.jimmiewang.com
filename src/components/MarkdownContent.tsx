import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
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
  h2: ({ children, ...props }) => (
    <h2 className="vv-markdown-h2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="vv-markdown-h3" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="vv-markdown-h4" {...props}>
      {children}
    </h4>
  ),
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

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
