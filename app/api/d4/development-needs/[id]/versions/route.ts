import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { addDevelopmentVersion } from "@/modules/d4/server/development-needs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => addDevelopmentVersion(request, id), 201);
}

const notAllowed = methodNotAllowed("POST");
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
