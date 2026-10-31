const request = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(`/api${url}`, {
      ...options,
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }
  return data;
};

export const get = (url) => request(url);
export const post = (url, body) => request(url, { method: "POST", body: body ?? {} });
export const remove = (url) => request(url, { method: "DELETE" });
