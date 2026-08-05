export function success(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          data,
        }),
      },
    ],
  };
}

export function failure(error, details = null) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: false,
          error,
          details,
        }),
      },
    ],
    isError: true,
  };
}
