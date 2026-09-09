/** Study commands leave native editing and control keyboard behavior intact. */
export function studyShortcut(e: KeyboardEvent, dialogOpen: boolean) {
  const target = e.target as HTMLElement | null;
  if (
    dialogOpen ||
    e.defaultPrevented ||
    e.repeat ||
    e.isComposing ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    e.shiftKey
  )
    return null;
  if (
    target?.closest?.(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="listbox"],[role="menu"],[role="slider"]',
    )
  )
    return null;
  if (target?.closest?.('button,a,[role="button"]') && !target.closest('.study-face')) return null;
  if (e.code === 'Space' || ['ArrowUp', 'ArrowDown'].includes(e.key)) return 'flip';
  if (e.key === 'ArrowLeft') return 'previous';
  if (e.key === 'ArrowRight') return 'next';
  if (e.key === 'Escape') return 'exit';
  return null;
}
