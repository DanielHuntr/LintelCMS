import { featuresForSiteType } from "@lintel/core/site-presets";
import { useEffect, useState } from "react";
import { ApiError } from "../api/client.js";
import { t } from "../i18n/strings.js";
import { FullScreenLayout } from "../layout/FullScreenLayout.js";
import type { PasswordStrength } from "../password-strength/passwordStrength.js";
import type { Session } from "../session/session.api.js";
import {
  accountFields,
  accountProblems,
  cleanAccountDetails,
  firstProblemField,
  type AccountForm,
  type AccountProblems,
} from "./accountDetails.js";
import { placeFinishProblem } from "./finishProblems.js";
import {
  readPostgresForm,
  placeDatabaseProblem,
  type ConnectionErrors,
} from "./postgresConnection.js";
import { CreateAccountScreen } from "./screens/CreateAccountScreen.js";
import { DatabaseScreen } from "./screens/DatabaseScreen.js";
import { DoneScreen } from "./screens/DoneScreen.js";
import { PostgresScreen, type TestOutcome } from "./screens/PostgresScreen.js";
import { ReviewScreen } from "./screens/ReviewScreen.js";
import { SetupCodeScreen } from "./screens/SetupCodeScreen.js";
import { SiteNameScreen } from "./screens/SiteNameScreen.js";
import { SiteTypeScreen } from "./screens/SiteTypeScreen.js";
import { WelcomeScreen } from "./screens/WelcomeScreen.js";
import type { SetupApi, SetupAnswersToSend, SetupStatus } from "./setup.api.js";
import {
  emptyAnswers,
  forgetSetup,
  rememberedSetup,
  rememberSetup,
  type SetupAnswers,
} from "./setupAnswers.js";
import { rememberedSetupCode, rememberSetupCode, setupCodeLength } from "./setupCode.js";
import { explainSetupFailure } from "./setupErrors.js";
import { setupStepsFor, stepOfScreen } from "./setupRouting.js";
import { siteNameProblem } from "./siteName.js";
import { StepIndicator } from "./StepIndicator.js";
import { useSetupNavigation } from "./useSetupNavigation.js";

interface SetupWizardProps {
  status: SetupStatus;
  api: Pick<SetupApi, "testDatabaseConnection" | "finishSetup">;
  /** After "You're all set": the owner is signed in by now. */
  onFinished: (session: Session) => void;
  onAlreadySetUp: () => void;
}

/**
 * /setup: welcome, the setup code (from another computer only), then five steps with an
 * indicator along the top: Database, Your account, Site name, What you're building and
 * Review. Steps only check answers; "Finish setup" on the review sends everything at once.
 * The answers live here (and, without passwords, in sessionStorage), so neither switching
 * steps nor refreshing loses anything.
 */
export function SetupWizard({ status, api, onFinished, onAlreadySetUp }: SetupWizardProps) {
  const [restored] = useState(() => restoredSetup(status));
  const [answers, setAnswers] = useState<SetupAnswers>(restored?.answers ?? emptyAnswers);
  const flow = useSetupNavigation(status, answers.databaseKind, restored?.progress);
  const [setupCode, setSetupCode] = useState(rememberedSetupCode() ?? "");
  const [setupCodeError, setSetupCodeError] = useState<string>();
  const [connectionErrors, setConnectionErrors] = useState<ConnectionErrors>({});
  const [accountErrors, setAccountErrors] = useState<AccountProblems>({});
  const [siteNameError, setSiteNameError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [session, setSession] = useState<Session>();

  const { screen } = flow;
  const codeToSend = status.requiresSetupCode ? setupCode : undefined;
  const wasReloaded = restored !== undefined;

  useEffect(() => {
    if (screen !== "done") rememberSetup(answers, flow.progress);
  }, [answers, flow.progress, screen]);

  function change(changes: Partial<SetupAnswers>) {
    setAnswers({ ...answers, ...changes });
    setStatusMessage("");
    // A changed answer needs checking again before finishing.
    setIsConfirmed(false);
  }

  function changeAccount(changes: Partial<AccountForm>) {
    change({ account: { ...answers.account, ...changes } });
    const remaining = { ...accountErrors };
    for (const field of accountFields) if (field in changes) delete remaining[field];
    setAccountErrors(remaining);
  }

  function continueFromSetupCode() {
    if (setupCode.length !== setupCodeLength) {
      setSetupCodeError(t("setupCode.incomplete", { length: String(setupCodeLength) }));
      return;
    }
    rememberSetupCode(setupCode);
    flow.next();
  }

  function continueFromPostgres() {
    const result = readPostgresForm(answers.postgres);
    setConnectionErrors(result.errors ?? {});
    if (result.errors) focusField(Object.keys(result.errors)[0]);
    else flow.next();
  }

  async function testConnection(): Promise<TestOutcome> {
    const result = readPostgresForm(answers.postgres);
    setConnectionErrors(result.errors ?? {});
    if (result.errors) return "failed";
    try {
      await api.testDatabaseConnection(result.connection, codeToSend);
      return "passed";
    } catch (error) {
      // Not finding the database is fine when Lintel is going to create it.
      if (answers.postgres.createIfMissing && hasCode(error, "DATABASE_NOT_FOUND")) {
        return "passed-will-create";
      }
      showProblem(error, (problem) => {
        const placed = placeDatabaseProblem(problem);
        setConnectionErrors(placed.errors);
        setStatusMessage(placed.statusMessage);
        focusField(placed.field);
      });
      return "failed";
    }
  }

  function continueFromAccount(strength: PasswordStrength | undefined) {
    const problems = accountProblems(answers.account, strength);
    setAccountErrors(problems);
    const firstProblem = firstProblemField(problems);
    if (firstProblem) focusField(firstProblem);
    else flow.next();
  }

  function continueFromSiteName() {
    const problem = siteNameProblem(answers.siteName);
    setSiteNameError(problem);
    if (!problem) flow.next();
  }

  /** Checks the steps a reload or a jump could have left unfinished, then sends everything. */
  async function finish() {
    const accountProblem = firstProblemField(accountProblems(answers.account, undefined));
    if (accountProblem) {
      setAccountErrors(accountProblems(answers.account, undefined));
      flow.goToStep("account");
      return;
    }
    if (siteNameProblem(answers.siteName)) {
      setSiteNameError(siteNameProblem(answers.siteName));
      flow.goToStep("site-name");
      return;
    }

    setIsFinishing(true);
    setStatusMessage("");
    try {
      setSession(await api.finishSetup(answersToSend(answers, status), codeToSend));
      forgetSetup();
      flow.show("done");
    } catch (error) {
      showProblem(error, () => showFinishProblem(error));
    } finally {
      setIsFinishing(false);
    }
  }

  function showFinishProblem(error: unknown) {
    const placed = error instanceof ApiError ? placeFinishProblem(error) : undefined;
    if (!placed) {
      setStatusMessage(error instanceof ApiError ? error.message : t("setup.unreachable"));
      return;
    }
    setAccountErrors(placed.accountErrors);
    setConnectionErrors(placed.connectionErrors);
    setSiteNameError(placed.siteNameError);
    const usesPostgres = placed.step === "database" && answers.databaseKind === "postgres";
    flow.show(usesPostgres ? "postgres" : placed.step, "back");
    setStatusMessage(placed.statusMessage);
  }

  /** "Already set up" and a refused setup code change the page; the rest is for the step. */
  function showProblem(
    error: unknown,
    showOnStep: (problem: { code?: string; message: string }) => void,
  ) {
    const failure = explainSetupFailure(error);
    if (failure.kind === "already-set-up") {
      forgetSetup();
      onAlreadySetUp();
    } else if (failure.kind === "setup-code-rejected") {
      setSetupCodeError(failure.message);
      flow.show("setup-code", "back");
    } else if (failure.kind === "unreachable") {
      setStatusMessage(t("setup.unreachable"));
    } else {
      showOnStep(failure);
    }
  }

  const currentStep = stepOfScreen(screen);
  const stepIndicator = currentStep && (
    <StepIndicator
      steps={setupStepsFor(status)}
      current={currentStep}
      visited={flow.progress.visitedSteps}
      completed={flow.progress.completedSteps}
      onGoTo={(step) => {
        setStatusMessage("");
        flow.goToStep(step);
      }}
    />
  );

  return (
    <FullScreenLayout topBar={stepIndicator} showsAppMark={screen !== "welcome"}>
      {renderScreen()}
    </FullScreenLayout>
  );

  function renderScreen() {
    switch (screen) {
      case "welcome":
        return <WelcomeScreen onContinue={() => flow.next()} />;
      case "setup-code":
        return (
          <SetupCodeScreen
            code={setupCode}
            onCodeChange={(code) => {
              setSetupCode(code);
              setSetupCodeError(undefined);
            }}
            error={setupCodeError}
            onContinue={continueFromSetupCode}
            onBack={flow.back}
          />
        );
      case "database":
        return (
          <DatabaseScreen
            databaseKind={answers.databaseKind}
            onDatabaseKindChange={(databaseKind) => change({ databaseKind })}
            onContinue={() => flow.next()}
            onBack={flow.back}
            statusMessage={statusMessage}
          />
        );
      case "postgres":
        return (
          <PostgresScreen
            form={answers.postgres}
            errors={connectionErrors}
            onChange={(changes) => {
              change({ postgres: { ...answers.postgres, ...changes } });
              setConnectionErrors({});
            }}
            onTestConnection={testConnection}
            onContinue={continueFromPostgres}
            onBack={flow.back}
            statusMessage={statusMessage}
            notice={
              wasReloaded && !answers.postgres.password
                ? t("postgres.passwordForgotten")
                : undefined
            }
          />
        );
      case "account":
        return (
          <CreateAccountScreen
            form={answers.account}
            onChange={changeAccount}
            errors={accountErrors}
            onContinue={continueFromAccount}
            onBack={flow.back}
            statusMessage={statusMessage}
            notice={
              wasReloaded && !answers.account.password ? t("account.passwordForgotten") : undefined
            }
          />
        );
      case "site-name":
        return (
          <SiteNameScreen
            siteName={answers.siteName}
            onSiteNameChange={(siteName) => {
              change({ siteName });
              setSiteNameError(undefined);
            }}
            error={siteNameError}
            onContinue={continueFromSiteName}
            onBack={flow.back}
          />
        );
      case "site-type":
        return (
          <SiteTypeScreen
            siteType={answers.siteType}
            onSiteTypeChange={(siteType) => change({ siteType })}
            onContinue={() => flow.next()}
            onBack={flow.back}
          />
        );
      case "review":
        return (
          <ReviewScreen
            answers={answers}
            showsDatabase={status.database.chosenBy !== "environment"}
            isConfirmed={isConfirmed}
            onConfirmedChange={setIsConfirmed}
            onEdit={flow.goToStep}
            onFinish={() => void finish()}
            onBack={flow.back}
            isBusy={isFinishing}
            statusMessage={statusMessage}
          />
        );
      default:
        return (
          <DoneScreen
            name={firstNameOf(answers.account.name)}
            summary={summaryOf(answers, status)}
            onContinue={() => session && onFinished(session)}
          />
        );
    }
  }
}

/**
 * The answers kept from before a reload. From another computer the setup code is only kept
 * in memory, so it has to be entered again first.
 */
function restoredSetup(status: SetupStatus) {
  const restored = rememberedSetup();
  if (!restored) return undefined;
  const needsCodeAgain = status.requiresSetupCode && !rememberedSetupCode();
  const screen = restored.progress.screen === "done" ? "review" : restored.progress.screen;
  return {
    ...restored,
    progress: { ...restored.progress, screen: needsCodeAgain ? ("setup-code" as const) : screen },
  };
}

/** What "Finish setup" sends: trimmed, the port as a number, no confirmation. */
export function answersToSend(answers: SetupAnswers, status: SetupStatus): SetupAnswersToSend {
  const site = { siteName: answers.siteName.trim(), siteType: answers.siteType };
  const account = cleanAccountDetails(answers.account);
  if (status.database.chosenBy === "environment") return { account, site };

  if (answers.databaseKind === "built-in") return { database: { kind: "built-in" }, account, site };
  const postgres = readPostgresForm(answers.postgres);
  // The Postgres step checked the fields; if they're wrong now the API says so too.
  const connection = postgres.errors
    ? { ...answers.postgres, port: Number(answers.postgres.port) }
    : postgres.connection;
  return {
    database: {
      kind: "postgres",
      ...connection,
      createIfMissing: answers.postgres.createIfMissing,
    },
    account,
    site,
  };
}

/** "Daniel Roberts" is greeted as "Daniel". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Built-in database · Blog, Forms, SEO tools", using the API's own feature names. */
export function summaryOf(answers: SetupAnswers, status: SetupStatus): string {
  const kind =
    status.database.chosenBy === "environment" ? status.database.kind : answers.databaseKind;
  const database = kind === "postgres" ? t("done.postgres") : t("done.builtIn");
  const features = featuresForSiteType(answers.siteType).map(({ name }) => name);
  return t("done.summary", { database, features: features.join(", ") || t("done.noFeatures") });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

function focusField(name: string | undefined) {
  if (!name) return;
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus();
}
