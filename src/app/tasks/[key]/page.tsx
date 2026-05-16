import TaskCasePage from "@/components/task-case-page";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <TaskCasePage caseKey={decodeURIComponent(key)} />;
}
