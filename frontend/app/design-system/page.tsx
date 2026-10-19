import type { Metadata } from "next"
import { ToastProvider } from "@/components/ui"
import { DesignSystemPreview } from "./preview"
import "./preview.css"

export const metadata: Metadata = {
  title: "Design system — internal",
  robots: { index: false, follow: false },
}

export default function DesignSystemPage() {
  return (
    <ToastProvider>
      <DesignSystemPreview />
    </ToastProvider>
  )
}
