import { useSyncExternalStore } from "react";
import { navigate } from "wouter/use-hash-location";

// wouter's built-in useHashLocation keeps the query string glued onto the
// path (e.g. "/reset-password?token=..."), which breaks exact route matching.
// This strips the query string so `Route path="/reset-password"` matches.
const currentHashLocation = () =>
  "/" + location.hash.replace(/^#?\/?/, "").split("?")[0];

const subscribeToHashUpdates = (callback: () => void) => {
  addEventListener("hashchange", callback);
  return () => removeEventListener("hashchange", callback);
};

export const useHashLocation = (): [string, typeof navigate] => [
  useSyncExternalStore(subscribeToHashUpdates, currentHashLocation, () => "/"),
  navigate,
];
