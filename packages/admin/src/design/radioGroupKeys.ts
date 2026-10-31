/**
 * Where a key press moves the selection in a radio group of `optionCount` options:
 * the arrow keys step and wrap at the ends, Home and End jump. Undefined for any other key.
 * Shared by SegmentedControl and ChoiceCardGroup so every radio group behaves the same.
 */
export function radioGroupTargetIndex(
  key: string,
  currentIndex: number,
  optionCount: number,
): number | undefined {
  const lastIndex = optionCount - 1;
  const previousIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
  const nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
  const targetIndexByKey: Partial<Record<string, number>> = {
    ArrowLeft: previousIndex,
    ArrowUp: previousIndex,
    ArrowRight: nextIndex,
    ArrowDown: nextIndex,
    Home: 0,
    End: lastIndex,
  };
  return targetIndexByKey[key];
}
