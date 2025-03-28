"use client";

import { useEffect } from "react";

export default function HydrationFix() {
  useEffect(() => {
    // Remove Grammarly attributes if they exist
    const body = document.querySelector("body");
    if (body) {
      body.removeAttribute("data-new-gr-c-s-check-loaded");
      body.removeAttribute("data-gr-ext-installed");
    }
  }, []);

  return null;
}
