import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilMarkdownToHtml extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Convert Markdown to HTML",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["markdown"],
            properties: {
              markdown: { type: "string" as const, description: "Markdown text to convert" },
              sanitize: {
                type: "boolean" as const,
                default: true,
                description: "Escape HTML in input",
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "HTML output",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                html: { type: "string" as const },
                inputLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { markdown?: string; sanitize?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { markdown, sanitize = true } = body;

    if (typeof markdown !== "string") {
      return this.errorResponse(c, "markdown field is required and must be a string", 400);
    }

    // Simple markdown to HTML converter
    let html = markdown;

    // Escape HTML if sanitize is true
    if (sanitize) {
      html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
    html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
    html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html = html.replace(/_(.+?)_/g, "<em>$1</em>");

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code class=\"language-$1\">$2</code></pre>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Horizontal rules
    html = html.replace(/^[-*_]{3,}$/gm, "<hr>");

    // Unordered lists
    html = html.replace(/^[\*\-\+]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");

    // Paragraphs (double newlines)
    html = html.replace(/\n\n+/g, "</p><p>");
    html = `<p>${html}</p>`;
    html = html.replace(/<p><\/p>/g, "");
    html = html.replace(/<p>(<h[1-6]>)/g, "$1");
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
    html = html.replace(/<p>(<pre>)/g, "$1");
    html = html.replace(/(<\/pre>)<\/p>/g, "$1");
    html = html.replace(/<p>(<ul>)/g, "$1");
    html = html.replace(/(<\/ul>)<\/p>/g, "$1");
    html = html.replace(/<p>(<hr>)<\/p>/g, "$1");
    html = html.replace(/<p>(<blockquote>)/g, "$1");
    html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");

    // Line breaks
    html = html.replace(/\n/g, "<br>\n");

    return c.json({
      html,
      inputLength: markdown.length,
      outputLength: html.length,
      tokenType,
    });
  }
}
