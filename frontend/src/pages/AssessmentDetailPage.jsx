// "/assessments/:id": one full assessment, at a shareable URL.
//
// When arriving from a just-run assessment the full record is in router state
// and rendered immediately; on a direct visit / refresh it is fetched.
//
// Owns the per-assessment actions: revise (new version), archive/restore
// (reversible) and delete (not). Delete goes through a modal rather than
// window.confirm so it cannot be dismissed by muscle memory.
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  deleteAssessment,
  getAssessment,
  listVersions,
  setArchived,
} from "../api.js";
import AssessmentResult from "../components/AssessmentResult.jsx";
import ErrorState, { explainError } from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import VersionHistory from "../components/VersionHistory.jsx";
import Banner from "../components/ui/Banner.jsx";
import Button from "../components/ui/Button.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import {
  ArchiveBoxIcon,
  DownloadIcon,
  PrinterIcon,
  RerunIcon,
  RestoreIcon,
  TrashIcon,
} from "../components/ui/icons.jsx";

export default function AssessmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const passed = location.state?.record;
  const initial = passed && String(passed.id) === id ? passed : null;

  const [record, setRecord] = useState(initial);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (record && String(record.id) === id) return;
    let cancelled = false;
    setRecord(null);
    setError(null);
    getAssessment(id)
      .then((r) => {
        if (!cancelled) setRecord(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [id, record, reloadKey]);

  // Version history is a separate request: it is not needed to render the
  // verdict, and a failure here must not block the page.
  useEffect(() => {
    let cancelled = false;
    listVersions(id)
      .then((v) => {
        if (!cancelled) setVersions(v);
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const handleArchiveToggle = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await setArchived(id, !record.archived);
      setRecord(updated);
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }, [id, record]);

  async function handleDownloadPdf() {
    setDownloading(true);
    setActionError(null);
    try {
      const { downloadAssessmentPdf } =
        await import("../pdf/downloadAssessmentPdf.js");
      await downloadAssessmentPdf(record);
    } catch (e) {
      setActionError(e);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setActionError(null);
    try {
      await deleteAssessment(id);
      navigate("/assessments", { replace: true });
    } catch (e) {
      setActionError(e);
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
    );
  }
  if (!record) {
    return <LoadingState message="Fetching the assessment." />;
  }

  const isLatest =
    versions.length === 0 ||
    record.version === Math.max(...versions.map((v) => v.version));
  const actionFailure = actionError ? explainError(actionError) : null;

  return (
    <div className="space-y-6">
      {record.archived && (
        <Banner tone="info" title="Archived.">
          This assessment is hidden from your active list and excluded from the
          dashboard. Restore it to bring it back.
        </Banner>
      )}

      {!isLatest && (
        <Banner tone="warning" title="Superseded version.">
          A newer version of this assessment exists — see the version history
          below.
        </Banner>
      )}

      {actionFailure && (
        <Banner tone="error" title={actionFailure.title}>
          {actionFailure.body}
        </Banner>
      )}

      <AssessmentResult
        record={record}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              <DownloadIcon className="h-4 w-4" />
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
            >
              <PrinterIcon className="h-4 w-4" />
              Print / Save as PDF
            </Button>
            <Link to={`/assessments/${record.id}/revise`}>
              <Button variant="secondary" size="sm">
                <RerunIcon className="h-4 w-4" />
                Revise &amp; re-run
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleArchiveToggle}
              disabled={busy}
            >
              {record.archived ? (
                <>
                  <RestoreIcon className="h-4 w-4" />
                  Restore
                </>
              ) : (
                <>
                  <ArchiveBoxIcon className="h-4 w-4" />
                  Archive
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="text-risk-high-fg hover:bg-risk-high-bg hover:text-risk-high-fg"
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      {/* Interactive navigation, not part of the paper document — the printed
          header already states which version this is. */}
      <div className="print:hidden">
        <VersionHistory versions={versions} currentId={record.id} />
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this assessment?"
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      >
        <p>
          <strong className="text-ink">{record.project_name}</strong> and its
          full result will be permanently removed. This cannot be undone.
        </p>
        {versions.length > 1 && (
          <p className="mt-2">
            This deletes only version {record.version}. The other{" "}
            {versions.length - 1}{" "}
            {versions.length - 1 === 1 ? "version" : "versions"} are kept.
          </p>
        )}
        <p className="mt-2">
          If you only want it out of the way, archive it instead — that is
          reversible.
        </p>
      </ConfirmDialog>
    </div>
  );
}
