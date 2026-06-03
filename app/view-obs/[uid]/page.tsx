import { getSupabaseServerClient } from "@/lib/supabase/server"
import { OBSViewer } from "@/components/obs-viewer"

interface OBSViewPageProps {
  params: Promise<{ uid: string }>
  searchParams: Promise<{ size?: string; color?: string; position?: string; bg?: string }>
}

export default async function OBSViewPage({ params, searchParams }: OBSViewPageProps) {
  const { uid } = await params
  const { size = "lg", color = "white", position = "bottom", bg } = await searchParams
  const supabase = await getSupabaseServerClient()

  const { data: event } = await supabase.from("events").select("*").eq("uid", uid).single()

  if (!event) return null

  return <OBSViewer event={event} size={size} color={color} position={position} bg={bg} />
}
