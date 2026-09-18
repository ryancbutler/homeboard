import { FormEvent, useMemo, useState } from "react";
import { formSchedule, matchingIcons } from "./parent-utils";

export type RoutineTemplate = {
  id: string;
  title: string;
  icon: string | null;
  assignmentPolicy: string;
  scheduleKind: string;
  startDate: string;
  dueTime: string | null;
  weekdays: number[];
  steps: { id: string; position: number; title: string; icon: string | null }[];
  assignees: { id: string; name: string }[];
};

type RoutineStepDraft = { title: string; icon: string };
type Options = {
  perform: (key: string, action: () => Promise<void>) => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  setNotice: (notice: string) => void;
  timezone: string;
  selectRoutines: () => void;
};

export function useRoutineManagement({ perform, request, setNotice, timezone, selectRoutines }: Options) {
  const [editingRoutine, setEditingRoutine] = useState<RoutineTemplate | null>(null);
  const [routineScheduleKind, setRoutineScheduleKind] = useState("daily");
  const [routineWeekdays, setRoutineWeekdays] = useState<number[]>([1]);
  const [routineTitleInput, setRoutineTitleInput] = useState("");
  const [routineIcon, setRoutineIcon] = useState("");
  const [routineIconFilter, setRoutineIconFilter] = useState("");
  const [routineAssigneeIds, setRoutineAssigneeIds] = useState<string[]>([]);
  const [routineSteps, setRoutineSteps] = useState<RoutineStepDraft[]>([{ title: "", icon: "" }, { title: "", icon: "" }, { title: "", icon: "" }]);
  const filteredRoutineIcons = useMemo(() => matchingIcons(routineIconFilter), [routineIconFilter]);

  const startEditRoutine = (routine: RoutineTemplate) => {
    setEditingRoutine(routine);
    setRoutineTitleInput(routine.title);
    setRoutineScheduleKind(routine.scheduleKind);
    setRoutineWeekdays(routine.weekdays.length ? routine.weekdays : [1]);
    setRoutineIcon(routine.icon ?? "");
    setRoutineIconFilter("");
    setRoutineAssigneeIds(routine.assignees.map((assignee) => assignee.id));
    setRoutineSteps(routine.steps.length ? routine.steps.map((step) => ({ title: step.title, icon: step.icon ?? "" })) : [{ title: "", icon: "" }]);
    selectRoutines();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditRoutine = () => {
    setEditingRoutine(null);
    setRoutineTitleInput("");
    setRoutineScheduleKind("daily");
    setRoutineWeekdays([1]);
    setRoutineIcon("");
    setRoutineIconFilter("");
    setRoutineAssigneeIds([]);
    setRoutineSteps([{ title: "", icon: "" }, { title: "", icon: "" }, { title: "", icon: "" }]);
  };

  const saveRoutine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const title = String(new FormData(element).get("routineTitle"));
    const steps = routineSteps
      .map((step) => ({ title: step.title.trim(), icon: step.icon || null }))
      .filter((step) => Boolean(step.title));
    if (!steps.length) {
      setNotice("Please add at least one step for this routine.");
      return;
    }

    void perform("routine-save", async () => {
      const payload = {
        title,
        icon: routineIcon || null,
        assigneeIds: routineAssigneeIds,
        steps,
        schedule: formSchedule(routineScheduleKind, routineWeekdays, timezone)
      };
      if (editingRoutine) {
        await request(`/api/v1/routine-templates/${editingRoutine.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice(`Routine "${title}" updated.`);
      } else {
        await request("/api/v1/routine-templates", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Routine "${title}" created.`);
      }
      cancelEditRoutine();
      element.reset();
    });
  };

  const deleteRoutine = (id: string, title: string) => {
    if (!window.confirm(`Delete routine "${title}"?`)) return;
    void perform(`del-routine-${id}`, async () => {
      await request(`/api/v1/routine-templates/${id}`, { method: "DELETE" });
      setNotice(`Routine "${title}" deleted.`);
    });
  };

  return {
    editingRoutine, routineScheduleKind, setRoutineScheduleKind, routineWeekdays, setRoutineWeekdays, routineTitleInput,
    setRoutineTitleInput, routineIcon, setRoutineIcon, routineIconFilter, setRoutineIconFilter, routineAssigneeIds,
    setRoutineAssigneeIds, routineSteps, setRoutineSteps, filteredRoutineIcons, startEditRoutine, cancelEditRoutine,
    saveRoutine, deleteRoutine
  };
}
