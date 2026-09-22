import { redirect } from "next/navigation";
import { listActivity, listDatabases, listNodes } from "@/lib/store";
import ConsoleClient from "./console-client";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/sign-in?redirectTo=/console");
  const databases = await listDatabases(email);
  const activity = await listActivity(email);
  const [primaryNode] = await listNodes();
  return (
    <ConsoleClient
      email={email}
      initialDatabases={databases}
      initialActivity={activity}
      primaryNode={primaryNode}
    />
  );
}
