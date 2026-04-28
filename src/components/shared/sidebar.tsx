"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export interface SidebarLink {
  href: string;
  label: string;
  icon: ReactNode;
  description?: string;
}

export interface SidebarGroup {
  label: string;
  links: SidebarLink[];
  defaultCollapsed?: boolean;
}

interface SidebarProps {
  title: string;
  subtitle?: string;
  links?: SidebarLink[];
  groups?: SidebarGroup[];
  matchMode?: "exact" | "prefix";
  collapsibleGroups?: boolean;
  headerAction?: ReactNode;
  onNavigate?: () => void;
}

export function Sidebar({
  title,
  subtitle,
  links = [],
  groups,
  matchMode = "prefix",
  collapsibleGroups = false,
  headerAction,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navGroups = useMemo(() => groups ?? [{ label: "导航", links }], [groups, links]);
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string) =>
    matchMode === "exact" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    onNavigate?.();

    try {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    navGroups.reduce<Record<string, boolean>>((acc, group) => {
      const hasActive = group.links.some((link) => isActive(link.href));
      acc[group.label] = !hasActive && Boolean(group.defaultCollapsed) && collapsibleGroups;
      return acc;
    }, {}),
  );

  return (
    <aside className="nav-rail flex h-full w-[15rem] flex-col overflow-hidden rounded-xl text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-[-0.02em]">{title}</p>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-sidebar-foreground/55">{subtitle}</p>
            )}
          </div>
          {headerAction}
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-label={`${title} 导航`}>
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            {(() => {
              const hasActive = group.links.some((link) => isActive(link.href));
              const isCollapsed =
                collapsibleGroups &&
                !hasActive &&
                (collapsedGroups[group.label] ?? Boolean(group.defaultCollapsed));
              const isOpen = !isCollapsed;

              return (
                <>
                  {collapsibleGroups ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left text-[0.68rem] font-medium tracking-wide text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/70"
                      aria-controls={`sidebar-group-${group.label}`}
                      aria-expanded={isOpen}
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.label]: !(
                            !hasActive &&
                            (prev[group.label] ?? Boolean(group.defaultCollapsed))
                          ),
                        }))
                      }
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          isOpen ? "rotate-0" : "-rotate-90",
                        )}
                      />
                    </button>
                  ) : (
                    <p className="px-2.5 text-[0.68rem] font-medium tracking-wide text-sidebar-foreground/38">
                      {group.label}
                    </p>
                  )}
                  <div
                    id={`sidebar-group-${group.label}`}
                    className={cn("space-y-1", !isOpen && "hidden")}
                  >
                    {group.links.map((link) => {
                      const active = isActive(link.href);

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "nav-link-premium group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md transition-colors",
                              active ? "bg-white/18 text-sidebar-primary-foreground" : "text-sidebar-foreground/52 group-hover:text-sidebar-foreground"
                            )}
                          >
                            {link.icon}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{link.label}</span>
                          {active && <span className="size-1.5 rounded-full bg-sidebar-primary-foreground/80" aria-hidden />}
                        </Link>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-3 py-3">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-base btn-cream w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-sidebar-foreground/75 hover:text-sidebar-foreground"
        >
          {signingOut ? "退出中..." : "退出登录"}
        </button>
      </div>
    </aside>
  );
}
