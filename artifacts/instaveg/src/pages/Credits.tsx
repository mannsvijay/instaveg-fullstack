import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { Skeleton } from "@/components/ui/skeleton";

type CreditRow = {
  item: string;
  file: string;
  source: { text: string; href: string };
  author: string;
  license: { text: string; href: string };
};

type CreditSection = { title: string; rows: CreditRow[] };

const LINK = /^\[(.*)\]\((.*)\)$/;

function parseLink(cell: string) {
  const m = cell.match(LINK);
  return m ? { text: m[1], href: m[2] } : { text: cell, href: "" };
}

// public/images/CREDITS.md is the source of truth; this page only renders it.
// Rows look like: | Item | `/images/...webp` | [title](url) | author | [license](url) |
export function parseCredits(md: string): CreditSection[] {
  const sections: CreditSection[] = [];
  for (const line of md.split("\n")) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      sections.push({ title: heading[1].trim(), rows: [] });
      continue;
    }
    const cells = line.split(" | ").map((c) => c.replace(/^\| ?| ?\|$/g, "").trim());
    const file = cells[1]?.match(/^`(\/images\/.+)`$/)?.[1];
    if (!file || cells.length < 5 || sections.length === 0) continue;
    sections[sections.length - 1].rows.push({
      item: cells[0],
      file,
      source: parseLink(cells[2]),
      author: cells[3],
      license: parseLink(cells[4]),
    });
  }
  return sections.filter((s) => s.rows.length > 0);
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words">
      {children}
    </a>
  );
}

export default function Credits() {
  const [sections, setSections] = useState<CreditSection[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/images/CREDITS.md")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((md) => setSections(parseCredits(md)))
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold font-serif mb-2">Image credits</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Product and category photos are openly licensed images from{" "}
        <ExternalLink href="https://commons.wikimedia.org/">Wikimedia Commons</ExternalLink>, used under the
        license shown for each.
      </p>

      {failed ? (
        <p className="text-sm text-destructive">Could not load the image credits. Please try again later.</p>
      ) : sections === null ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl mb-3" />)
      ) : (
        sections.map((section) => (
          <section key={section.title} className="mb-8">
            <h2 className="font-semibold mb-3">{section.title}</h2>
            <ul className="bg-white/70 rounded-2xl border border-border/30 divide-y divide-border/20">
              {section.rows.map((row) => (
                <li key={row.file} className="flex items-start gap-3 p-3 text-sm">
                  <ProductImage src={row.file} alt={row.item} className="w-14 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.item}</p>
                    <p className="text-xs text-muted-foreground">
                      Source: <ExternalLink href={row.source.href}>{row.source.text}</ExternalLink>
                    </p>
                    <p className="text-xs text-muted-foreground">Author: {row.author}</p>
                    <p className="text-xs text-muted-foreground">
                      License: <ExternalLink href={row.license.href}>{row.license.text}</ExternalLink>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
