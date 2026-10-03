import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import Editor from "./pages/Editor";
import BugReport from "./pages/BugReport";
import Templates from "./pages/Templates";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/Home";
import CollectionRoute from "./pages/CollectionRoute";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import SettingsContextProvider from "./context/SettingsContext";
import NotFound from "./pages/NotFound";
import MigrationBanner, { isLegacyHost } from "./components/MigrationBanner";
import RequireAuth from "./components/Auth/RequireAuth";

export default function App() {
  // Anything that reads or writes server-stored diagrams needs an account. The
  // landing page, the templates gallery and the bug report form stay open:
  // nothing there touches a user's collection.
  const routes = (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route
        path="/collection"
        element={
          <RequireAuth>
            <CollectionRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/editor"
        element={
          <RequireAuth>
            <Editor />
          </RequireAuth>
        }
      />
      <Route
        path="/editor/diagrams/:id"
        element={
          <RequireAuth>
            <Editor />
          </RequireAuth>
        }
      />
      <Route
        path="/editor/templates/:id"
        element={
          <RequireAuth>
            <Editor />
          </RequireAuth>
        }
      />
      <Route path="/bug-report" element={<BugReport />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  return (
    <BrowserRouter>
      <SettingsContextProvider>
        <RestoreScroll />
        {isLegacyHost() ? (
          <div className="h-full flex flex-col">
            <MigrationBanner />
            <div className="flex-1 min-h-0">{routes}</div>
          </div>
        ) : (
          routes
        )}
      </SettingsContextProvider>
    </BrowserRouter>
  );
}

function RestoreScroll() {
  const location = useLocation();
  useLayoutEffect(() => {
    window.scroll(0, 0);
  }, [location.pathname]);
  return null;
}
