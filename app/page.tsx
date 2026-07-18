import type { Metadata } from "next";
import { FishVJConsole } from "./components/FishVJConsole";

export const metadata: Metadata = {
  title: "FishVJ — Live AI Fish Visual Instrument",
  description:
    "A live, audio-reactive fish visual instrument with individual GPU animation, color macros and Infinite Dive.",
};

export default function Home() {
  return <FishVJConsole />;
}
