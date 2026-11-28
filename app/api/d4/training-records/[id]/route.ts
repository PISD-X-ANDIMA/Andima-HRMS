import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { getTraining } from "@/modules/d4/server/training-records";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => getTraining(id));
}

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
