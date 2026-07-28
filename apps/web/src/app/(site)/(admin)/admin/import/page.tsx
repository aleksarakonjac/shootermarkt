import { redirect } from "next/navigation";

export const metadata = { title: "Import PDF biltena" };

export default function ImportPage() {
  redirect("/admin/rezultati?mode=pdf");
}
