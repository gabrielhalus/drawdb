import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Banner, Button, Input, Spin } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { signIn } from "../api/auth";
import { useAuth, useInstanceInfo } from "../hooks";
import { REDIRECT_PARAM, safeDestination } from "../utils/authRedirect";
import AuthCard from "../components/Auth/AuthCard";

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const instance = useInstanceInfo();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = safeDestination(searchParams.get(REDIRECT_PARAM));
  const signUpLink = `/sign-up?${REDIRECT_PARAM}=${encodeURIComponent(destination)}`;

  useEffect(() => {
    document.title = `${t("sign_in")} | drawDB`;
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={destination} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: failure } = await signIn.email({ email, password });
    setSubmitting(false);
    if (failure) {
      setError(failure.message || t("sign_in_failed"));
      return;
    }
    navigate(destination, { replace: true });
  };

  return (
    <AuthCard
      title={t("sign_in")}
      subtitle={t("sign_in_subtitle")}
      footer={
        instance.signupOpen ? (
          <span>
            {t("no_account_yet")}{" "}
            <Link
              to={signUpLink}
              className="font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              {t("sign_up")}
            </Link>
          </span>
        ) : (
          t("signups_closed_hint")
        )
      }
    >
      {/*
        A fresh instance has nobody to sign in as, so it points at the form that
        creates the owner instead of leaving the visitor at a dead end.
      */}
      {instance.status === "ready" && !instance.hasAccounts && (
        <Banner
          className="mb-4"
          fullMode={false}
          type="info"
          bordered
          icon={null}
          closeIcon={null}
          description={
            <span>
              {t("instance_needs_owner")}{" "}
              <Link to={signUpLink} className="font-medium hover:underline">
                {t("create_owner_account")}
              </Link>
            </span>
          }
        />
      )}

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
            autoComplete="current-password"
            size="large"
          />
        </label>

        <Button
          theme="solid"
          size="large"
          block
          htmlType="submit"
          loading={submitting}
          disabled={!email || !password}
        >
          {t("sign_in")}
        </Button>
      </form>
    </AuthCard>
  );
}
