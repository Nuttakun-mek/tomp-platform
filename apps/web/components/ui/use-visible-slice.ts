"use client";

import { useMemo, useState } from "react";
import { sliceView, type SliceView } from "@/lib/ui/visible-slice";

// Long control-room lists (fleet board, comms feed, dispatch lanes, timeline)
// used to render every row, so a busy project produced a page many screens tall
// that was slow to scan. This caps the list and hands back a "show more" toggle.

interface VisibleSlice<T> extends SliceView<T> {
  showMore: () => void;
  showAll: () => void;
  reset: () => void;
}

export function useVisibleSlice<T>(items: T[], initial: number, step: number = initial): VisibleSlice<T> {
  const [limit, setLimit] = useState(initial);

  return useMemo<VisibleSlice<T>>(() => {
    const view = sliceView(items, limit, initial);
    return {
      ...view,
      showMore: () => setLimit((current) => Math.max(current, initial) + step),
      showAll: () => setLimit(items.length),
      reset: () => setLimit(initial)
    };
  }, [items, limit, initial, step]);
}
