import { HeartHandshake } from "lucide-react";
import { fetchParents } from "@/lib/data/dashboard";
import { ParentsTableClient } from "@/app/_components/parents/ParentsTableClient";
import ListPageShell from "@/app/_components/shared/ListPageShell";

export const metadata = {
  title: "Parents | Kibera Academy",
  description: "Parent and guardian register",
};

export default async function ParentsPage() {
  const parents = await fetchParents();

  return (
    <ListPageShell
      icon={<HeartHandshake className="h-6 w-6 text-sky-400" />}
      iconBg="bg-sky-400/10 border-sky-400/20"
      subtitle="Parents & Guardians"
      title="Parent Register"
    >
      <ParentsTableClient parents={parents} />
    </ListPageShell>
  );
}
