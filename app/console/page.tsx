import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listActivity, listDatabases, listNodes } from "@/lib/store";
import ConsoleClient from "./console-client";

export default async function ConsolePage() {
  const session = (await cookies()).get("stashi_session")?.value;
  if (!session) redirect("/login");
  const databases = await listDatabases(session);
  const activity = await listActivity(session);
  const [primaryNode] = await listNodes();
  return (
    <ConsoleClient
      email={session}
      initialDatabases={databases}
      initialActivity={activity}
      primaryNode={primaryNode}
    />
  );
}
