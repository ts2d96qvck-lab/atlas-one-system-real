"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gap={8}
      offset={16}
      duration={3500}
      toastOptions={{
        className: "atlas-toast",
        classNames: {
          title: "atlas-toast-title",
          description: "atlas-toast-description"
        }
      }}
    />
  );
}
