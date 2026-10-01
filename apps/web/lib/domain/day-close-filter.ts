import { DAY_CLOSE_FLAGS, isDayCloseFlag, type DayCloseFlag } from "./day-close";

// The project view's filter lives in the URL, so the page, the Excel link and
// a pasted link all show the same thing: ?view=range&from=&to=&unit=…&flag=…

export interface DayCloseFilter {
  from: string;
  to: string;
  units: string[];
  flags: DayCloseFlag[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Params = Record<string, string | string[] | undefined>;

const many = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? [value] : []);

export function parseDayCloseFilter(params: Params, fallback: { from: string; to: string }): DayCloseFilter {
  const from = typeof params.from === "string" && DATE.test(params.from) ? params.from : fallback.from;
  const toRaw = typeof params.to === "string" && DATE.test(params.to) ? params.to : fallback.to;
  const to = toRaw < from ? from : toRaw;
  return {
    from,
    to,
    units: many(params.unit).filter((unit) => /^[0-9a-f-]{36}$/i.test(unit)),
    flags: many(params.flag).filter(isDayCloseFlag)
  };
}

export function dayCloseFilterQuery(filter: DayCloseFilter) {
  const query = new URLSearchParams({ view: "range", from: filter.from, to: filter.to });
  for (const unit of filter.units) query.append("unit", unit);
  for (const flag of filter.flags) query.append("flag", flag);
  return query.toString();
}

/** "Van-01, Van-02 · มี OT" — what the filter keeps, for the export's title. */
export function describeDayCloseFilter(filter: DayCloseFilter, unitLabel: (id: string) => string) {
  const parts: string[] = [];
  if (filter.units.length) parts.push(filter.units.map(unitLabel).join(", "));
  if (filter.flags.length) parts.push(filter.flags.map((flag) => DAY_CLOSE_FLAGS[flag]).join(" หรือ "));
  return parts.join(" · ");
}
