"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { compareDailyItems, DAY_PARTS, type DayPart } from "@/lib/day-order";
import { useParentControllerContext } from "./parent-controller";

type Entry = {
  type: "chore" | "routine";
  id: string;
  title: string;
  dayPart: DayPart | null;
  displayOrder: number | null;
};

export function DailyOrderTab() {
  const { choreTemplates, routineTemplates, busy, perform, request, setNotice } = useParentControllerContext();
  const [items, setItems] = useState<Entry[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(
      [
        ...choreTemplates.map(({ id, title, dayPart, displayOrder }) => ({
          type: "chore" as const,
          id,
          title,
          dayPart,
          displayOrder,
        })),
        ...routineTemplates.map(({ id, title, dayPart, displayOrder }) => ({
          type: "routine" as const,
          id,
          title,
          dayPart,
          displayOrder,
        })),
      ].sort(compareDailyItems)
    );
    setDirty(false);
  }, [choreTemplates, routineTemplates]);

  const changePart = (entry: Entry, dayPart: DayPart | null) => {
    setItems((current) => {
      const next = current.filter((item) => item !== entry);
      const last = next.map((item) => item.dayPart).lastIndexOf(dayPart);
      const insertAt =
        last >= 0 ? last + 1 : next.findIndex((item) => DAY_PARTS.indexOf(item.dayPart) > DAY_PARTS.indexOf(dayPart));
      next.splice(insertAt < 0 ? next.length : insertAt, 0, { ...entry, dayPart });
      return next;
    });
    setDirty(true);
  };

  const move = (entry: Entry, direction: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const index = next.indexOf(entry);
      const siblingIndex = index + direction;
      if (siblingIndex < 0 || siblingIndex >= next.length || next[siblingIndex].dayPart !== entry.dayPart)
        return current;
      [next[index], next[siblingIndex]] = [next[siblingIndex], next[index]];
      return next;
    });
    setDirty(true);
  };

  const save = () => {
    void perform("daily-order-save", async () => {
      await request("/api/v1/daily-order", {
        method: "PUT",
        body: JSON.stringify({ items: items.map(({ type, id, dayPart }) => ({ type, id, dayPart })) }),
      });
      setNotice("Daily order updated.");
    });
  };

  return (
    <section className="management-card daily-order-card">
      <p className="eyebrow">THE DAY AT A GLANCE</p>
      <h2>Daily order</h2>
      <p className="form-hint">
        Arrange chores and routines in the order children should see them. This order applies across the household.
      </p>
      {DAY_PARTS.map((part) => {
        const section = items.filter((item) => item.dayPart === part);
        return (
          <div className="daily-order-section" key={part ?? "unassigned"}>
            <h3>{part ? part[0].toUpperCase() + part.slice(1) : "Unassigned"}</h3>
            {part === null && <p className="form-hint">Older items appear here until you place them.</p>}
            {section.map((entry, index) => (
              <div className="daily-order-row" key={`${entry.type}:${entry.id}`}>
                <span className="daily-order-name">
                  <strong>{entry.title}</strong>
                  <small>{entry.type === "chore" ? "Chore" : "Routine"}</small>
                </span>
                <label className="sr-only" htmlFor={`part-${entry.type}-${entry.id}`}>
                  Part of day for {entry.title}
                </label>
                <select
                  id={`part-${entry.type}-${entry.id}`}
                  value={entry.dayPart ?? ""}
                  onChange={(event) => changePart(entry, event.target.value ? (event.target.value as DayPart) : null)}
                >
                  <option value="">Unassigned</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
                <button
                  type="button"
                  className="icon-action-button"
                  title={`Move ${entry.title} up`}
                  aria-label={`Move ${entry.title} up`}
                  disabled={index === 0}
                  onClick={() => move(entry, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-action-button"
                  title={`Move ${entry.title} down`}
                  aria-label={`Move ${entry.title} down`}
                  disabled={index === section.length - 1}
                  onClick={() => move(entry, 1)}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            ))}
            {!section.length && <p className="form-hint">No items here yet.</p>}
          </div>
        );
      })}
      <button type="button" className="primary" disabled={!dirty || Boolean(busy)} onClick={save}>
        {busy === "daily-order-save" ? "Saving…" : "Save daily order"}
      </button>
    </section>
  );
}
