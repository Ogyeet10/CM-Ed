"use client";

import { Spinner } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { useState } from "react";

export interface WebSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  summary?: string;
  text?: string;
  favicon?: string;
}

export interface WebSearchOutput {
  results: WebSearchResult[];
  requestId?: string;
  searchType?: string;
  [key: string]: unknown;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function WebSearchResults({
  query,
  output,
}: {
  query: string;
  output: WebSearchOutput;
}) {
  const results = output?.results ?? [];
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        className="flex w-full cursor-pointer items-center gap-2 border-2 border-foreground bg-primary px-3 py-2 font-mono text-xs uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_var(--brutalist-accent)]"
        onClick={() => {
          // Tell the auto-scroll hook this is a user-initiated resize,
          // not new content — so it should NOT snap to bottom.
          document.dispatchEvent(new CustomEvent("scroll-anchor-release"));
          setIsOpen((prev) => !prev);
        }}
        type="button"
      >
        <motion.span
          animate={{ rotate: isOpen ? 360 : 180 }}
          className="inline-flex shrink-0"
          initial={false}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <ChevronDownIcon className="size-3.5" />
        </motion.span>
        <GlobeIcon className="size-3.5 shrink-0" />
        <span className="truncate font-bold">WEB SEARCH: {query}</span>
        <span className="ml-auto shrink-0 text-primary-foreground/60">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="pt-1.5">
              <div className="max-h-[50vh] space-y-1.5 overflow-y-auto border-2 border-foreground bg-background p-1.5 shadow-[4px_4px_0px_var(--brutalist-accent)]">
                {results.map((result, i) => (
                  <a
                    className="group block border border-foreground/20 bg-background p-3 transition-all hover:border-foreground hover:shadow-[2px_2px_0px_var(--brutalist-accent)]"
                    href={result.url}
                    key={`${result.url}-${i}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-sm font-semibold leading-tight text-foreground group-hover:underline">
                            {result.title || getDomain(result.url)}
                          </span>
                          <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>

                        <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                          <span className="truncate">
                            {getDomain(result.url)}
                          </span>
                          {result.publishedDate && (
                            <>
                              <span className="text-foreground/30">|</span>
                              <span className="shrink-0">
                                {formatDate(result.publishedDate)}
                              </span>
                            </>
                          )}
                        </div>

                        {(result.summary || result.text) && (
                          <p className="mt-1.5 line-clamp-2 font-mono text-xs leading-relaxed text-muted-foreground">
                            {result.summary || result.text?.slice(0, 200)}
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WebSearchLoading({ query }: { query?: string }) {
  return (
    <div className="flex w-full items-center gap-2.5 border-2 border-foreground bg-primary px-3 py-2 font-mono text-xs uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0px_var(--brutalist-accent)]">
      <Spinner
        aria-label="Searching the web"
        className="shrink-0"
        color="current"
        size="sm"
      />
      <span className="truncate font-bold">
        SEARCHING{query ? `: ${query}` : "..."}
      </span>
    </div>
  );
}
