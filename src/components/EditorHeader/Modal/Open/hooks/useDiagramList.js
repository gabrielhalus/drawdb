import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { diagramApi } from "../../../../../api/diagrams";
import { useExtensions } from "../../../../../context/ExtensionsContext";

const DISABLED = { loading: false, error: null, items: [] };

function readError(err) {
  return err?.response?.data?.error || err?.message;
}

export function useDiagramList() {
  const { t } = useTranslation();
  const extensions = useExtensions();
  const cloudList = extensions?.cloudList;
  const cloudEnabled = typeof cloudList === "function";
  const currentUserId = extensions?.cloudCurrentUserId ?? null;

  const [local, setLocal] = useState(undefined);
  const [cloud, setCloud] = useState(() =>
    cloudEnabled ? { loading: true, error: null, items: null } : DISABLED,
  );

  useEffect(() => {
    let cancelled = false;
    diagramApi
      .list()
      .then((items) => {
        if (!cancelled) setLocal(items);
      })
      .catch(() => {
        if (!cancelled) setLocal([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudEnabled) {
      setCloud(DISABLED);
      return undefined;
    }
    let cancelled = false;
    setCloud({ loading: true, error: null, items: null });
    cloudList()
      .then((items) => {
        if (!cancelled) setCloud({ loading: false, error: null, items });
      })
      .catch((err) => {
        if (!cancelled)
          setCloud({ loading: false, error: err ?? true, items: null });
      });
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, cloudList]);

  return {
    loading: cloud.loading || local === undefined,
    error: cloud.error && (readError(cloud.error) || t("failed_to_load_short")),
    cloud: cloud.items ?? [],
    local: local ?? [],
    cloudEnabled,
    currentUserId,
  };
}
