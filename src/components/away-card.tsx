import { CalendarDays } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";

export function AwayCard({
  child,
  className,
  headingLevel = 2,
}: {
  child: DashboardData["children"][number];
  className: string;
  headingLevel?: 2 | 3;
}) {
  if (!child.away) return null;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const format = (day: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(`${day}T12:00:00Z`)
    );
  return (
    <article className={`${className} child-away-card`}>
      <header className="child-col-header">
        <div className="child-avatar" style={{ backgroundColor: child.color }} aria-hidden="true">
          {child.name.slice(0, 1)}
        </div>
        <Heading className="child-name">{child.name}</Heading>
      </header>
      <div className="away-message">
        <CalendarDays size={28} aria-hidden="true" />
        <strong>Away through {format(child.away.endDate)}</strong>
        <p>Chores and routines are paused.</p>
        <p>Back on {format(child.away.returnDate)}.</p>
      </div>
    </article>
  );
}
