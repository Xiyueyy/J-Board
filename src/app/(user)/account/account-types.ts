export interface AccountPanelUser {
  email: string;
  name: string | null;
  inviteCode: string | null;
  createdAt: string;
  invitedUsersCount: number;
  inviteRewardCount: number;
  inviteRewardAmount: number;
}
