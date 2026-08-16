import { IssuePage } from "@/components/workspace/issue-page";

export default async function IssueRoute({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const number = Number.parseInt(n, 10);

  return <IssuePage number={Number.isFinite(number) ? number : 0} />;
}
