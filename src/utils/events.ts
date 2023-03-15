export const nodeIsTextInput = (activeElement: Element | null): boolean => {
  switch (activeElement?.nodeName) {
    case 'INPUT':
    case 'TEXTAREA':
    case 'SELECT':
    case 'OPTION':
      return true;
  }
  if (typeof activeElement?.getAttribute('contenteditable') === 'string') return true;
  return false;
}