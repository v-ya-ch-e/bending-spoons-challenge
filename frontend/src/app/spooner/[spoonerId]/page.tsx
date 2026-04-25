import { redirect } from "next/navigation"

type SpoonerIdPageProps = {
  params: Promise<{
    spoonerId: string
  }>
}

export default async function SpoonerIdPage({ params }: SpoonerIdPageProps) {
  const { spoonerId } = await params
  redirect(`/spooner/${spoonerId}/my-project`)
}
