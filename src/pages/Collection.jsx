import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Banner,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Toast,
} from "@douyinfe/semi-ui";
import {
  IconDelete,
  IconMore,
  IconPlus,
  IconSearch,
} from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { databases } from "../data/databases";
import { useSettings, useThemedPage } from "../hooks";
import logo_light from "../assets/logo_light_160.png";
import logo_dark from "../assets/logo_dark_160.png";

const SORTS = ["recent", "name", "tables"];

function sortDiagrams(diagrams, sort) {
  const sorted = [...diagrams];
  if (sort === "name") {
    return sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }
  if (sort === "tables") {
    return sorted.sort((a, b) => b.tableCount - a.tableCount);
  }
  return sorted.sort((a, b) =>
    String(b.lastModified ?? "").localeCompare(String(a.lastModified ?? "")),
  );
}

function relativeTime(value, t) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return t("just_now");
  if (minutes < 60) return t("minutes_ago", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("hours_ago", { count: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t("days_ago", { count: days });
  return new Date(value).toLocaleDateString();
}

function DiagramCard({ diagram, onDelete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meta = databases[diagram.database || "generic"];
  const open = () => navigate(`/editor/diagrams/${diagram.diagramId}`);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className="group text-left rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {meta?.image && (
            <img src={meta.image} alt="" className="h-5 w-5 object-contain" />
          )}
          <span className="font-semibold truncate" title={diagram.name}>
            {diagram.name}
          </span>
        </div>
        {/*
          The menu is portalled out of this card in the DOM, but React still
          bubbles its events through the component tree — without this guard,
          choosing a menu item would also open the diagram behind it.
        */}
        <span onClick={(event) => event.stopPropagation()} role="presentation">
          <Dropdown
            trigger="click"
            position="bottomRight"
            render={
              <Dropdown.Menu>
                <Dropdown.Item
                  type="danger"
                  icon={<IconDelete />}
                  onClick={() => onDelete(diagram)}
                >
                  {t("delete")}
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <Button
              theme="borderless"
              size="small"
              icon={<IconMore />}
              aria-label={t("more")}
            />
          </Dropdown>
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{meta?.name}</span>
        <span aria-hidden="true">·</span>
        <span>{t("table_count", { count: diagram.tableCount })}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        {t("edited")} {relativeTime(diagram.lastModified, t)}
      </div>
    </div>
  );
}

export default function Collection({ collection }) {
  useThemedPage();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { status, error, diagrams, refresh, remove } = collection;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(SORTS[0]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = `${t("diagrams")} | drawDB`;
  }, [t]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? diagrams.filter((diagram) =>
          (diagram.name ?? "").toLowerCase().includes(needle),
        )
      : diagrams;
    return sortDiagrams(matching, sort);
  }, [diagrams, query, sort]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await remove(pendingDelete.diagramId);
      Toast.success(t("diagram_deleted"));
      setPendingDelete(null);
    } catch (deleteError) {
      Toast.error(deleteError?.message || t("oops_smth_went_wrong"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
      <header className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="drawDB">
            <img
              src={settings.mode === "dark" ? logo_dark : logo_light}
              alt="drawDB"
              className="h-9"
            />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/templates"
              className="hover:text-sky-700 dark:hover:text-sky-400 transition-colors"
            >
              {t("templates")}
            </Link>
            <Link
              to="/welcome"
              className="hover:text-sky-700 dark:hover:text-sky-400 transition-colors"
            >
              {t("about")}
            </Link>
            <Link to="/editor">
              <Button theme="solid" icon={<IconPlus />}>
                {t("new_diagram")}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("your_diagrams")}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {t("stored_on_server")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              prefix={<IconSearch />}
              placeholder={t("search")}
              value={query}
              onChange={setQuery}
              showClear
              style={{ width: 240 }}
            />
            <Select value={sort} onChange={setSort} style={{ width: 180 }}>
              {SORTS.map((option) => (
                <Select.Option key={option} value={option}>
                  {t(`sort_${option}`)}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>

        {error && (
          <Banner
            fullMode={false}
            type="danger"
            bordered
            icon={null}
            closeIcon={null}
            description={
              <div className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <Button size="small" onClick={refresh}>
                  {t("retry")}
                </Button>
              </div>
            }
          />
        )}

        {status === "loading" && diagrams.length === 0 && !error && (
          <div className="flex justify-center py-24">
            <Spin size="large" />
          </div>
        )}

        {!error && diagrams.length > 0 && visible.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t("no_diagrams_match_filters")}
          </div>
        )}

        {!error && status === "ready" && diagrams.length === 0 && (
          <Empty
            className="py-16"
            title={t("no_saved_diagrams")}
            description={t("create_your_first_diagram")}
          >
            <Link to="/editor">
              <Button theme="solid" icon={<IconPlus />}>
                {t("new_diagram")}
              </Button>
            </Link>
          </Empty>
        )}

        {visible.length > 0 && (
          <div className="grid grid-cols-3 gap-4 md:grid-cols-2 sm:grid-cols-1">
            {visible.map((diagram) => (
              <DiagramCard
                key={diagram.diagramId}
                diagram={diagram}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        title={t("delete_diagram")}
        visible={Boolean(pendingDelete)}
        onOk={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        okText={t("delete")}
        cancelText={t("cancel")}
        okButtonProps={{ type: "danger", loading: deleting }}
        centered
      >
        {t("are_you_sure_delete_diagram")}
      </Modal>
    </div>
  );
}
