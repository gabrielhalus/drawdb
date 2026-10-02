import { useDiagramCollection } from "../hooks";
import Collection from "./Collection";

/**
 * `/collection` always renders the collection, including its empty state, so it
 * stays reachable from the editor even on an instance with nothing saved yet.
 */
export default function CollectionRoute() {
  return <Collection collection={useDiagramCollection()} />;
}
