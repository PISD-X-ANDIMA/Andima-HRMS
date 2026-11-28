import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { completeTraining } from "@/modules/d4/server/training-records";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => completeTraining(request, id), 201);
}

const notAllowed = methodNotAllowed("POST");
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
