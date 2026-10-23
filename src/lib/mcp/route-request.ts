export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params: Record<string, unknown>;
};

export function parseJsonRpcRequest(value: unknown): JsonRpcRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const request = value as Record<string, unknown>;
  const id = request.id;
  if (
    request.jsonrpc !== "2.0" ||
    typeof request.method !== "string" ||
    !request.method.trim() ||
    (id !== undefined &&
      id !== null &&
      typeof id !== "string" &&
      (typeof id !== "number" || !Number.isFinite(id)))
  ) {
    return null;
  }
  const params = request.params === undefined ? {} : request.params;
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return null;
  }
  return {
    id: id === undefined ? null : id,
    method: request.method,
    params: params as Record<string, unknown>,
  };
}

export function parseToolCall(params: Record<string, unknown>) {
  const name = params.name;
  const args = params.arguments === undefined ? {} : params.arguments;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof args !== "object" ||
    args === null ||
    Array.isArray(args)
  ) {
    return null;
  }
  const argumentsValue = args as Record<string, unknown>;
  if (
    argumentsValue.case_id !== undefined &&
    (typeof argumentsValue.case_id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(argumentsValue.case_id))
  ) {
    return null;
  }
  return { name, arguments: argumentsValue };
}
