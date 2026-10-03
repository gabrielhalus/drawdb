import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Banner, Button, Input, Spin } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { SIGNUP_CLOSED_ERROR, signUp } from "../api/auth";
import { useAuth, useInstanceInfo } from "../hooks";
import { REDIRECT_PARAM, safeDestination } from "../utils/authRedirect";
import AuthCard from "../components/Auth/AuthCard";

const MIN_PASSWORD_LENGTH = 8;

export default function SignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const instance = useInstanceInfo();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = safeDestination(searchParams.get(REDIRECT_PARAM));
  const signInLink = `/sign-in?${REDIRECT_PARAM}=${encodeURIComponent(destination)}`;
  // The first account owns the instance, which is worth saying out loud: it
  // adopts any diagram saved before this instance had accounts.
  const isBootstrap = instance.status === "ready" && !instance.hasAccounts;

  useEffect(() => {
    document.title = `${t("sign_up")} | drawDB`;
  }, [t]);

  if (isLoading || instance.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={destination} replace />;

  if (!instance.signupOpen) {
    return (
      <AuthCard
        title={t("signups_closed")}
        subtitle={t("signups_closed_description")}
        footer={
          <Link
            to={signInLink}
            className="font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            {t("back_to_sign_in")}
          </Link>
        }
      >
        <Banner
          fullMode={false}
          type="info"
          bordered
          icon={null}
          closeIcon={null}
          description={t("signups_closed_hint")}
        />
      </AuthCard>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: failure } = await signUp.email({
      email,
      password,
      name: name || email,
    });
    setSubmitting(false);
    if (failure) {
      setError(
        failure.code === SIGNUP_CLOSED_ERROR
          ? t("signups_closed_description")
          : failure.message || t("sign_up_failed"),
      );
      return;
    }
    navigate(destination, { replace: true });
  };

  return (
    <AuthCard
      title={isBootstrap ? t("create_owner_account") : t("sign_up")}
      subtitle={isBootstrap ? t("owner_account_subtitle") : t("sign_up_subtitle")}
      footer={
        <span>
          {t("already_have_an_account")}{" "}
          <Link
            to={signInLink}
            className="font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            {t("sign_in")}
          </Link>
        </span>
      }
    >
      {error && (
        <Banner
          className="mb-4"
          fullMode={false}
          type="danger"
          bordered
          icon={null}
          closeIcon={null}
          description={error}
        />
      )}

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("name")}</span>
          <Input
            value={name}
            onChange={setName}
            autoComplete="name"
            size="large"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("email")}</span>
          <Input
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            size="large"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("password")}</span>
          <Input
            mode="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            size="large"
          />
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            {t("password_min_length", { count: MIN_PASSWORD_LENGTH })}
          </span>
        </label>

        <Button
          theme="solid"
          size="large"
          block
          htmlType="submit"
          loading={submitting}
          disabled={!email || password.length < MIN_PASSWORD_LENGTH}
        >
          {isBootstrap ? t("create_owner_account") : t("sign_up")}
        </Button>
      </form>
    </AuthCard>
  );
}
