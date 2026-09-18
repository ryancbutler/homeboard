import { mondayOfWeek } from "@/lib/dates";

export type ChoreGroupRotation = {
  id: string;
  first_group_id: string;
  second_group_id: string;
  first_member_id: string;
  second_member_id: string;
  start_date: string;
};

export function rotationAssignee(rotation: ChoreGroupRotation, groupId: string, day: string): string | null {
  if (groupId !== rotation.first_group_id && groupId !== rotation.second_group_id) return null;
  const start = new Date(`${rotation.start_date}T00:00:00.000Z`).getTime();
  const week = new Date(`${mondayOfWeek(day)}T00:00:00.000Z`).getTime();
  if (week < start) return null;
  const swaps = Math.floor((week - start) / (7 * 86_400_000));
  const firstHasFirstChild = swaps % 2 === 0;
  if (groupId === rotation.first_group_id) return firstHasFirstChild ? rotation.first_member_id : rotation.second_member_id;
  return firstHasFirstChild ? rotation.second_member_id : rotation.first_member_id;
}
