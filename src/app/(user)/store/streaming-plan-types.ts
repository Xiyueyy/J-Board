export interface StreamingPlan {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  durationDays: number;
  price: number;
  serviceName: string | null;
  totalLimit: number | null;
  perUserLimit: number | null;
  activeCount: number;
  remainingCount: number | null;
  remainingByUserLimit: number | null;
  isAvailable: boolean;
  nextAvailableAt: string | null;
}
