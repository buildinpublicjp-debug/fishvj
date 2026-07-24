import type { Metadata } from "next";
import "./instrument.css";
import { InstrumentConsole } from "../components/InstrumentConsole";

export const metadata: Metadata = {
  title: "FishVJ — Instrument",
  description: "FishVJ DJ/VJ performance surface: deck A/B, spatial EQ, crossfader, quantized launch.",
};

export default function InstrumentPage() {
  return <InstrumentConsole />;
}
