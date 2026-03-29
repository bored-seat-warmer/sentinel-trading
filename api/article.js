// Extract article text from a URL

function stripTags(html, tag) {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return html.replace(regex, "");
}

function extractText(html) {
  // Remove scripts, styles, nav, header, footer, aside, svg, iframe
  let clean = html;
  for (const tag of ["script", "style", "nav", "header", "footer", "aside", "svg", "iframe", "noscript", "figure"]) {
    clean = stripTags(clean, tag);
  }

  // Try to find <article> content first
  const articleMatch = clean.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const scope = articleMatch ? articleMatch[1] : clean;

  // Extract text from <p> tags
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(scope)) !== null) {
    // Strip remaining HTML tags from paragraph content
    const text = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Filter out short fragments (nav items, captions, etc.)
    if (text.length > 40) {
      paragraphs.push(text);
    }
  }

  return paragraphs.join("\n\n");
}

function extractMeta(html) {
  // Try og:description or meta description for a fallback summary
  const ogMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"[^>]*>/i);
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"[^>]*>/i);

  return ogMatch?.[1] || metaMatch?.[1] || "";
}

function extractTitle(html) {
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (ogTitle?.[1] || titleTag?.[1] || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ALLOWED_DOMAINS = [
  "cnbc.com",
  "politico.com",
  "coindesk.com",
  "cointelegraph.com",
  "decrypt.co",
  "reuters.com",
  "apnews.com",
  "bloomberg.com",
  "wsj.com",
  "nytimes.com",
  "washingtonpost.com",
  "theverge.com",
  "theblock.co",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Validate URL
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (parsed.protocol !== "https:") {
    return res.status(400).json({ error: "Only HTTPS URLs allowed" });
  }

  // Domain allowlist
  const domain = parsed.hostname.replace(/^www\./, "");
  if (!ALLOWED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return res.status(403).json({ error: "Domain not in allowlist" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AtlasAlpha/1.0; +https://atlasalpha.app)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch article (${response.status})` });
    }

    const html = await response.text();
    const title = extractTitle(html);
    const meta = extractMeta(html);
    let content = extractText(html);

    // If extraction got very little, fall back to meta description
    if (content.length < 100 && meta) {
      content = meta;
    }

    // Truncate to ~8000 chars — covers most full articles
    if (content.length > 8000) {
      content = content.slice(0, 8000).replace(/\n\n[^\n]*$/, "") + "\n\n[truncated]";
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
    return res.status(200).json({
      title,
      content,
      url,
      length: content.length,
    });
  } catch (err) {
    console.error("Article fetch error:", err);
    return res.status(500).json({ error: "Failed to extract article" });
  }
}
