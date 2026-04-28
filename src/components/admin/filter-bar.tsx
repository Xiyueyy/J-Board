import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AdminFilterOption {
  label: string;
  value: string;
}

export interface AdminFilterSelect {
  name: string;
  value: string;
  options: AdminFilterOption[];
}

export function AdminFilterBar({
  q,
  searchPlaceholder,
  selects = [],
  children,
}: {
  q?: string;
  searchPlaceholder?: string;
  selects?: AdminFilterSelect[];
  children?: React.ReactNode;
}) {
  return (
    <form className="surface-card flex flex-col gap-3 rounded-xl p-3 md:flex-row md:flex-wrap md:items-end" role="search">
      <div className="min-w-0 md:min-w-[16rem] md:flex-[1_1_18rem]">
        <label className="sr-only" htmlFor="admin-filter-search">
          {searchPlaceholder ?? "搜索"}
        </label>
        <Input
          id="admin-filter-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={searchPlaceholder ?? "搜索"}
          className="h-11"
        />
      </div>
      {selects.map((select) => (
        <div key={select.name} className="md:min-w-[11rem] md:flex-[1_1_11rem]">
          <label className="sr-only" htmlFor={`admin-filter-${select.name}`}>
            {select.options[0]?.label ?? select.name}
          </label>
          <select
            id={`admin-filter-${select.name}`}
            name={select.name}
            defaultValue={select.value}
            className="h-11 w-full px-3 text-sm outline-none"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit" className="h-11 md:flex-none">
        筛选
      </Button>
      {children}
    </form>
  );
}
