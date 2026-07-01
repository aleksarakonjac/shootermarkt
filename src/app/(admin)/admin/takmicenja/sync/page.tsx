import type { Metadata } from "next";
import { CompetitionsSyncClient } from "./competitions-sync-client";

export const metadata: Metadata = { title: "Admin · Sync takmičenja" };

export default function TakmicenjaSyncPage() {
  return <CompetitionsSyncClient />;
}
