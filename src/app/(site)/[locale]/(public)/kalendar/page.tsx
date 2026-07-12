import { redirect } from "next/navigation";

export default function KalendarPage() {
  redirect("/takmicenja?view=cal");
}
