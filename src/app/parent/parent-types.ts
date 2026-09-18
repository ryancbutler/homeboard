export type Member = { id: string; role: string; displayName: string; email: string | null; color: string; active: boolean };

export type ChoreGroup = {
  id: string;
  name: string;
  assignedMemberId: string | null;
  assignedMemberName: string;
  templateCount: number;
};

export type ChoreGroupRotation = {
  id: string;
  startDate: string;
  firstGroup: { id: string; name: string };
  secondGroup: { id: string; name: string };
  firstMember: { id: string; name: string };
  secondMember: { id: string; name: string };
  current: { firstGroupMemberId: string | null; secondGroupMemberId: string | null };
  next: { firstGroupMemberId: string | null; secondGroupMemberId: string | null };
};
