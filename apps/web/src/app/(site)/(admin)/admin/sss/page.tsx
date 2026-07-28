import { redirect } from "next/navigation";

export const metadata = { title: "Admin · SSS Bilteni" };

export default function SssImportPage() {
  redirect("/admin/rezultati?mode=sss");
}
