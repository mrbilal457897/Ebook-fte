import type { Metadata } from "next"
import { MotionDemo } from "./motion-demo"
import "./demo.css"

export const metadata: Metadata = {
  title: "Motion demo — internal",
  robots: { index: false, follow: false },
}

export default function MotionDemoPage() {
  return <MotionDemo />
}
