import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { getDevelopment } from "@/modules/d4/server/development-needs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => getDevelopment(id));
}

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
