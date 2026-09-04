// Wraps a promise so it can never hang a UI forever — if it hasn't settled
// within `ms`, the returned promise rejects and the caller's existing error
// handling takes over instead of leaving a spinner/button stuck indefinitely.
export function withTimeout<T>(promise: Promise<T>, ms: number, message = "Request timed out."): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
