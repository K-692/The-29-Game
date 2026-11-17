/** URL for a file in /public, correct both locally and under the GitHub Pages sub-path. */
export const asset = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
};
