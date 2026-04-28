"use client";

import type { ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function MobileDrawer({ open, onOpenChange, children }: MobileDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-foreground/10 duration-200 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-50 p-3">
          <Drawer.Popup className="pointer-events-auto h-full w-[15rem] rounded-xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-left-4 data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-left-4 data-closed:fade-out-0">
            {children}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
