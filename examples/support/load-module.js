/**
 * Attempts to import a workspace package first, then falls back to the
 * zero-dependency implementation that lives inside this repository.
 * This keeps the examples runnable even before the packages are published.
 *
 * @param {string} specifier - e.g., '@proto/data'
 * @param {string} fallbackRelativePath - path relative to this helper file
 * @returns {Promise<Record<string, any>>}
 */
export async function loadModule(specifier, fallbackRelativePath) {
  try {
    return await import(specifier);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }
    const fallbackUrl = new URL(fallbackRelativePath, import.meta.url);
    return import(fallbackUrl);
  }
}
