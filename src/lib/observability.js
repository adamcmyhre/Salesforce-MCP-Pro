import { randomUUID } from "node:crypto";

function parseJsonSafely(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseToolResponsePayload(response) {
  const textContent = response?.content?.find((entry) => entry?.type === "text")?.text;
  return parseJsonSafely(textContent);
}

function inferHandledErrorClass(errorMessage) {
  const message = String(errorMessage ?? "");
  if (message.includes("Salesforce CLI command failed")) {
    return "SfCommandError";
  }
  if (message.includes("Git command failed")) {
    return "GitCommandError";
  }
  if (message.includes("Failed to parse Salesforce CLI JSON output")) {
    return "SfCommandError";
  }
  return "HandledToolError";
}

function extractOrgAlias(input, payload) {
  const fromInput = input?.targetOrg ?? input?.targetDevHub ?? null;
  if (fromInput) {
    return fromInput;
  }

  const data = payload?.data;
  return data?.targetOrg ?? data?.targetDevHub ?? null;
}

function logToolEvent(event) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      component: "tool-observability",
      ...event,
    })
  );
}

export function withObservedToolExecution(toolName, handler) {
  return async (input = {}) => {
    const requestId = randomUUID();
    const startedAtMs = Date.now();
    const inputOrgAlias = extractOrgAlias(input, null);

    logToolEvent({
      event: "tool.start",
      requestId,
      toolName,
      orgAlias: inputOrgAlias,
    });

    try {
      const response = await handler(input);
      const durationMs = Date.now() - startedAtMs;
      const payload = parseToolResponsePayload(response);
      const orgAlias = extractOrgAlias(input, payload);

      if (response?.isError === true || payload?.success === false) {
        const errorMessage = payload?.error ?? "Tool returned an error response.";
        const errorClass = payload?.errorClass ?? inferHandledErrorClass(errorMessage);

        logToolEvent({
          event: "tool.error",
          requestId,
          toolName,
          orgAlias,
          durationMs,
          errorClass,
          errorMessage,
          handled: true,
        });
      } else {
        logToolEvent({
          event: "tool.end",
          requestId,
          toolName,
          orgAlias,
          durationMs,
          status: "success",
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAtMs;
      const orgAlias = extractOrgAlias(input, null);
      logToolEvent({
        event: "tool.error",
        requestId,
        toolName,
        orgAlias,
        durationMs,
        errorClass: error?.name ?? "Error",
        errorMessage: error?.message ?? String(error),
        handled: false,
      });
      throw error;
    }
  };
}
