interface DisplayPlanBase {
  id: string;
  name: string;
  sortOrder: number;
}

export function sortPlansForDisplay<T extends DisplayPlanBase>(plans: T[]): T[] {
  return [...plans].sort((a, b) => {
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN");
  });
}
