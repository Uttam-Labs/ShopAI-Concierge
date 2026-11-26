import { useEffect } from "react";
import { isRouteErrorResponse, Outlet, useLoaderData, useLocation, useNavigate, useNavigation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import AdminToastHost from "../components/AdminToast";
import { AdminIcon } from "../components/AdminPageHeader";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const navigation = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const navigateInApp = (path) => (event) => {
    event.preventDefault();
    navigate(path);
  };
  const isLoadingAdminPage = navigation.state === "loading"
    && navigation.location?.pathname.startsWith("/app")
    && navigation.location.pathname !== location.pathname;

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app" onClick={navigateInApp("/app")}>Dashboard</s-link>
        <s-link href="/app/conversations" onClick={navigateInApp("/app/conversations")}>Concierge</s-link>
        <s-link href="/app/rag" onClick={navigateInApp("/app/rag")}>RAG knowledge</s-link>
        <s-link href="/app/flows" onClick={navigateInApp("/app/flows")}>Flows</s-link>
        <s-link href="/app/faqs" onClick={navigateInApp("/app/faqs")}>Questions</s-link>
        <s-link href="/app/tickets" onClick={navigateInApp("/app/tickets")}>Tickets</s-link>
        <s-link href="/app/settings" onClick={navigateInApp("/app/settings")}>Settings</s-link>
      </s-app-nav>
      {isLoadingAdminPage ? <AdminPageSkeleton /> : <Outlet />}
      <AdminToastHost />
    </AppProvider>
  );
}

function AdminPageSkeleton() {
  return (
    <main className="admin-route-skeleton" aria-label="Loading page" aria-busy="true">
      <div className="admin-skeleton-header">
        <div className="admin-skeleton-intro">
          <span className="admin-skeleton-line short" />
          <span className="admin-skeleton-line title" />
          <span className="admin-skeleton-line description" />
        </div>
        <div className="admin-skeleton-metrics">
          <span /><span /><span />
        </div>
      </div>
      <div className="admin-skeleton-content">
        <section className="admin-skeleton-panel">
          <span className="admin-skeleton-line panel-title" />
          <span className="admin-skeleton-line panel-copy" />
          <div className="admin-skeleton-list">
            <span /><span /><span /><span />
          </div>
        </section>
        <section className="admin-skeleton-panel wide">
          <span className="admin-skeleton-line panel-title" />
          <span className="admin-skeleton-line panel-copy" />
          <div className="admin-skeleton-cards">
            <span /><span /><span /><span />
          </div>
        </section>
      </div>
    </main>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status < 500) return boundary.error(error);
  return <AdminPageError />;
}

function AdminPageError() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("shopai:toast", { detail: {
      type: "error",
      title: "Page couldn’t load",
      message: "Please try again. If the problem continues, refresh the app.",
    } }));
  }, []);

  return (
    <main className="admin-route-error">
      <section>
        <span className="admin-error-icon"><AdminIcon name="warning" size={18} /></span>
        <h1>We couldn’t load this page</h1>
        <p>Your information is safe. Try again, or return to the dashboard.</p>
        <div>
          <button className="admin-secondary" type="button" onClick={() => window.location.reload()}>Try again</button>
          <button className="admin-cta" type="button" onClick={() => window.location.assign("/app")}>Go to dashboard</button>
        </div>
      </section>
      <AdminToastHost />
    </main>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
