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
];

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

  const articles = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter((a) => a.title)
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 40);

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return res.status(200).json({ articles });
}
