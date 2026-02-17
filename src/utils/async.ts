export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  delay: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: TArgs) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
