import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  loadPasswordStrength,
  type PasswordStrength,
  type PasswordStrengthModule,
} from "./passwordStrength.js";

/**
 * How strong `password` is, for someone with this name and email. Undefined while the checker
 * is loading, if it couldn't be loaded (the API still checks), and while the field is empty.
 *
 * The check runs on a deferred copy of the password, so typing never waits for it.
 */
export function usePasswordStrength(
  password: string,
  name: string,
  email: string,
): PasswordStrength | undefined {
  const [checker, setChecker] = useState<PasswordStrengthModule>();
  const deferredPassword = useDeferredValue(password);

  useEffect(() => {
    let isCurrent = true;
    loadPasswordStrength().then(
      (loaded) => isCurrent && setChecker(loaded),
      // Without the checker the screen falls back to the length rule; the API has the final say.
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  const personalDetails = useMemo(
    () => checker?.personalDetailsFrom(name, email) ?? [],
    [checker, name, email],
  );

  return useMemo(() => {
    if (!checker || !deferredPassword) return undefined;
    return checker.checkPasswordStrength(deferredPassword, personalDetails);
  }, [checker, deferredPassword, personalDetails]);
}
