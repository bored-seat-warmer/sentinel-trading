import Parser from "rss-parser";

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "AtlasAlpha/1.0",
  },
});

const FEEDS = [
  { url: "https://www.cnbc.com/id/10000113/device/rss/rss.html", source: "CNBC", category: "Politics" },
  { url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", source: "CNBC", category: "Economy" },
  { url: "https://rss.politico.com/politics-news.xml", source: "Politico", category: "Politics" },
  { url: "https://rss.politico.com/congress.xml", source: "Politico", category: "Congress" },
  { url: "https://rss.politico.com/economy.xml", source: "Politico", category: "Economy" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", category: "Crypto" },
  { url: "https://cointelegraph.com/rss", source: "CoinTelegraph", category: "Crypto" },
  { url: "https://decrypt.co/feed", source: "Decrypt", category: "Crypto" },
];

// Stop words to ignore when comparing headlines
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "about", "after",
  "and", "but", "or", "not", "no", "if", "than", "that", "this",
  "it", "its", "he", "she", "they", "we", "his", "her", "their",
  "says", "said", "new", "also", "how", "what", "when", "who", "why",
]);

function tokenize(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function similarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function deduplicateArticles(articles) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue;

    const group = [articles[i]];
    used.add(i);

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue;
      if (similarity(articles[i].title, articles[j].title) >= 0.4) {
        group.push(articles[j]);
        used.add(j);
      }
    }

    // Pick the article with the longest description as primary
    group.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
    const primary = group[0];

    // Collect all unique sources covering this story
    const sources = [...new Set(group.map((a) => a.source))];
    // Collect all unique categories
    const categories = [...new Set(group.map((a) => a.category))];

    groups.push({
      ...primary,
      sources,
      sourceCount: sources.length,
      categories,
    });
  }

  return groups;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.map((item) => ({
        title: item.title?.trim() || "",
        link: item.link || "",
        description: (item.contentSnippet || item.content || item.summary || "")
          .replace(/<[^>]*>/g, "")
          .trim()
          .slice(0, 500),
        pubDate: item.pubDate || item.isoDate || "",
        source: feed.source,
        category: feed.category,
      }));
    })
  );

  const allArticles = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter((a) => a.title)
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const deduplicated = deduplicateArticles(allArticles).slice(0, 60);

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return res.status(200).json({ articles: deduplicated });
}
