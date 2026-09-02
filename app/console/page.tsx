import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ConsoleClient from "./console-client";

export default async function ConsolePage() {
  const session = (await cookies()).get("stashi_session")?.value;
  if (!session) redirect("/login");
  return <ConsoleClient email={session}/>;
}
