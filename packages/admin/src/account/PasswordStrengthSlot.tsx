import { PasswordStrengthMeter } from "../password-strength/PasswordStrengthMeter.js";
import { usePasswordStrength } from "../password-strength/usePasswordStrength.js";

interface PasswordStrengthSlotProps {
  password: string;
  /** The meter's text id, for the password input's aria-describedby. */
  id: string;
  /** Whose password it is, so their name and email count against it, as the API does. */
  personName?: string;
  personEmail?: string;
}

/**
 * The password strength meter under every "choose a new password" field outside setup:
 * accepting an invitation, resetting a forgotten password and changing it on the account
 * page. Uses the same checker as setup and the API (see password-strength/), so a password
 * the meter calls good is one the API accepts.
 */
export function PasswordStrengthSlot({
  password,
  id,
  personName = "",
  personEmail = "",
}: PasswordStrengthSlotProps) {
  const strength = usePasswordStrength(password, personName, personEmail);
  return <PasswordStrengthMeter id={id} strength={password ? strength : undefined} />;
}
