import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const isUserScrollingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) {
      return true;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 100;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  // Handle user scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      // Mark as user scrolling
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);

      // Update isAtBottom state
      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;

      // Reset user scrolling flag after scroll ends
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    };

    // Components can dispatch this event to signal a user-initiated resize
    // (e.g. expanding/collapsing a panel) that should NOT trigger auto-scroll.
    const handleScrollAnchorRelease = () => {
      isAtBottomRef.current = false;
      setIsAtBottom(false);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener(
      "scroll-anchor-release",
      handleScrollAnchorRelease
    );
    return () => {
      container.removeEventListener("scroll", handleScroll);
      document.removeEventListener(
        "scroll-anchor-release",
        handleScrollAnchorRelease
      );
      clearTimeout(scrollTimeout);
    };
  }, [checkIfAtBottom]);

  // Auto-scroll when content changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scrollIfNeeded = () => {
      // Only auto-scroll if user was at bottom and isn't actively scrolling
      if (isAtBottomRef.current && !isUserScrollingRef.current) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "instant",
          });
          setIsAtBottom(true);
          isAtBottomRef.current = true;
        });
      }
    };

    // Debounced version for resize events — prevents frame-by-frame
    // scroll fighting during CSS/framer-motion height animations.
    // MutationObserver (streaming text) stays immediate.
    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedScrollIfNeeded = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(scrollIfNeeded, 150);
    };

    // Watch for DOM changes (streaming text, new elements)
    const mutationObserver = new MutationObserver(scrollIfNeeded);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Watch for size changes (debounced to avoid animation jitter)
    const resizeObserver = new ResizeObserver(debouncedScrollIfNeeded);
    resizeObserver.observe(container);

    // Also observe children for size changes
    for (const child of container.children) {
      resizeObserver.observe(child);
    }

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
    };
  }, []);

  function onViewportEnter() {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  }

  function onViewportLeave() {
    setIsAtBottom(false);
    isAtBottomRef.current = false;
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
