import { Spin } from "@douyinfe/semi-ui";
import { useDiagramCollection } from "../hooks";
import Collection from "./Collection";
import LandingPage from "./LandingPage";

/**
 * Resolves what `/` should be. Once a single diagram exists on the server the
 * collection becomes the home page; an empty instance still gets the landing
 * page, which also stays permanently reachable at `/welcome`.
 *
 * A load failure shows the collection's error state rather than silently
 * falling back to the landing page — "the server is unreachable" and "there is
 * nothing saved yet" are different situations and must not look alike.
 */
export default function Home() {
  const collection = useDiagramCollection();

  if (collection.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <Spin size="large" />
      </div>
    );
  }

  if (collection.status === "ready" && collection.diagrams.length === 0) {
    return <LandingPage />;
  }

  return <Collection collection={collection} />;
}
