export async function POST(request: Request) {
  void request;
  return Response.json(
    {
      error: "Public signup is disabled. Accounts must be provisioned manually by an administrator.",
    },
    { status: 403 },
  );
}
