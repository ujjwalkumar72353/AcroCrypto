export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const handle = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const parseBody = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, `${issue.path.join(".") || "Request"}: ${issue.message}`);
  }
  return result.data;
};
