export const nodeIsTextInput = (activeElement: Element | null): boolean => {
  switch (activeElement?.nodeName) {
    case 'INPUT':
      return !['range', 'button', 'checkbox', 'number'].includes(activeElement.getAttribute('type') || '');
    case 'TEXTAREA':
      // case 'SELECT':
      // case 'OPTION':
      return true;
  }
  if (typeof activeElement?.getAttribute('contenteditable') === 'string') return true;
  return false;
};
