import { dateInTimezone } from "@/lib/dates";
import { CHORE_ICONS } from "@/lib/icons";

export const matchingIcons = (filter: string) => {
  const query = filter.trim().toLowerCase();
  if (!query) return CHORE_ICONS;
  return CHORE_ICONS.filter((icon) =>
    icon.id.toLowerCase().includes(query) ||
    icon.label.toLowerCase().includes(query) ||
    icon.category?.toLowerCase().includes(query) ||
    icon.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
  );
};

export const formSchedule = (kind: string, weekdays: number[], timezone: string) => ({
  kind,
  startDate: dateInTimezone(new Date(), timezone),
  weekdays: kind === "weekly" ? (weekdays.length ? weekdays : [1]) : kind === "weekdays" ? [1, 2, 3, 4, 5] : []
});
