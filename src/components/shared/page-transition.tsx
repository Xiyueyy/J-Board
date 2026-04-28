"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setIsVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    }
  }, [pathname, prefersReducedMotion]);

  return (
    <div
      className={`transition-all duration-500 ease-[var(--ease-fluid)] ${
        isVisible || prefersReducedMotion
          ? "translate-y-0 scale-100 opacity-100 blur-0"
          : "translate-y-2 scale-[0.992] opacity-0 blur-[1px]"
      }`}
    >
      {children}
    </div>
  );
}
