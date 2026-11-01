import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { NewPasswordField } from "../account/NewPasswordField.js";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { acceptInvitation } from "../session/session.api.js";
import { passwordIsLongEnough } from "../setup/accountDetails.js";
import { PublicScreen } from "../sign-in/PublicScreen.js";
import { tokenFromAddress } from "../sign-in/tokenFromAddress.js";
import { type InvitationPreview, previewInvitation } from "./people.api.js";

/** /accept-invitation#token=...: the new person chooses their name and password. */
export function AcceptInvitationPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [token] = useState(() => tokenFromAddress());
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [problem, setProblem] = useState(token ? "" : t("acceptInvitation.invalid"));
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    previewInvitation(token).then(setPreview, (error: unknown) =>
      setProblem(describeFormError(error)),
    );
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setIsJoining(true);
    setProblem("");
    try {
      await acceptInvitation(token, name.trim(), password);
      await router.invalidate();
      await navigate({ to: "/" });
    } catch (error) {
      setProblem(describeFormError(error));
      setIsJoining(false);
    }
  }

  if (!preview) {
    return (
      <PublicScreen
        title={t("acceptInvitation.title")}
        subtitle={problem || t("acceptInvitation.checking")}
      >
        <span />
      </PublicScreen>
    );
  }

  return (
    <PublicScreen
      title={t("acceptInvitation.title")}
      subtitle={
        preview.invitedByName
          ? t("acceptInvitation.subtitleFrom", {
              name: preview.invitedByName,
              role: preview.roleName,
            })
          : t("acceptInvitation.subtitle", { role: preview.roleName })
      }
    >
      <form onSubmit={(event) => void submit(event)} className="mt-10 flex flex-col gap-6">
        <TextField
          fieldSize="large"
          label={t("signIn.email")}
          value={preview.email}
          readOnly
          autoComplete="username"
        />
        <TextField
          fieldSize="large"
          label={t("acceptInvitation.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={100}
          required
          autoFocus
        />
        <NewPasswordField
          fieldSize="large"
          label={t("acceptInvitation.password")}
          value={password}
          onValueChange={setPassword}
          required
        />
        <Button
          type="submit"
          size="extra-large"
          fullWidth
          disabled={isJoining || name.trim() === "" || !passwordIsLongEnough(password)}
        >
          {isJoining ? t("acceptInvitation.joining") : t("acceptInvitation.join")}
        </Button>
      </form>
      <p role="alert" className="mt-5 text-footnote text-danger empty:mt-0">
        {problem}
      </p>
    </PublicScreen>
  );
}
