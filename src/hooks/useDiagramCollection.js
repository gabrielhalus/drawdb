import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { diagramApi } from "../api/diagrams";

/**
 * Loads the server-stored diagram collection. `status` is deliberately explicit
 * so callers can tell "no diagrams yet" apart from "not known yet" — the root
 * route picks between the landing page and the collection on that distinction.
 */
export default function useDiagramCollection() {
  const { t } = useTranslation();
  const [state, setState] = useState({
    status: "loading",
    error: null,
    diagrams: [],
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const diagrams = await diagramApi.list();
      setState({ status: "ready", error: null, diagrams });
    } catch (error) {
      setState({
        status: "error",
        error: error?.message || t("failed_to_load_short"),
        diagrams: [],
      });
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(async (diagramId) => {
    await diagramApi.delete(diagramId);
    setState((current) => ({
      ...current,
      diagrams: current.diagrams.filter(
        (diagram) => diagram.diagramId !== diagramId,
      ),
    }));
  }, []);

  return {
    status: state.status,
    error: state.error,
    diagrams: state.diagrams,
    refresh,
    remove,
  };
}
