/**
 * YAML syntax highlighter for code examples
 * Used to highlight YAML syntax in documentation code blocks
 */
export const highlightYamlCode = (yaml) => {
  let highlighted = yaml
    .replaceAll(
      /(#.*$)/gm,
      '<span class="text-success-600 dark:text-success-400">$1</span>',
    )
    .replaceAll(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm,
      '$1<span class="text-primary-600 dark:text-primary-400 font-semibold">$2</span>:',
    )
    .replaceAll(
      /:\s*["']([^"']*?)["']/g,
      ': <span class="text-warning-600 dark:text-warning-400">"$1"</span>',
    )
    .replaceAll(
      /(https?:\/\/[^\s]+)/g,
      '<span class="text-secondary-600 dark:text-secondary-400 underline">$1</span>',
    )
    .replaceAll(
      /(\{[^}]+\})/g,
      '<span class="text-danger-600 dark:text-danger-400 font-medium">$1</span>',
    )
    .replaceAll(
      /:\s*(\d+\.?\d*)\s*$/gm,
      ': <span class="text-secondary-600 dark:text-secondary-400">$1</span>',
    )
    .replaceAll(
      /:\s*(true|false)\s*$/gm,
      ': <span class="text-danger-600 dark:text-danger-400">$1</span>',
    )
    .replaceAll(
      /^(\s*)-\s+/gm,
      '$1<span class="text-default-600 dark:text-default-400">-</span> ',
    );

  return highlighted;
};
