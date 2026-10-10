"use client";

import { useState, type FormEvent } from "react";
import { absenceDatesSchema, createAbsencesSchema, type MemberAbsence } from "@/lib/member-absence";

type Options = {
  perform: (key: string, action: () => Promise<void>) => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  setNotice: (message: string) => void;
};

export function useAbsenceManagement({ perform, request, setNotice }: Options) {
  const [editing, setEditing] = useState<MemberAbsence | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const reset = () => {
    setEditing(null);
    setMemberIds([]);
    setStartDate("");
    setEndDate("");
    setError("");
  };
  const edit = (range: MemberAbsence) => {
    setEditing(range);
    setMemberIds([range.memberId]);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setError("");
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = editing
      ? absenceDatesSchema.safeParse({ startDate, endDate })
      : createAbsencesSchema.safeParse({ memberIds, startDate, endDate });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Choose children and valid dates.");
      return;
    }
    setError("");
    void perform("absence", async () => {
      try {
        await request(editing ? `/api/v1/member-absences/${editing.id}` : "/api/v1/member-absences", {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(input.data),
        });
        setNotice(editing ? "Away dates updated." : "Vacation scheduled. Chores and routines will pause on away days.");
        reset();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Unable to save away dates.");
      }
    });
  };
  const remove = (range: MemberAbsence) =>
    void perform(`absence-${range.id}`, async () => {
      await request(`/api/v1/member-absences/${range.id}`, { method: "DELETE" });
      if (editing?.id === range.id) reset();
      setNotice("Away range deleted. Dates without another away range count normally again.");
    });
  return {
    editing,
    memberIds,
    setMemberIds,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    error,
    reset,
    edit,
    save,
    remove,
  };
}
